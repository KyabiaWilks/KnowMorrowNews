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

  return <div className="stack" style={{ gap: 20 }}>
    <div className="page-head"><div><div className="eyebrow">ACCOUNT PROFILE</div><h1 className="page-title">{user.displayName}</h1><div className="page-sub">Manage the identities used to recognize you in transfers and newsroom tools.</div></div></div>
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
      {user.minecraftUuid && <div className="row"><img className="mc-avatar" src={`https://crafatar.com/avatars/${user.minecraftUuid}?size=64&overlay`} alt="" /><a href={`https://namemc.com/profile/${user.minecraftUuid}`} target="_blank" rel="noreferrer">View {user.minecraftId} on NameMC ↗</a></div>}
    </section>
    <section className="card card--pad row row--between"><div><strong>Masks</strong><div className="muted">Manage your anonymous Newsroom identities.</div></div><Link className="btn" to="/masks">Manage masks</Link></section>
  </div>;
}
