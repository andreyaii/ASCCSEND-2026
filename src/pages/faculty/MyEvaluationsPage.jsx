import { ClipboardList } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import { EmptyState, ErrorState, Loading } from '../../components/Feedback';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { getProjects } from '../../services/projectService';
import { getFacultyEvaluationData } from '../../services/evaluationService';
import { formatDate, formatScore } from '../../utils/ratings';

export default function MyEvaluationsPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(async (force) => {
    const [evaluations, projects] = await Promise.all([
      getFacultyEvaluationData(user),
      getProjects({ refresh: force }),
    ]);
    return {
      evaluations: [...evaluations].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
      projects,
    };
  }, [user.id], `faculty-evaluations:${user.id}`);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const projectOf = (groupId) => data.projects.find((project) => project.groupId === groupId);

  return (
    <>
      <PageHeader
        title="My Evaluations"
        subtitle="Groups you have evaluated. Submitted evaluations cannot be edited."
      />
      {data.evaluations.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={ClipboardList}
            title="No evaluations yet"
            message="Evaluations you submit will appear here."
            action={<Link to="/faculty/all-projects" className="btn-primary">Browse Projects</Link>}
          />
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {data.evaluations.map((evaluation) => {
              const project = projectOf(evaluation.evaluatedGroupId);
              return (
                <article key={evaluation.id} className="card p-4">
                  <p className="text-xs font-medium text-muted">{project?.group?.groupName || evaluation.evaluatedGroupId}</p>
                  <h2 className="mt-1 text-base font-bold leading-snug">
                    {project
                      ? <Link className="hover:text-primary" to={`/faculty/projects/${project.id}`}>{project.title}</Link>
                      : 'Project unavailable'}
                  </h2>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
                    <span className="text-xs text-muted">{formatDate(evaluation.submittedAt)}</span>
                    <span className="font-bold text-star">{formatScore(evaluation.overallScore)}</span>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="bg-surface/70">
                  <tr className="border-b border-line text-xs font-semibold text-muted">
                    <th scope="col" className="px-4 py-3">Project</th>
                    <th scope="col" className="px-4 py-3">Group</th>
                    <th scope="col" className="px-4 py-3">Submitted</th>
                    <th scope="col" className="px-4 py-3">Overall rating</th>
                  </tr>
                </thead>
                <tbody>
                  {data.evaluations.map((evaluation) => {
                    const project = projectOf(evaluation.evaluatedGroupId);
                    return (
                      <tr key={evaluation.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 font-semibold">
                          {project
                            ? <Link className="hover:text-primary" to={`/faculty/projects/${project.id}`}>{project.title}</Link>
                            : 'Project unavailable'}
                        </td>
                        <td className="px-4 py-3 text-muted">{project?.group?.groupName || evaluation.evaluatedGroupId}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(evaluation.submittedAt)}</td>
                        <td className="px-4 py-3 font-bold text-star">{formatScore(evaluation.overallScore)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
