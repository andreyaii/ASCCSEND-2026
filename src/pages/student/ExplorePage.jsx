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
        getAggregates(),
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
      <PageHeader title="Explore Projects" subtitle="Browse projects from other groups and evaluate up to the allowed limit." />
      <div className="mb-5"><EvaluationCounter status={data.status} /></div>
      <ProjectBrowser projects={data.projects} aggregates={data.aggregates}
        linkFor={(p) => `/student/projects/${p.id}`}
        badgeFor={(p) => data.evaluatedGroupIds.has(p.groupId) && <span className="badge-green">Evaluated</span>} />
    </>
  );
}
