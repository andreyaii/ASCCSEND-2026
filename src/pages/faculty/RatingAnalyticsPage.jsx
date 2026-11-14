import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import { ErrorState, Loading } from '../../components/Feedback';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { getAdminRatingAnalytics } from '../../services/evaluationService';
import { getProjects } from '../../services/projectService';
import { evaluationCriteria } from '../../data/settings';
import { formatScore } from '../../utils/ratings';
import { summarizeRatings } from '../../utils/ratingAnalytics';

export default function RatingAnalyticsPage() {
  const { user } = useAuth();
  const [source, setSource] = useState('both');
  const [categoryId, setCategoryId] = useState('all');
  const [groupId, setGroupId] = useState('all');
  const { data, loading, error, reload } = useAsync(
    async (refresh) => {
      const [evaluations, projects] = await Promise.all([
        getAdminRatingAnalytics(user),
        getProjects({ refresh }),
      ]);
      return { evaluations, projects };
    },
    [user?.id],
    `rating-analytics:${user?.id}`,
  );

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const summary = summarizeRatings(data.evaluations, data.projects, { source, categoryId, groupId });
  const selectedCategory = evaluationCriteria.find((criterion) => criterion.id === categoryId);

  return (
    <>
      <PageHeader
        title="Rating Analytics / Summary"
        subtitle="Compare group performance using evaluation ratings recorded in the system."
      />

      <section className="card mb-6 p-4 sm:p-5" aria-label="Rating analytics filters">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm font-semibold">
            Submitted by
            <span className="relative mt-1.5 block">
              <select className="form-input appearance-none pr-10" value={source} onChange={(event) => setSource(event.target.value)}>
                <option value="both">Both (combined)</option>
                <option value="faculty">Faculty</option>
                <option value="student">Students</option>
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            </span>
          </label>
          <label className="block text-sm font-semibold">
            Evaluation category
            <span className="relative mt-1.5 block">
              <select className="form-input appearance-none pr-10" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="all">All categories</option>
                {evaluationCriteria.map((criterion) => (
                  <option key={criterion.id} value={criterion.id}>{criterion.label}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            </span>
          </label>
          <label className="block text-sm font-semibold">
            Project group
            <span className="relative mt-1.5 block">
              <select className="form-input appearance-none pr-10" value={groupId} onChange={(event) => setGroupId(event.target.value)}>
                <option value="all">All groups</option>
                {data.projects.map((project) => (
                  <option key={project.groupId} value={project.groupId}>
                    {project.group?.groupName || project.title || project.groupId}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            </span>
          </label>
        </div>
        <p className="mt-4 text-xs text-muted" role="status">
          {summary.evaluationCount} {summary.evaluationCount === 1 ? 'evaluation' : 'evaluations'} match the selected source and group filters.
        </p>
      </section>

      <section className="card mb-6 overflow-hidden">
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <h2 className="text-lg font-bold">Category leaders</h2>
          <p className="mt-1 text-sm text-muted">
            Highest average score{selectedCategory ? ` for ${selectedCategory.label}` : ' in each category'} (1–5).
          </p>
        </div>
        {summary.categories.length === 0 ? (
          <p className="p-5 text-sm text-muted">No evaluation categories are available.</p>
        ) : (
          <div className="divide-y divide-line">
            {summary.categories.map(({ criterion, leaders }) => (
              <div key={criterion.id} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="font-semibold">{criterion.label}</p>
                {leaders.length ? (
                  <div className="flex flex-wrap gap-2">
                    {leaders.map((leader) => (
                      <span key={leader.groupId} className="badge-primary">
                        {leader.groupName} · {formatScore(leader.average)} ({leader.count})
                      </span>
                    ))}
                  </div>
                ) : <span className="text-sm text-muted">No ratings yet</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line px-4 py-4 sm:px-5">
          <h2 className="text-lg font-bold">Overall group comparison</h2>
          <p className="mt-1 text-sm text-muted">
            Groups ranked by average score across {selectedCategory ? selectedCategory.label : 'the selected categories'}.
          </p>
        </div>
        {summary.overallGroups.length === 0 ? (
          <p className="p-5 text-sm text-muted">No ratings match these filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 sm:px-5">Rank / group</th>
                  {summary.categories.map(({ criterion }) => (
                    <th scope="col" key={criterion.id} className="px-4 py-3">{criterion.label}</th>
                  ))}
                  <th scope="col" className="px-4 py-3">Overall</th>
                  <th scope="col" className="px-4 py-3">Ratings</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {summary.overallGroups.map((group, index) => (
                  <tr key={group.groupId}>
                    <th scope="row" className="px-4 py-3 font-semibold sm:px-5">
                      <span className="mr-2 text-muted">{index + 1}.</span>{group.groupName}
                    </th>
                    {group.categories.map((category) => (
                      <td key={category.criterionId} className="px-4 py-3">
                        {category.average === null ? '–' : formatScore(category.average)}
                      </td>
                    ))}
                    <td className="px-4 py-3 font-bold">{formatScore(group.average)}</td>
                    <td className="px-4 py-3 text-muted">{group.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
