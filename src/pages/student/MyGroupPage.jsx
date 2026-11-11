import PageHeader from '../../components/PageHeader';
import GroupProjectPanel from '../../components/GroupProjectPanel';
import { Loading, ErrorState, EmptyState } from '../../components/Feedback';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { getProjectByGroupId } from '../../services/projectService';
import { ArrowRight } from 'lucide-react';
import { getAggregates, getEvaluationStatus } from '../../services/evaluationService';
import { Link } from 'react-router-dom';

export default function MyGroupPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(
    async (force) => {
      const [project, aggregates, status] = await Promise.all([
        getProjectByGroupId(user.groupId, { refresh: force }),
        getAggregates(),
        getEvaluationStatus(user.id),
      ]);
      return { project, aggregates, status };
    },
    [user.groupId, user.id],
    `student-my-group:${user.id}:${user.groupId}`,
  );

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <>
      <PageHeader title={`Welcome, ${user.name.split(' ')[0]}`} subtitle="Your team’s showcase and evaluation progress." actions={<Link to="/student/explore" className="btn-primary">Explore projects <ArrowRight className="h-4 w-4" /></Link>} />
      <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-ink">Evaluation progress</p>
          <p className="mt-0.5 text-xs text-muted">Evaluate as many projects from other groups as you like. Your group is excluded.</p>
        </div>
        <p className="text-sm font-semibold text-emerald-800">{data.status.submitted} evaluation(s) submitted</p>
      </section>
      <h2 className="mb-3 text-lg font-bold">Your project</h2>
      {data.project
        ? <GroupProjectPanel project={data.project} aggregate={data.aggregates[user.groupId]} />
        : <EmptyState title="No group assigned" message="You have not been assigned to a group yet." />}
    </>
  );
}
