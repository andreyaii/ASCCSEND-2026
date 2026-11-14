import PageHeader from '../../components/PageHeader';
import ProjectBrowser from '../../components/ProjectBrowser';
import EvaluationCounter from '../../components/EvaluationCounter';
import { Loading, ErrorState } from '../../components/Feedback';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { getProjects } from '../../services/projectService';
import { getAggregates, getStudentEvaluationData } from '../../services/evaluationService';

export default function ExplorePage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(
    async (force) => {
      const [projects, aggregates, evaluationData] = await Promise.all([
        getProjects({ excludeGroupId: user.groupId, refresh: force }), // own group is excluded
        getAggregates(user),
        getStudentEvaluationData(user.id),
      ]);
      return {
        projects,
        aggregates,
        evaluatedGroupIds: new Set(evaluationData.evaluations.map((e) => e.evaluatedGroupId)),
        status: evaluationData.status,
      };
    },
    [user.id],
    `student-explore:${user.id}:${user.groupId}`,
  );

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <>
      <PageHeader title="Explore Projects" subtitle="Browse projects from other groups and share your feedback." />
      <div className="mb-5 rounded-card border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm text-ink">
        <p className="font-semibold text-emerald-800">How to evaluate projects</p>
        <p className="mt-1 leading-6">Choose any project from another group, review its research paper, pitch video, poster, and logo, then submit your evaluation. You can evaluate as many projects as you like, but each project can only be evaluated once.</p>
      </div>
      <div className="mb-5"><EvaluationCounter status={data.status} /></div>
      <ProjectBrowser projects={data.projects} aggregates={data.aggregates}
        fullCardLink
        linkFor={(p) => `/student/projects/${p.id}`}
        badgeFor={(p) => data.evaluatedGroupIds.has(p.groupId) && <span className="badge-green">Evaluated</span>} />
    </>
  );
}
