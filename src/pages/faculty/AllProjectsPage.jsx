import PageHeader from '../../components/PageHeader';
import ProjectBrowser from '../../components/ProjectBrowser';
import { Loading, ErrorState } from '../../components/Feedback';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { getProjects } from '../../services/projectService';
import { getAggregates } from '../../services/evaluationService';

export default function AllProjectsPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(async () => ({ projects: await getProjects(), aggregates: await getAggregates() }), []);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <>
      <PageHeader title="All Projects" subtitle="All registered groups and their projects." />
      <ProjectBrowser projects={data.projects} aggregates={data.aggregates}
        linkFor={(p) => `/faculty/projects/${p.id}`}
        badgeFor={(p) => user.assignedGroupIds?.includes(p.groupId) && <span className="badge-primary">My Team</span>} />
    </>
  );
}
