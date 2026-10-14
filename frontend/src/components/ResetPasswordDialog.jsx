import { useEffect, useRef, useState } from 'react';
import { Check, CircleAlert, CircleCheck, Copy, Eye, EyeOff, RefreshCw } from 'lucide-react';
import '../pages/admin/new-user.css'; // field and input styles shared with the New user form

// Same rules as the backend (users.controller.js). This gives instant
// feedback; the server repeats every check because it can't trust the browser.
const PASSWORD_MIN = 8;
const PASSWORD_MAX_BYTES = 72; // bcrypt ignores everything past 72 bytes

function passwordProblem(password) {
  if (!password) return 'Password is required.';
  if (password.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters.`;
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return 'Password is too long (72 bytes at most).';
  return '';
}

// No look-alike characters (0/O, 1/l/I) so it can be read out over the phone.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const UNBIASED_LIMIT = 256 - (256 % ALPHABET.length); // bytes above this are skipped so every character is equally likely

function generatePassword(length = 16) {
  let out = '';
  while (out.length < length) {
    for (const byte of crypto.getRandomValues(new Uint8Array(length * 2))) {
      if (byte < UNBIASED_LIMIT && out.length < length) out += ALPHABET[byte % ALPHABET.length];
    }
  }
  return out;
}

// Lets an administrator set a new password for another account.
//   user:      the table row ({ id, name, username, ... })
//   isSelf:    true when it's the signed-in administrator's own account
//   onSubmit(user, password): returns a promise. If it rejects, the message
//              is shown here and the dialog stays open.
//   onClose(didReset): called on Cancel, Esc, a click outside, or Done.
//
// After a successful reset the dialog shows the new password once, with a
// Copy button, because the administrator has to pass it on to the person.
export default function ResetPasswordDialog({ user, isSelf, onSubmit, onClose }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const dialogRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const copyRef = useRef(null);

  useEffect(() => { passwordRef.current?.focus(); }, []);
  // The fields disappear when the reset succeeds; put focus on the next useful thing.
  useEffect(() => { if (done) copyRef.current?.focus(); }, [done]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  // Esc closes; Tab stays inside the dialog.
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape' && !submitting) {
        onClose(done);
        return;
      }
      if (e.key !== 'Tab') return;
      const items = dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled])');
      if (!items || items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [submitting, done, onClose]);

  function clearError(field) {
    setBanner('');
    setErrors((e) => {
      if (!e[field]) return e;
      const next = { ...e };
      delete next[field];
      return next;
    });
  }

  function generate() {
    const next = generatePassword();
    setPassword(next);
    setConfirm(next);
    setShow(true); // the administrator needs to see what was made
    setErrors({});
    setBanner('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    const found = {};
    const problem = passwordProblem(password);
    if (problem) found.password = problem;
    if (!confirm) found.confirm = 'Confirm the password.';
    else if (confirm !== password) found.confirm = "Passwords don't match.";

    setErrors(found);
    setBanner('');
    if (found.password) { passwordRef.current?.focus(); return; }
    if (found.confirm) { confirmRef.current?.focus(); return; }

    setSubmitting(true);
    try {
      await onSubmit(user, password);
      setDone(true);
    } catch (err) {
      if (err.fields?.password) {
        setErrors({ password: err.fields.password });
        passwordRef.current?.focus();
      } else if (err.status >= 400 && err.status < 500 && err.message) {
        // 4xx messages come from the server and are meant to be read
        // ("... doesn't sign in, so there is no password to reset").
        setBanner(err.message);
      } else {
        setBanner('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(password);
      setCopyFailed(false);
      setCopied(true);
    } catch {
      setCopyFailed(true); // clipboard blocked; the password is selectable on screen
    }
  }

  const backdropClick = (e) => {
    if (e.target === e.currentTarget && !submitting) onClose(done);
  };

  return (
    <div className="up-backdrop" onMouseDown={backdropClick}>
      <div className="up-modal" role="dialog" aria-modal="true"
        aria-labelledby="reset-dialog-title" ref={dialogRef}>
        {done ? (
          <div role="status">
            <div className="rp-done">
              <CircleCheck size={34} className="rp-done__icon" />
              <h2 id="reset-dialog-title">Password reset</h2>
            </div>
            <p className="up-modal__who"><strong>{user.name}</strong>{user.username && <span className="muted"> · {user.username}</span>}</p>
            <p className="muted rp-text">
              {isSelf
                ? 'Your other devices were signed out. You stay signed in here.'
                : 'They were signed out everywhere and need this password to sign in.'}
              {' '}Share it securely. It won't be shown again once you close this.
            </p>

            <div className="rp-secret">
              <input readOnly value={password} aria-label="New password"
                onFocus={(e) => e.target.select()} spellCheck={false} />
              <button type="button" className="btn nu-btn-outline" ref={copyRef} onClick={copyPassword}>
                {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy</>}
              </button>
            </div>
            {copyFailed && <p className="nu-hint">Couldn't copy automatically. Select the password and copy it.</p>}

            <div className="up-modal__actions">
              <button type="button" className="btn btn--primary" onClick={() => onClose(true)}>Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <h2 id="reset-dialog-title">Reset password</h2>
            <p className="up-modal__who"><strong>{user.name}</strong>{user.username && <span className="muted"> · {user.username}</span>}</p>
            <p className="muted rp-text">
              {isSelf
                ? "This is your own account. You'll stay signed in here; your other devices will be signed out."
                : 'They will be signed out everywhere and will need the new password to sign in.'}
            </p>

            {banner && <p className="up-modal__error" role="alert"><CircleAlert size={15} /> {banner}</p>}

            <div className="nu-field">
              <div className="rp-label-row">
                <label htmlFor="rp-password">New password</label>
                <button type="button" className="link-btn rp-generate" onClick={generate} disabled={submitting}>
                  <RefreshCw size={13} /> Generate
                </button>
              </div>
              <div className="nu-input-wrap">
                <input id="rp-password" ref={passwordRef}
                  className={'nu-input' + (errors.password ? ' is-invalid' : '')}
                  type={show ? 'text' : 'password'} value={password} autoComplete="new-password"
                  onChange={(e) => { setPassword(e.target.value); clearError('password'); }}
                  aria-invalid={!!errors.password} aria-describedby="rp-password-msg" />
                <button type="button" className="nu-toggle" onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password
                ? <p className="nu-error" id="rp-password-msg" role="alert"><CircleAlert size={14} /> {errors.password}</p>
                : <p className="nu-hint" id="rp-password-msg">At least 8 characters.</p>}
            </div>

            <div className="nu-field">
              <label htmlFor="rp-confirm">Confirm password</label>
              <div className="nu-input-wrap">
                <input id="rp-confirm" ref={confirmRef}
                  className={'nu-input' + (errors.confirm ? ' is-invalid' : '')}
                  type={show ? 'text' : 'password'} value={confirm} autoComplete="new-password"
                  onChange={(e) => { setConfirm(e.target.value); clearError('confirm'); }}
                  aria-invalid={!!errors.confirm} aria-describedby="rp-confirm-msg" />
              </div>
              {errors.confirm && <p className="nu-error" id="rp-confirm-msg" role="alert"><CircleAlert size={14} /> {errors.confirm}</p>}
            </div>

            <div className="up-modal__actions">
              <button type="button" className="btn nu-btn-outline" onClick={() => onClose(false)} disabled={submitting}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? 'Saving…' : 'Reset password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
