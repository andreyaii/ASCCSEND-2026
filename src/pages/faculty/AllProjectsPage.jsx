import PageHeader from '../../components/PageHeader';
import ProjectBrowser from '../../components/ProjectBrowser';
import { Loading, ErrorState } from '../../components/Feedback';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { getProjects } from '../../services/projectService';
import { getAggregates } from '../../services/evaluationService';
import { isProjectAssignedToFaculty } from '../../utils/faculty';

import { isGuest } from '../../utils/roles';

export default function AllProjectsPage() {
  const { user } = useAuth();
  const guest = isGuest(user);
  const { data, loading, error, reload } = useAsync(
    async (force) => ({
      projects: await getProjects({ refresh: force }),
      aggregates: await getAggregates(user),
    }),
    [user?.id],
    `${guest ? 'guest' : 'faculty'}-all-projects:${user?.id}`,
  );

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <>
      <PageHeader title="All Projects" subtitle="All registered groups and their projects." />
      <ProjectBrowser projects={data.projects} aggregates={data.aggregates}
        fullCardLink
        linkFor={(p) => guest ? `/guest/projects/${p.id}` : `/faculty/projects/${p.id}`}
        badgeFor={(p) => {
          if (guest) return null;
          return isProjectAssignedToFaculty(p, user) ? <span className="badge-primary">My Team</span> : null;
        }} />
    </>
  );
}
