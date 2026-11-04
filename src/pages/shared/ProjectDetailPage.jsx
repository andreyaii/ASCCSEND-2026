import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Lock } from 'lucide-react';
import ProjectThumb from '../../components/ProjectThumb';
import MemberList from '../../components/MemberList';
import ResourceLinks from '../../components/ResourceLinks';
import RatingSummary from '../../components/RatingSummary';
import EvaluationCounter from '../../components/EvaluationCounter';
import { Loading, ErrorState, EmptyState } from '../../components/Feedback';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useAsync } from '../../hooks/useAsync';
import { getProjectById } from '../../services/projectService';
import { getAggregates, getEligibility, getEvaluationsForGroup, getEvaluationStatus } from '../../services/evaluationService';
import { isStudent, basePathFor } from '../../utils/roles';
import { formatDate, formatScore } from '../../utils/ratings';

function StudentEvaluateBox({ eligibility, status, projectId }) {
  if (eligibility.code === 'duplicate') {
    return <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-5 w-5" /> You have submitted an evaluation for this group.</p>;
  }
  return (
    <div className="space-y-3">
      <EvaluationCounter status={status} />
      {eligibility.canEvaluate ? (
        <Link to={`/student/projects/${projectId}/evaluate`} className="btn-primary">Evaluate Project</Link>
      ) : (
        <>
          <button className="btn-primary" disabled><Lock className="h-4 w-4" /> Evaluate Project</button>
          <p className="text-sm text-muted">{eligibility.reason}</p>
        </>
      )}
    </div>
  );
}

// Faculty-only view of evaluations received (includes comments; never shown to students).
function ReceivedEvaluations({ evaluations }) {
  const { ratingsShown, ratingsHiddenReason } = useSettings();
  return (
    <section className="card p-5">
      <h2 className="mb-3 text-lg font-bold">Evaluations Received ({evaluations.length})</h2>
      {!ratingsShown && <p className="mb-3 rounded-[10px] bg-surface p-3 text-sm text-muted">{ratingsHiddenReason} Scores are hidden; submitted evaluations are unchanged.</p>}
      {evaluations.length === 0 ? <p className="text-sm text-muted">No evaluations yet.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead><tr className="border-b border-line text-xs text-muted"><th className="py-2 pr-3">Evaluator</th><th className="pr-3">Overall</th><th className="pr-3">Comments</th><th>Date</th></tr></thead>
            <tbody>
              {evaluations.map((e) => (
                <tr key={e.id} className="border-b border-line last:border-0 align-top">
                  <td className="py-2 pr-3"><span className="font-semibold">{e.evaluatorName}</span><span className="block text-xs text-muted">{e.evaluatorGroup}</span></td>
                  <td className="pr-3 font-bold text-star">{ratingsShown ? formatScore(e.overallScore) : 'Hidden'}</td>
                  <td className="pr-3 text-muted">{e.comments || '–'}</td>
                  <td className="whitespace-nowrap text-muted">{formatDate(e.submittedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// Shared by /student/projects/:id and /faculty/projects/:id.
export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const student = isStudent(user);
  const base = basePathFor(user);

  const { data, loading, error, reload } = useAsync(async () => {
    const project = await getProjectById(projectId);
    if (!project) return { project: null };
    const [aggregates, eligibility, status, received] = await Promise.all([
      getAggregates(),
      student ? getEligibility(user.id, project.groupId) : null,
      student ? getEvaluationStatus(user.id) : null,
      student ? [] : getEvaluationsForGroup(project.groupId, user),
    ]);
    return { project, aggregate: aggregates[project.groupId], eligibility, status, received };
  }, [projectId, user.id]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { project, aggregate, eligibility, status, received } = data;

  const back = (
    <Link to={student ? `${base}/explore` : `${base}/all-projects`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-primary">
      <ArrowLeft className="h-4 w-4" /> Back to projects
    </Link>
  );
  if (!project) return <>{back}<EmptyState title="Project not found" message="This project does not exist or was removed." /></>;

  const isOwn = student && project.groupId === user.groupId;

  return (
    <div className="space-y-6">
      {back}
      <section className="overflow-hidden rounded-card border border-line bg-white">
        <ProjectThumb project={project} className="max-h-64" />
        <div className="space-y-2 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-primary">{project.group?.groupName || 'Group information unavailable'}</p>
            {isOwn && <span className="badge-primary">My Group</span>}
          </div>
          <h1 className="text-2xl font-bold leading-snug sm:text-3xl">{project.title}</h1>
          <p className="max-w-4xl text-sm leading-6 text-muted">{project.description}</p>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3 p-5 sm:p-6"><h2 className="text-lg font-bold">Team members</h2><MemberList members={project.group?.members || []} /></section>
        <section className="card space-y-3 p-5 sm:p-6"><h2 className="text-lg font-bold">Project resources</h2><ResourceLinks project={project} /></section>
      </div>

      <section className="card space-y-3 p-5 sm:p-6"><h2 className="text-lg font-bold">Rating</h2><RatingSummary aggregate={aggregate} variant="full" /></section>

      {student && (
        <section className="card space-y-3 p-5 sm:p-6">
          <h2 className="text-lg font-bold">Evaluate this project</h2>
          <StudentEvaluateBox eligibility={eligibility} status={status} projectId={project.id} />
        </section>
      )}
      {!student && <ReceivedEvaluations evaluations={received} />}
    </div>
  );
}
