import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IdCard, KeyRound, Eye, EyeOff, LogIn } from 'lucide-react';
import FormField from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_HOME } from '../config/roles.js';

export default function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [show, setShow] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;

    setError('');
    setSubmitting(true);
    try {
      // Only username and password are sent. The server decides the role.
      const user = await signIn(username.trim(), password);
      navigate(ROLE_HOME[user.role] ?? '/login', { replace: true });
    } catch (err) {
      if (err.status === 401) setError('Invalid username or password');
      else if (err.status === 429) setError(err.message);
      else setError('Something went wrong. Please try again.');
      setPassword('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={handleSubmit}>
        <h1 className="login__title">Ovid Holdings</h1>
        <p className="login__sub">Enterprise Fleet Dispatch • Internal System by Ovid IT</p>

        <FormField id="username" name="username" label="Username" icon={IdCard}
          placeholder="e.g. j.vance@ovid-holdings.internal" autoComplete="username"
          value={username} onChange={(e) => setUsername(e.target.value)} />

        <FormField id="password" name="password" label="Password" icon={KeyRound}
          type={show ? 'text' : 'password'} autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)}
          trailing={
            <button type="button" className="icon-btn"
              aria-label={show ? 'Hide password' : 'Show password'}
              onClick={() => setShow((s) => !s)}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          } />

        {error && <p className="login__error" role="alert">{error}</p>}

        <button type="submit" className="btn btn--primary btn--block"
          disabled={submitting || !username || !password}>
          <LogIn size={18} /> {submitting ? 'Signing in…' : 'Sign In'} <kbd className="kbd--dark">ENTER ↵</kbd>
        </button>
      </form>
      <footer className="login__footer">Ovid Holdings • System by Ovid IT</footer>
    </div>
  );
}
