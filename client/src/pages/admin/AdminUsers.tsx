import { useEffect, useState } from 'react';
import { get, patch } from '../../lib/api';
import type { User, Wallet } from '../../lib/types';
import { SearchBox, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { fmtDate, tmt } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';

type Row = {
  id: string;
  username: string;
  displayName: string;
  siteRole: User['siteRole'];
  banned: boolean;
  banReason: string | null;
  createdAt: string;
  wallet: Wallet;
  frozenFunds: number;
  profiles: { id: string; alias: string; retired: boolean }[];
};

const ROLE_LABEL: Record<User['siteRole'], string> = {
  user: 'User',
  journalist: 'Journalist',
  admin: 'Administrator',
  read_only_admin: 'Read-only administrator',
};

export default function AdminUsers() {
  const toast = useToast();
  const { user } = useAuth();
  const readOnly = !!user?.readOnly;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState('');
  const load = () => get<{ items: Row[] }>('/admin/users').then((result) => setRows(result.items));
  useEffect(() => { void load(); }, []);

  const act = async (id: string, body: Record<string, unknown>) => {
    try {
      await patch(`/admin/users/${id}`, body);
      await load();
      toast.push('User updated.', 'good');
    } catch (error) {
      toast.push((error as Error).message, 'bad');
    }
  };

  if (!rows) return <Spinner />;
  const filtered = rows.filter((row) => !q || row.username.toLowerCase().includes(q.toLowerCase()) || row.displayName.toLowerCase().includes(q.toLowerCase()) || row.profiles.some((profile) => profile.alias.toLowerCase().includes(q.toLowerCase())));

  return <div className="stack">
    <div className="row row--between">
      <h2 style={{ fontSize: 20 }}>Users and masks ({rows.length})</h2>
      <SearchBox value={q} onChange={setQ} placeholder="Search usernames or masks…" />
    </div>
    <div className="notice-banner">Account-to-mask relationships are visible here for arbitration. Use this information only when handling a report.</div>
    {readOnly && <div className="notice-banner">Your Event Staff role has read-only administrative access. Official wallet transfers remain available from the wallet page.</div>}
    <div className="card card--pad">
      <table className="table">
        <thead><tr><th>Account</th><th>Masks</th><th>Wallet</th><th>Joined</th><th>Status</th><th>Role</th><th /></tr></thead>
        <tbody>{filtered.map((row) => <tr key={row.id}>
          <td><div style={{ fontWeight: 650 }}>{row.username}</div><div className="muted">{row.displayName}</div></td>
          <td><div className="row" style={{ gap: 4 }}>{row.profiles.length === 0 && <span className="muted">—</span>}{row.profiles.map((profile) => <span key={profile.id} className={`chip ${profile.retired ? 'chip--danger' : ''}`}>{profile.alias}</span>)}</div></td>
          <td className="mono"><div>{tmt(row.wallet.coins)}</div>{row.wallet.escrow > 0 && <div className="muted">Escrow {row.wallet.escrow}</div>}{row.frozenFunds > 0 && <div style={{ color: 'var(--bad)' }}>Frozen {row.frozenFunds}</div>}</td>
          <td className="mono">{fmtDate(row.createdAt)}</td>
          <td>{row.banned ? <div><span className="chip chip--danger">Suspended</span><div className="muted">{row.banReason}</div></div> : <span className="chip chip--good">Active</span>}</td>
          <td><select className="select" value={row.siteRole} disabled={readOnly} onChange={(event) => act(row.id, { siteRole: event.target.value })}>{Object.entries(ROLE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td>
          <td><button className={`btn btn--sm ${row.banned ? '' : 'btn--danger'}`} disabled={readOnly} onClick={() => {
            if (row.banned) return act(row.id, { banned: false });
            const reason = window.prompt(`Reason for suspending ${row.username}:`);
            if (reason) void act(row.id, { banned: true, banReason: reason });
          }}>{row.banned ? 'Restore' : 'Suspend'}</button></td>
        </tr>)}</tbody>
      </table>
    </div>
  </div>;
}
