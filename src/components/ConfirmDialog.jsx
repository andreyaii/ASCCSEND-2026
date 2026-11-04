import Modal from './Modal';

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = false, busy = false, onConfirm, onCancel }) {
  const close = () => { if (!busy) onCancel?.(); };
  return (
    <Modal open={open} title={title} onClose={close}
      footer={<>
        <button className="btn-secondary" onClick={close} disabled={busy}>Cancel</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>{busy ? 'Please wait…' : confirmLabel}</button>
      </>}>
      {message}
    </Modal>
  );
}
