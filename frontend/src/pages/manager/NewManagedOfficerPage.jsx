import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, CircleAlert, CircleCheck, Info } from 'lucide-react';
import { createManagedOfficer } from '../../api/managedOfficers.api.js';
import './managed-officers.css';

const initial = { name: '', phone: '', username: '', password: '', confirmPassword: '' };

export default function NewManagedOfficerPage() {
  const navigate = useNavigate();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [banner, setBanner] = useState('');
  const [created, setCreated] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function update(key, value) {
    setValues(v => ({ ...v, [key]: value }));
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });
    setBanner('');
  }
  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    const next = {};
    const name = values.name.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 150) next.name = 'Enter a full name (2–150 characters).';
    if (values.phone.trim()) {
      const digits = values.phone.replace(/\D/g, '');
      if (!/^\+?[0-9][0-9\s-]*$/.test(values.phone.trim()) || digits.length < 7 || digits.length > 15) next.phone = 'Enter a valid phone number.';
    }
    if (!/^[a-z0-9._-]{3,50}$/.test(values.username.trim())) next.username = 'Use 3–50 lowercase letters, numbers, dots, dashes or underscores.';
    if (values.password.length < 8) next.password = 'Password must be at least 8 characters.';
    if (values.confirmPassword !== values.password) next.confirmPassword = "Passwords don't match.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setSubmitting(true);
    try {
      const result = await createManagedOfficer({ ...values, name, phone: values.phone.trim() });
      setCreated(result);
    } catch (err) {
      if (err.fields) setErrors(err.fields);
      else setBanner(err.status === 403 ? 'You are not authorized to create Officer accounts.' : (err.message || 'Something went wrong. Please try again.'));
    } finally { setSubmitting(false); }
  }
  function startAnother() { setValues(initial); setErrors({}); setBanner(''); setCreated(null); setShowPassword(false); setShowConfirm(false); }

  if (created) return (
    <section className="mo-page">
      <Link to="/manager/officers" className="mo-back"><ArrowLeft size={15}/> Back to officers</Link>
      <header className="mo-heading"><div className="mo-eyebrow">MANAGEMENT</div><h1>New officer</h1><p>Create an officer sign-in account</p></header>
      <div className="mo-success-card" role="status">
        <span className="mo-success-icon"><CircleCheck size={30}/></span>
        <h2>Officer created</h2>
        <p>{created.name} was added as Officer.</p>
        <dl className="mo-summary"><div><dt>Name</dt><dd>{created.name}</dd></div><div><dt>Role</dt><dd>Officer</dd></div><div><dt>Username</dt><dd>{created.username}</dd></div><div><dt>Phone</dt><dd>{created.phone || 'Not provided'}</dd></div></dl>
        <div className="mo-actions"><button className="mo-button" onClick={startAnother}>Create another</button><button className="mo-button mo-button--primary" onClick={() => navigate('/manager/officers')}>Back to officers</button></div>
      </div>
      <p className="mo-footnote"><Info size={15}/> The new account has standard Officer permissions.</p>
    </section>
  );

  return (
    <section className="mo-page">
      <Link to="/manager/officers" className="mo-back"><ArrowLeft size={15}/> Back to officers</Link>
      <header className="mo-heading"><div className="mo-eyebrow">MANAGEMENT</div><h1>New officer</h1><p>Create an officer sign-in account</p></header>
      <div className="mo-form-card">
        {banner && <div className="mo-banner" role="alert"><CircleAlert size={17}/>{banner}</div>}
        <form onSubmit={submit} noValidate>
          <div className="mo-info"><Info size={18}/><span>This account will be created as an Officer. Officers handle trip requests, dispatch and fuel records.</span></div>
          <h2 className="mo-section">Account details</h2>
          <Field label="Full name" required error={errors.name}><input value={values.name} onChange={e=>update('name',e.target.value)} placeholder="e.g. Dawit Haile" maxLength={150}/></Field>
          <Field label="Phone" optional error={errors.phone}><input type="tel" value={values.phone} onChange={e=>update('phone',e.target.value)} placeholder="e.g. +251 91 123 4567" maxLength={30}/></Field>
          <h2 className="mo-section mo-section--credentials">Sign-in credentials</h2>
          <Field label="Username" required hint="Lowercase letters, numbers, dots, dashes and underscores. Must be unique." error={errors.username}><input value={values.username} onChange={e=>update('username',e.target.value.toLowerCase())} placeholder="e.g. dawit.h" autoCapitalize="none" spellCheck={false} maxLength={50}/></Field>
          <Field label="Password" required hint="At least 8 characters." error={errors.password}><Password value={values.password} show={showPassword} toggle={()=>setShowPassword(v=>!v)} onChange={v=>update('password',v)}/></Field>
          <Field label="Confirm password" required error={errors.confirmPassword}><Password value={values.confirmPassword} show={showConfirm} toggle={()=>setShowConfirm(v=>!v)} onChange={v=>update('confirmPassword',v)}/></Field>
          <div className="mo-actions"><button type="button" className="mo-button" onClick={()=>navigate('/manager/officers')}>Cancel</button><button type="submit" className="mo-button mo-button--primary" disabled={submitting}>{submitting ? 'Creating…' : 'Create officer'}</button></div>
        </form>
      </div>
    </section>
  );
}
function Field({label,required,optional,hint,error,children}) {
  return <div className="mo-field"><label>{label}{required && <span className="mo-required"> *</span>}{optional && <span className="mo-optional"> (optional)</span>}</label>{children}{error ? <small className="mo-error">{error}</small> : hint ? <small className="mo-hint">{hint}</small> : null}</div>;
}
function Password({value,onChange,show,toggle}) {
  return <div className="mo-password"><input type={show?'text':'password'} value={value} onChange={e=>onChange(e.target.value)} autoComplete="new-password"/><button type="button" onClick={toggle} aria-label={show?'Hide password':'Show password'}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div>;
}
