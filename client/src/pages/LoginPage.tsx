import { useEffect, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [params] = useSearchParams();
  const { user, login, acceptToken } = useAuth();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
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
      <section className="card km-login__card">
        <div className="km-login__discord">
          <div className="km-login__discord-mark" aria-hidden="true">✦</div>
          <div><div className="eyebrow">RECOMMENDED</div><h2>Continue with Discord</h2><p>Sign in securely and receive the permissions assigned to your server roles.</p></div>
          <a className="btn km-discord btn--block" href="/api/auth/discord">Continue with Discord</a>
          <p className="muted">No Discord account? <a href="https://discord.gg/u7ujs2wbXV" target="_blank" rel="noreferrer">Join the Know Morrow server</a> first.</p>
        </div>
        <button type="button" className="km-legacy-toggle" aria-expanded={showPasswordLogin} onClick={() => { setShowPasswordLogin((open) => !open); setError(''); }}>
          <span><strong>Use a test or legacy account</strong><small>Username and password access is reserved for authorized testing.</small></span>
          <span aria-hidden="true">{showPasswordLogin ? '−' : '+'}</span>
        </button>
        {showPasswordLogin && (
          <form className="stack km-legacy-form" onSubmit={submit}>
            <label className="field"><span>Username</span><input className="input" required autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
            <label className="field"><span>Password</span><input className="input" required type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn--primary btn--block" disabled={busy}>{busy ? 'One moment…' : 'Sign in with password'}</button>
          </form>
        )}
        {!showPasswordLogin && error && <div className="error-text">{error}</div>}
        <div className="km-login__legal">By continuing, you agree to the <Link to="/terms">Terms of Service</Link> and acknowledge the <Link to="/privacy">Privacy Policy</Link>.</div>
      </section>
    </div>
  );
}
