import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [params] = useSearchParams();
  const { user, login, acceptToken } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get('discord_error') || '');

  useEffect(() => {
    const match = window.location.hash.match(/discord_token=([^&]+)/);
    if (!match) return;
    window.history.replaceState(null, '', window.location.pathname);
    void acceptToken(decodeURIComponent(match[1])).catch((err) => setError((err as Error).message));
  }, [acceptToken]);

  if (user) return <Navigate to="/" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(form.username, form.password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="km-login">
      <section className="km-login__intro">
        <img src="/know-morrow-mark.webp" alt="" />
        <div className="km-kicker">READER ACCESS</div>
        <h1>Keep your sources close.</h1>
        <p>New accounts are created exclusively through the Know Morrow Discord community.</p>
      </section>
      <section className="card card--pad stack km-login__card">
        <h2>Enter the newsroom</h2>
        <a className="btn km-discord btn--block" href="/api/auth/discord">Continue with Discord</a>
        <div className="km-or"><span>existing legacy account</span></div>
        <form className="stack" onSubmit={submit}>
          <label className="field"><span>Username</span><input className="input" required autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
          <label className="field"><span>Password</span><input className="input" required type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          {error && <div className="error-text">{error}</div>}
          <button className="btn btn--primary btn--block" disabled={busy}>{busy ? 'One moment…' : 'Sign in'}</button>
        </form>
        <p className="muted">No Discord account? Join the server first, then return here to sign in.</p>
      </section>
    </div>
  );
}
