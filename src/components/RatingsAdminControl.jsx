import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { canToggleRatings } from '../utils/roles';

// Admin-only global ratings switch. Only changes display; evaluations are never touched.
export default function RatingsAdminControl() {
  const { user } = useAuth();
  const { settings, setRatingsVisible } = useSettings();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!import.meta.env?.DEV || !canToggleRatings(user)) return null;
  const visible = settings.ratingsVisible;

  const apply = async () => {
    setBusy(true);
    try {
      await setRatingsVisible(!visible);
      toast.success(visible ? 'All ratings are now hidden.' : 'All ratings are now visible.');
      setConfirming(false);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="card mb-6 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          {visible ? <Eye className="h-5 w-5 text-emerald-600" /> : <EyeOff className="h-5 w-5 text-amber-600" />}
          <div>
            <p className="text-sm font-bold">Ratings visibility <span className={visible ? 'badge-green ml-1' : 'badge-amber ml-1'}>{visible ? 'Visible' : 'Hidden'}</span></p>
            <p className="text-xs text-muted">Admin only. Applies to every page; evaluations are not changed.</p>
          </div>
        </div>
        <button className={visible ? 'btn-secondary' : 'btn-primary'} onClick={() => setConfirming(true)}>
          {visible ? <><EyeOff className="h-4 w-4" /> Hide All Ratings</> : <><Eye className="h-4 w-4" /> Unhide All Ratings</>}
        </button>
      </div>
      <ConfirmDialog open={confirming} busy={busy} onCancel={() => setConfirming(false)} onConfirm={apply}
        title={visible ? 'Hide all ratings?' : 'Unhide all ratings?'}
        confirmLabel={visible ? 'Hide All Ratings' : 'Unhide All Ratings'}
        message={visible
          ? 'Rating values and overall scores will be hidden for students and faculty. Evaluations, comments, and submissions are not affected.'
          : 'Ratings will be shown again (students still need results to be published to see them).'} />
    </>
  );
}
