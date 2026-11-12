import { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../utils/roles';
import { resetEvaluations } from '../services/evaluationService';
import { resetSettings } from '../services/settingsService';
import ConfirmDialog from './ConfirmDialog';

// Destructive demo controls are development-only and administrator-only.
export const SHOW_DEMO_TOOLS = Boolean(import.meta.env?.DEV);

export default function DemoPanel() {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const { settings, setResultsPublished } = useSettings();
  const { user } = useAuth();
  const toast = useToast();
  if (!SHOW_DEMO_TOOLS || !isAdmin(user)) return null;

  const reset = async () => {
    setBusy(true);
    try {
      resetEvaluations(user);
      resetSettings(user);
      window.location.reload();
    } catch (error) {
      toast.error(error.message);
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[500]">
      {open && (
        <div className="card mb-2 w-72 space-y-3 p-4 text-sm">
          <p className="font-bold">Demo tools (local mock data)</p>
          <button className="btn-secondary w-full" onClick={() => setConfirming(true)}>Reset evaluations &amp; settings</button>
        </div>
      )}
      <button className="btn-primary ml-auto rounded-full shadow-lift" onClick={() => setOpen((o) => !o)} aria-label="Toggle demo tools"><FlaskConical className="h-4 w-4" /> Demo</button>
      <ConfirmDialog open={confirming} busy={busy} onCancel={() => setConfirming(false)} onConfirm={reset}
        title="Reset local demo data?" danger confirmLabel="Reset data"
        message="This replaces saved evaluations and display settings with the seeded demo values. Student, faculty, group, and project demo records are not modified. This cannot be undone." />
    </div>
  );
}
