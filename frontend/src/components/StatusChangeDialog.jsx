import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CircleAlert } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';

const tone = (status) => (status === 'Active' ? 'green' : 'gray');

// Asks "are you sure?" before flipping a user between Active and Inactive.
//   user:       the table row being changed ({ name, username, status, ... })
//   onCancel(): close without doing anything
//   onConfirm(user, newStatus): should return a promise; if it rejects, the
//               message is shown here and the dialog stays open.
export default function StatusChangeDialog({ user, onCancel, onConfirm }) {
  const next = user.status === 'Active' ? 'Inactive' : 'Active';
  const canSignIn = Boolean(user.username);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);

  // Start on the safe button, not the one that changes something.
  useEffect(() => { cancelRef.current?.focus(); }, []);

  // Esc closes; Tab stays inside the dialog.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape' && !submitting) {
        onCancel();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = dialogRef.current?.querySelectorAll('button:not([disabled])');
      if (!items || items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [submitting, onCancel]);

  async function confirm() {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(user, next);
      // On success the page closes this dialog, so there is nothing to reset.
    } catch (err) {
      // 4xx messages come from the server and are meant to be read
      // ("... has an active trip"). Anything else gets a generic line.
      setError(err.status >= 400 && err.status < 500 && err.message
        ? err.message
        : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  const consequence = next === 'Inactive'
    ? (canSignIn
        ? "They will be signed out and won't be able to sign in until reactivated. Their records are kept."
        : 'Their records are kept, and you can activate them again at any time.')
    : (canSignIn
        ? 'They will be able to sign in again.'
        : 'They will be active again.');

  return (
    <div className="up-backdrop"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !submitting) onCancel(); }}>
      <div className="up-modal" role="dialog" aria-modal="true" aria-labelledby="status-dialog-title" ref={dialogRef}>
        <h2 id="status-dialog-title">Change status</h2>

        <p className="up-modal__who"><strong>{user.name}</strong></p>
        <div className="up-modal__change" aria-label={`From ${user.status} to ${next}`}>
          <StatusBadge tone={tone(user.status)}>{user.status}</StatusBadge>
          <ArrowRight size={16} className="muted" />
          <StatusBadge tone={tone(next)}>{next}</StatusBadge>
        </div>
        <p className="muted">{consequence}</p>

        {error && <p className="up-modal__error" role="alert"><CircleAlert size={15} /> {error}</p>}

        <div className="up-modal__actions">
          <button type="button" className="btn nu-btn-outline" ref={cancelRef}
            onClick={onCancel} disabled={submitting}>Cancel</button>
          <button type="button" className="btn btn--primary" onClick={confirm} disabled={submitting}>
            {submitting ? 'Saving…' : `Set to ${next}`}
          </button>
        </div>
      </div>
    </div>
  );
}
