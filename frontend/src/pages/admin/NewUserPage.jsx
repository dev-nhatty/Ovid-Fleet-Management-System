import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, CircleAlert, CircleCheck, Info } from 'lucide-react';
import { ROLES, ROLE_LABELS } from '../../config/roles.js';
import { createUser } from '../../api/users.api.js';
import './new-user.css';

// What each role card says. `value` is the exact string stored in the database.
const ROLE_OPTIONS = [
  { value: ROLES.MANAGER, title: 'Officer', text: 'Handles trip requests, dispatch and fuel records' },
  { value: ROLES.DRIVER, title: 'Driver', text: 'Assigned to trips. Contacted by phone and does not sign in' },
  { value: ROLES.ADMIN, title: 'Admin', text: 'Manages users, vehicles and master data' },
];

const EMPTY_FORM = { name: '', phone: '', role: ROLES.MANAGER, username: '', password: '', confirm: '' };
const FIELD_ORDER = ['name', 'phone', 'role', 'username', 'password', 'confirm'];

// Same rules as the backend (users.controller.js). This gives instant
// feedback; the server repeats every check because it can't trust the browser.
function validate(v) {
  const errors = {};
  const isDriver = v.role === ROLES.DRIVER;

  const name = v.name.trim().replace(/\s+/g, ' ');
  if (!name) errors.name = 'Full name is required.';
  else if (name.length < 2) errors.name = 'Full name is too short.';
  else if (name.length > 150) errors.name = 'Full name can be at most 150 characters.';

  const phone = v.phone.trim();
  if (!phone) {
    if (isDriver) errors.phone = 'Phone is required for drivers.';
  } else {
    const digits = phone.replace(/\D/g, '');
    if (!/^\+?[0-9][0-9\s-]*$/.test(phone) || digits.length < 7 || digits.length > 15 || phone.length > 30) {
      errors.phone = 'Enter a valid phone number, e.g. +251 91 123 4567.';
    }
  }

  if (!isDriver) {
    const username = v.username.trim();
    if (!username) errors.username = 'Username is required.';
    else if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
      errors.username = 'Use 3-50 lowercase letters, numbers, dots, dashes or underscores.';
    }

    if (!v.password) errors.password = 'Password is required.';
    else if (v.password.length < 8) errors.password = 'Password must be at least 8 characters.';
    else if (new TextEncoder().encode(v.password).length > 72) errors.password = 'Password is too long (72 bytes at most).';

    if (!v.confirm) errors.confirm = 'Confirm the password.';
    else if (v.confirm !== v.password) errors.confirm = "Passwords don't match.";
  }

  return errors;
}

function Field({ id, label, required, optional, hint, error, children }) {
  return (
    <div className="nu-field">
      <label htmlFor={id}>
        {label}
        {required && <span className="nu-req" aria-hidden="true">*</span>}
        {optional && <span className="nu-opt">(optional)</span>}
      </label>
      {children}
      {error
        ? <p className="nu-error" id={`${id}-msg`} role="alert"><CircleAlert size={14} /> {error}</p>
        : hint && <p className="nu-hint" id={`${id}-msg`}>{hint}</p>}
    </div>
  );
}

function PasswordInput({ id, value, onChange, error, autoComplete, show, onToggle }) {
  return (
    <div className="nu-input-wrap">
      <input id={id} className={'nu-input' + (error ? ' is-invalid' : '')}
        type={show ? 'text' : 'password'} value={value} onChange={onChange}
        autoComplete={autoComplete} aria-invalid={!!error} aria-describedby={`${id}-msg`} />
      <button type="button" className="nu-toggle" onClick={onToggle}
        aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export default function NewUserPage() {
  const navigate = useNavigate();

  const [values, setValues] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isDriver = values.role === ROLES.DRIVER;

  function setField(field, value) {
    setValues((v) => ({ ...v, [field]: value }));
    setBanner('');
    if (errors[field]) {
      setErrors((e) => {
        const next = { ...e };
        delete next[field];
        return next;
      });
    }
  }

  function chooseRole(role) {
    setValues((v) => ({ ...v, role }));
    setBanner('');
    // Phone and credential rules depend on the role, so stale messages go.
    setErrors((e) => {
      const next = { ...e };
      ['phone', 'username', 'password', 'confirm', 'role'].forEach((k) => delete next[k]);
      return next;
    });
  }

  function focusFirstError(found) {
    const first = FIELD_ORDER.find((f) => found[f]);
    if (first) document.getElementById(`nu-${first}`)?.focus();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    const found = validate(values);
    setErrors(found);
    setBanner('');
    if (Object.keys(found).length > 0) {
      focusFirstError(found);
      return;
    }

    setSubmitting(true);
    try {
      const body = { name: values.name, phone: values.phone, role: values.role };
      if (!isDriver) {
        body.username = values.username.trim();
        body.password = values.password;
      }
      const user = await createUser(body);
      setCreated(user);
    } catch (err) {
      if (err.fields) {
        // The server's per-field messages (e.g. "username already taken")
        // land on the matching input.
        setErrors(err.fields);
        focusFirstError(err.fields);
      } else if (err.status === 403) {
        setBanner('You are not authorized to create users.');
      } else {
        setBanner('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  function startAnother() {
    setValues(EMPTY_FORM);
    setErrors({});
    setBanner('');
    setCreated(null);
    setShowPassword(false);
    setShowConfirm(false);
  }

  return (
    <>
      <Link to="/admin/users" className="nu-back"><ArrowLeft size={15} /> Back to users</Link>

      <div className="page-head">
        <div>
          <div className="eyebrow">ADMINISTRATION</div>
          <h1>New user</h1>
          <p className="muted lead">Create a sign-in account or register a driver</p>
        </div>
      </div>

      {created ? (
        <div className="nu-card nu-success" role="status">
          <CircleCheck size={44} className="nu-success__icon" />
          <h2>User created</h2>
          <p className="muted">{created.name} was added as {ROLE_LABELS[created.role] ?? created.role}.</p>
          <dl className="nu-summary">
            <dt>Name</dt><dd>{created.name}</dd>
            <dt>Role</dt><dd>{ROLE_LABELS[created.role] ?? created.role}</dd>
            <dt>Username</dt><dd>{created.username ?? 'None (does not sign in)'}</dd>
            <dt>Phone</dt><dd>{created.phone ?? 'Not provided'}</dd>
          </dl>
          <div className="nu-actions">
            <button type="button" className="btn nu-btn-outline" onClick={startAnother}>Create another</button>
            <Link to="/admin/users" className="btn btn--primary">Back to users</Link>
          </div>
        </div>
      ) : (
        <div className="nu-card">
          {banner && <div className="nu-banner" role="alert"><CircleAlert size={18} /> {banner}</div>}

          <form className="nu-form" onSubmit={handleSubmit} noValidate>
            <h2 className="nu-section">Account details</h2>

            <Field id="nu-name" label="Full name" required error={errors.name}>
              <input id="nu-name" className={'nu-input' + (errors.name ? ' is-invalid' : '')}
                value={values.name} onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. Dawit Haile" autoComplete="off" maxLength={150}
                aria-invalid={!!errors.name} aria-describedby="nu-name-msg" />
            </Field>

            <Field id="nu-phone" label="Phone" required={isDriver} optional={!isDriver}
              hint="Required for drivers, who are contacted by phone." error={errors.phone}>
              <input id="nu-phone" type="tel" className={'nu-input' + (errors.phone ? ' is-invalid' : '')}
                value={values.phone} onChange={(e) => setField('phone', e.target.value)}
                placeholder="e.g. +251 91 123 4567" autoComplete="off" maxLength={30}
                aria-invalid={!!errors.phone} aria-describedby="nu-phone-msg" />
            </Field>

            <fieldset className="nu-roles" id="nu-role">
              <legend className="nu-legend">Role<span className="nu-req" aria-hidden="true">*</span></legend>
              <div className="nu-roles__grid">
                {ROLE_OPTIONS.map((r) => (
                  <label key={r.value} className={'nu-role' + (values.role === r.value ? ' is-selected' : '')}>
                    <input type="radio" name="role" className="nu-sr" value={r.value}
                      checked={values.role === r.value} onChange={() => chooseRole(r.value)} />
                    <span className="nu-role__top"><span>{r.title}</span><span className="nu-role__dot" /></span>
                    <span className="nu-role__text">{r.text}</span>
                  </label>
                ))}
              </div>
              {errors.role && <p className="nu-error" role="alert"><CircleAlert size={14} /> {errors.role}</p>}
            </fieldset>

            <hr className="nu-divider" />

            {isDriver ? (
              <div className="nu-note">
                <Info size={16} />
                <span>Drivers don't sign in, so no username or password is needed. They are assigned to trips and contacted by phone.</span>
              </div>
            ) : (
              <>
                <h2 className="nu-section">Sign-in credentials</h2>

                <Field id="nu-username" label="Username" required
                  hint="Used to sign in. Lowercase letters, numbers, dots, dashes and underscores. Must be unique." error={errors.username}>
                  <input id="nu-username" className={'nu-input' + (errors.username ? ' is-invalid' : '')}
                    value={values.username} onChange={(e) => setField('username', e.target.value.toLowerCase())}
                    autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={50}
                    aria-invalid={!!errors.username} aria-describedby="nu-username-msg" />
                </Field>

                <Field id="nu-password" label="Password" required hint="At least 8 characters." error={errors.password}>
                  <PasswordInput id="nu-password" value={values.password} error={errors.password}
                    onChange={(e) => setField('password', e.target.value)} autoComplete="new-password"
                    show={showPassword} onToggle={() => setShowPassword((s) => !s)} />
                </Field>

                <Field id="nu-confirm" label="Confirm password" required error={errors.confirm}>
                  <PasswordInput id="nu-confirm" value={values.confirm} error={errors.confirm}
                    onChange={(e) => setField('confirm', e.target.value)} autoComplete="new-password"
                    show={showConfirm} onToggle={() => setShowConfirm((s) => !s)} />
                </Field>
              </>
            )}

            <div className="nu-actions">
              <button type="button" className="btn nu-btn-outline" onClick={() => navigate('/admin/users')}>Cancel</button>
              <button type="submit" className="btn btn--primary" disabled={submitting}>
                {submitting ? 'Creating…' : 'Create user'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
