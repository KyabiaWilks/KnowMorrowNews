import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { patch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [minecraftId, setMinecraftId] = useState(user?.minecraftId || '');
  const [busy, setBusy] = useState(false);
  useEffect(() => setMinecraftId(user?.minecraftId || ''), [user?.minecraftId]);
  if (!user) return null;

  const save = async () => {
    setBusy(true);
    try {
      await patch('/auth/me', { minecraftId });
      await refresh();
      toast.push(minecraftId ? 'Minecraft profile verified and saved.' : 'Minecraft profile removed.', 'good');
    } catch (error) {
      toast.push((error as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  const markDeparted = async () => {
    const confirmation = window.prompt('This is permanent. Your account will become read-only, every mask will be retired, and your name will enter the Memorial Hall. Existing Tavern listings will remain available. Type I HAVE DEPARTED to continue.');
    if (confirmation !== 'I HAVE DEPARTED') {
      if (confirmation !== null) toast.push('The confirmation phrase did not match. No changes were made.', 'info');
      return;
    }
    setBusy(true);
    try {
      await patch('/auth/me', { departed: true, confirmation });
      await refresh();
      toast.push('Your account has entered the Memorial Hall and is now read-only.', 'good');
    } catch (error) {
      toast.push((error as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  return <div className="stack" style={{ gap: 20 }}>
    <div className="page-head"><div><div className="eyebrow">ACCOUNT PROFILE</div><h1 className="page-title">{user.displayName}</h1><div className="page-sub">Manage the identities used to recognize you in transfers and Tavern tools.</div></div></div>
    <section className="card card--pad profile-identity">
      <div className="profile-identity__avatar">{user.avatar ? <img src={user.avatar} alt="" /> : user.displayName.slice(0, 1).toUpperCase()}</div>
      <div className="stack" style={{ gap: 5 }}>
        <strong>{user.displayName}</strong>
        <span className="mono">@{user.username}</span>
        <span className="muted">{user.siteRole.replaceAll('_', ' ')}</span>
      </div>
    </section>
    <section className="card card--pad stack">
      <div><div className="eyebrow">MINECRAFT JAVA</div><h2>Register an MC ID</h2><p className="muted">The ID is verified against Mojang and can then be used to find you in the transfer recipient search.</p></div>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: 1 }}><span>MC ID</span><input className="input" value={minecraftId} onChange={(event) => setMinecraftId(event.target.value)} placeholder="Minecraft username" maxLength={16} /></label>
        <button className="btn btn--primary" disabled={busy} onClick={save}>{busy ? 'Verifying…' : 'Verify and save'}</button>
      </div>
      {user.minecraftUuid && <div className="row"><img className="mc-avatar" src={`/api/auth/minecraft-avatar/${user.minecraftUuid}`} alt={`${user.minecraftId || 'Minecraft'} avatar`} /><div><strong>{user.minecraftId}</strong><div className="muted">Verified through Mojang</div></div></div>}
    </section>
    <section className="card card--pad row row--between"><div><strong>Masks</strong><div className="muted">Manage your anonymous Tavern identities.</div></div><Link className="btn" to="/tavern/desk?tab=masks">Manage masks</Link></section>
    <section className="card card--pad row row--between" style={{ borderColor: 'rgba(130, 104, 88, .55)' }}>
      <div><div className="eyebrow">MEMORIAL STATUS</div><strong>{user.departedAt ? 'You are remembered in the Memorial Hall' : 'I have departed'}</strong><div className="muted">{user.departedAt ? 'This account is permanently read-only.' : 'Permanently retire every mask, convert this account to read-only, and place your public name in the Contributors Memorial Hall.'}</div></div>
      {!user.departedAt && <button className="btn btn--danger" disabled={busy} onClick={() => void markDeparted()}>I have departed</button>}
    </section>
  </div>;
}
