import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import StarRating from '../../components/StarRating';
import ConfirmDialog from '../../components/ConfirmDialog';
import EvaluationCounter from '../../components/EvaluationCounter';
import { Loading, ErrorState, EmptyState } from '../../components/Feedback';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { useAsync } from '../../hooks/useAsync';
import { getProjectById } from '../../services/projectService';
import { getEligibility, getEvaluationStatus, submitEvaluation } from '../../services/evaluationService';
import { getEvaluationCriteria } from '../../services/settingsService';
import { calcOverall, formatScore } from '../../utils/ratings';

export default function EvaluatePage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const { settings } = useSettings();
  const toast = useToast();
  const navigate = useNavigate();
  const [ratings, setRatings] = useState({});
  const [comments, setComments] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    const project = await getProjectById(projectId);
    if (!project) return { project: null };
    const [criteria, eligibility, status] = await Promise.all([
      getEvaluationCriteria(), getEligibility(user.id, project.groupId), getEvaluationStatus(user.id),
    ]);
    return { project, criteria, eligibility, status };
  }, [projectId, user.id]);

  const overall = useMemo(() => calcOverall(ratings), [ratings]);

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { project, criteria, eligibility, status } = data;
  const back = `/student/projects/${projectId}`;

  if (!project) return <EmptyState title="Project not found" action={<Link to="/student/explore" className="btn-secondary">Back to Explore</Link>} />;

  if (!eligibility.canEvaluate) {
    return (
      <div className="space-y-4">
        <Link to={back} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back to project</Link>
        <div className="card p-8 text-center">
          <Lock className="mx-auto mb-3 h-10 w-10 text-muted" />
          <h1 className="text-xl font-bold">Evaluation unavailable</h1>
          <p className="mt-1 text-sm text-muted">{eligibility.reason}</p>
        </div>
      </div>
    );
  }

  const complete = criteria.every((c) => Number.isInteger(ratings[c.id]) && ratings[c.id] >= 1 && ratings[c.id] <= 5);

  const submit = async () => {
    setBusy(true);
    try {
      await submitEvaluation({ evaluatorId: user.id, evaluatedGroupId: project.groupId, ratings, comments });
      toast.success('Evaluation submitted.');
      navigate('/student/evaluations', { replace: true });
    } catch (e) {
      toast.error(e.message || 'Could not submit the evaluation. Please try again.');
      setConfirming(false);
      setBusy(false);
      reload();
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to={back} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-primary"><ArrowLeft className="h-4 w-4" /> Back to project</Link>

      <header className="border-b border-line pb-4">
        <p className="mb-1 text-xs font-semibold text-primary">Project evaluation · {project.group?.groupName || 'Group'}</p>
        <h1 className="text-2xl font-bold leading-snug">{project.title}</h1>
        <p className="mt-1 text-sm text-muted">Rate each criterion from 1 to 5. All criteria are required; comments are optional.</p>
      </header>
      <EvaluationCounter status={status} />

      <form className="card p-5 sm:p-7" onSubmit={(e) => { e.preventDefault(); if (complete) setConfirming(true); }}>
        <p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900">Evaluation criteria are placeholders pending instructor confirmation. Current scoring gives each criterion equal weight.</p>

        <div className="divide-y divide-line">
        {criteria.map((c, index) => (
          <fieldset key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-2">
            <legend className="sr-only">{c.label}</legend>
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold text-muted">{index + 1}</span>
              <div><p className="text-sm font-bold">{c.label}</p><p className="mt-0.5 text-xs leading-5 text-muted">{c.description}</p></div>
            </div>
            <StarRating value={ratings[c.id] || 0} label={c.label} onChange={(v) => setRatings((r) => ({ ...r, [c.id]: v }))} />
          </fieldset>
        ))}
        </div>

        <div>
          <label className="form-label" htmlFor="comments">Comments (optional)</label>
          <textarea id="comments" rows={4} maxLength={settings.commentMaxLength} className="form-input resize-y" value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Share constructive feedback for this group…" />
          <p className="mt-1 text-right text-xs text-muted">{comments.length}/{settings.commentMaxLength}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-line py-4">
          <div><p className="text-sm font-bold">Overall rating</p><p className="text-xs text-muted">Equal-weight average</p></div>
          <p className="text-2xl font-bold text-primary">{complete ? formatScore(overall) : '–'} <span className="text-sm font-medium text-muted">/ 5</span></p>
        </div>

        {!complete && <p className="text-sm text-muted">Rate every criterion to enable submission.</p>}
        <div className="flex flex-col-reverse justify-end gap-2 border-t border-line pt-4 sm:flex-row">
          <Link to={back} className="btn-secondary">Cancel</Link>
          <button className="btn-primary" disabled={!complete || busy}>{busy ? 'Submitting…' : 'Submit Evaluation'}</button>
        </div>
      </form>

      <ConfirmDialog open={confirming} busy={busy} onCancel={() => setConfirming(false)} onConfirm={submit}
        title="Submit evaluation?" confirmLabel="Submit Evaluation"
        message={`Your evaluation of ${project.group.groupName} counts toward your limit of ${status.limit} and cannot be edited or resubmitted.`} />
    </div>
  );
}
