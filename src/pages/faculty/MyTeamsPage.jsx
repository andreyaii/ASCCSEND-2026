import { Users } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import GroupProjectPanel from '../../components/GroupProjectPanel';
import { Loading, ErrorState, EmptyState } from '../../components/Feedback';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { getProjects } from '../../services/projectService';
import { getAssignedGroupIds } from '../../services/facultyService';
import { getAggregates } from '../../services/evaluationService';

export default function MyTeamsPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(async (force) => {
    const groupIds = await getAssignedGroupIds(user.id);
    const [projects, aggregates] = await Promise.all([getProjects({ groupIds, refresh: force }), getAggregates()]);
    return { projects, aggregates };
  }, [user.id], `faculty-my-teams:${user.id}`);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <>
      <PageHeader title="My Teams" subtitle="Only the groups assigned to you." />
      <p className="mb-5 flex items-center gap-2 rounded-[10px] bg-primary-light px-4 py-2.5 text-sm font-semibold text-primary">
        <Users className="h-4 w-4" /> Showing {data.projects.length} team{data.projects.length === 1 ? '' : 's'} assigned to {user.name}
      </p>
      <div className="space-y-6">
        {data.projects.length === 0
          ? <EmptyState title="No assigned teams" message="You have no groups assigned yet." />
          : data.projects.map((p) => <GroupProjectPanel key={p.id} project={p} aggregate={data.aggregates[p.groupId]} detailsTo={`/faculty/projects/${p.id}`} />)}
      </div>
    </>
  );
}
