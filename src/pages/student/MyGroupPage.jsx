
import { useRef, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import GroupProjectPanel from '../../components/GroupProjectPanel';
import { Loading, ErrorState, EmptyState } from '../../components/Feedback';
import { useAuth } from '../../context/AuthContext';
import { invalidateAsyncCache, useAsync } from '../../hooks/useAsync';
import {
  deleteProjectThumbnail,
  getProjectByGroupId,
  uploadProjectThumbnail
} from '../../services/projectService';
import { ArrowRight, Pencil, Trash2 } from 'lucide-react';
import { getAggregates, getEvaluationStatus } from '../../services/evaluationService';
import { Link } from 'react-router-dom';
import ConfirmDialog from '../../components/ConfirmDialog';

export default function MyGroupPage() {
  const { user } = useAuth();

  const fileInputRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [confirmingThumbnailDelete, setConfirmingThumbnailDelete] = useState(false);
  const [thumbnailOverride, setThumbnailOverride] = useState(undefined);

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

  const handleThumbnailUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setUploadError('');
    setUploadSuccess('');
    setUploading(true);

    try {
      const thumbnail = await uploadProjectThumbnail(file);
      setThumbnailOverride(thumbnail);
      invalidateAsyncCache();
      setUploadSuccess('Your project thumbnail has been updated.');
      reload();

    } catch (error) {
      setUploadError(error.message || 'Failed to upload project thumbnail.');
    } finally {
      setUploading(false);

      // Allows the user to select the same file again.
      event.target.value = '';
    }
  };

  const handleThumbnailDelete = async () => {
    setUploadError('');
    setUploadSuccess('');
    setUploading(true);

    try {
      await deleteProjectThumbnail();
      setThumbnailOverride(null);
      invalidateAsyncCache();
      setConfirmingThumbnailDelete(false);
      setUploadSuccess('Your project thumbnail has been deleted.');
      reload();
    } catch (error) {
      setUploadError(error.message || 'Failed to delete project thumbnail.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title={`Welcome, ${user.name.split(' ')[0]}`}
        subtitle="Your team’s showcase and evaluation progress."
        actions={
          <Link to="/student/explore" className="btn-primary">
            Explore projects <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-card border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-ink">Evaluation progress</p>
          <p className="mt-0.5 text-xs text-muted">
            Evaluate as many projects from other groups as you like. Your group is excluded.
          </p>
        </div>

        <p className="text-sm font-semibold text-emerald-800">
          {data.status.submitted} evaluation(s) submitted
        </p>
      </section>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Your project</h2>

        {data.project && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleThumbnailUpload}
              className="hidden"
              aria-label="Select project thumbnail"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="Change project thumbnail"
            >
              <Pencil className="h-4 w-4" />
              {uploading ? 'Updating...' : 'Edit thumbnail'}
            </button>
            {(thumbnailOverride === undefined
              ? data.project.thumbnail
              : thumbnailOverride) && (
              <button
                type="button"
                onClick={() => setConfirmingThumbnailDelete(true)}
                disabled={uploading}
                className="btn-danger-soft disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Delete project thumbnail"
              >
                <Trash2 className="h-4 w-4" />
                Delete thumbnail
              </button>
            )}
          </div>
        )}
      </div>

      {uploadError && (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {uploadError}
        </div>
      )}

      {uploadSuccess && (
        <div
          role="status"
          className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {uploadSuccess}
        </div>
      )}

      {uploading && (
        <p className="mb-3 text-xs text-muted">
          Please wait while your image is being uploaded.
        </p>
      )}

      {data.project ? (
        <GroupProjectPanel
          project={thumbnailOverride === undefined
            ? data.project
            : { ...data.project, thumbnail: thumbnailOverride, imageUrl: thumbnailOverride }}
          aggregate={data.aggregates[user.groupId]}
        />
      ) : (
        <EmptyState
          title="No group assigned"
          message="You have not been assigned to a group yet."
        />
      )}

      {data.project && (
        <p className="mt-3 text-xs text-muted">
          Accepted formats: JPG, PNG, and WebP. Maximum file size: 2 MB.
        </p>
      )}
      <ConfirmDialog
        open={confirmingThumbnailDelete}
        busy={uploading}
        onCancel={() => setConfirmingThumbnailDelete(false)}
        onConfirm={handleThumbnailDelete}
        title="Delete project thumbnail?"
        message="This will remove the thumbnail from your project"
        confirmLabel="Delete thumbnail"
        danger
      />
    </>
  );
}
