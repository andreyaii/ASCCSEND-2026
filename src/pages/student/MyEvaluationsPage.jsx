import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import EvaluationCounter from '../../components/EvaluationCounter';
import { Loading, ErrorState, EmptyState } from '../../components/Feedback';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useAsync } from '../../hooks/useAsync';
import { getProjects } from '../../services/projectService';
import { getStudentEvaluationData } from '../../services/evaluationService';
import { formatDate, formatScore } from '../../utils/ratings';

export default function MyEvaluationsPage() {
  const { user } = useAuth();
  const { ratingsShown, ratingsHiddenReason } = useSettings();
  const { data, loading, error, reload } = useAsync(async (force) => {
    const [evaluationData, projects] = await Promise.all([
      getStudentEvaluationData(user.id),
      getProjects({ refresh: force }),
    ]);
    return {
      evaluations: [...evaluationData.evaluations].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
      projects,
      status: evaluationData.status,
    };
  }, [user.id], `student-evaluations:${user.id}`);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const projectOf = (groupId) => data.projects.find((p) => p.groupId === groupId);

  return (
    <>
      <PageHeader title="My Evaluations" subtitle="Your submitted evaluations. Submitted evaluations cannot be edited." />
      <div className="mb-5"><EvaluationCounter status={data.status} /></div>
      {!ratingsShown && <p className="mb-4 rounded-[10px] bg-white p-3 text-sm text-muted card">{ratingsHiddenReason}</p>}

      {data.evaluations.length === 0 ? (
        <div className="card"><EmptyState icon={ClipboardList} title="No evaluations yet" message="Evaluate projects from the Explore page." action={<Link to="/student/explore" className="btn-primary">Explore Projects</Link>} /></div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {data.evaluations.map((e) => {
              const p = projectOf(e.evaluatedGroupId);
              return (
                <article key={e.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-muted">{p?.group?.groupName || 'Group unavailable'}</p>
                      <h2 className="mt-1 text-base font-bold leading-snug">{p ? <Link className="hover:text-primary" to={`/student/projects/${p.id}`}>{p.title}</Link> : 'Project unavailable'}</h2>
                    </div>
                    <span className="badge-green shrink-0">Submitted</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
                    <span className="text-xs text-muted">{formatDate(e.submittedAt)}</span>
                    <span className="font-bold text-star">{ratingsShown ? formatScore(e.overallScore) : <span className="font-normal text-muted">Rating hidden</span>}</span>
                  </div>
                </article>
              );
            })}
          </div>
          <div className="card hidden overflow-hidden md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface/70"><tr className="border-b border-line text-xs font-semibold text-muted"><th className="px-4 py-3">Project</th><th className="px-4 py-3">Group</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Overall rating</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody>
                {data.evaluations.map((e) => {
                  const p = projectOf(e.evaluatedGroupId);
                  return (
                    <tr key={e.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-semibold">{p ? <Link className="hover:text-primary" to={`/student/projects/${p.id}`}>{p.title}</Link> : '–'}</td>
                      <td className="px-4 py-3 text-muted">{p?.group?.groupName || '–'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{formatDate(e.submittedAt)}</td>
                      <td className="px-4 py-3 font-bold text-star">{ratingsShown ? formatScore(e.overallScore) : <span className="font-normal text-muted">Hidden</span>}</td>
                      <td className="px-4 py-3"><span className="badge-green">Submitted</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
