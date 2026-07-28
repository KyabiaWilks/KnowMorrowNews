import { useEffect, useState } from 'react';
import { get, patch } from '../../lib/api';
import type { User, Wallet } from '../../lib/types';
import { SearchBox, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { fmtDate, tmt } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useAdminLanguage } from './AdminLanguage';

type Row = { id: string; username: string; displayName: string; siteRole: User['siteRole']; banned: boolean; createdAt: string; wallet: Wallet; frozenFunds: number; identityDisclosed: boolean; profiles: { id: string; alias: string; retired: boolean }[] };

export default function AdminUsers() {
  const { t } = useAdminLanguage();
  const toast = useToast();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [query, setQuery] = useState('');
  const readOnly = !!user?.readOnly;
  const load = () => get<{ items: Row[] }>('/admin/users').then((result) => setRows(result.items));
  useEffect(() => { void load(); }, []);
  const act = async (id: string, body: Record<string, unknown>) => {
    try { await patch(`/admin/users/${id}`, body); await load(); toast.push(t('User updated.', '用户已更新。'), 'good'); }
    catch (error) { toast.push((error as Error).message, 'bad'); }
  };
  if (!rows) return <Spinner />;
  const roleName = (role: User['siteRole']) => ({
    user: t('User', '用户'), read_only_user: t('Read-only user', '只读用户'),
    journalist: t('Journalist', '记者'), admin: t('Administrator', '管理员'),
    read_only_admin: t('Read-only administrator', '只读管理员'),
  }[role]);
  const filtered = rows.filter((row) => !query || `${row.username} ${row.displayName}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="stack">
    <div className="row row--between"><h2>{t(`Users (${rows.length})`, `用户（${rows.length}）`)}</h2><SearchBox value={query} onChange={setQuery} placeholder={t('Search users…', '搜索用户…')} /></div>
    <div className="notice-banner">{t('Masks are private. They appear here only after a final public-disclosure sanction.', '马甲信息默认保密，只有最终裁决包含公开披露处分时才会在此显示。')}</div>
    {readOnly && <div className="notice-banner">{t('Your administrative access is read-only.', '你的管理权限为只读。')}</div>}
    <div className="card card--pad admin-table-scroll"><table className="table"><thead><tr><th>{t('Account', '账号')}</th><th>{t('Disclosure', '披露状态')}</th><th>{t('Wallet', '钱包')}</th><th>{t('Joined', '加入时间')}</th><th>{t('Status', '状态')}</th><th>{t('Role', '身份')}</th><th /></tr></thead><tbody>
      {filtered.map((row) => <tr key={row.id}>
        <td><strong>{row.username}</strong><div className="muted">{row.displayName}</div></td>
        <td>{row.identityDisclosed ? <div className="row"><span className="chip chip--danger">{t('Publicly disclosed', '已公开披露')}</span>{row.profiles.map((profile) => <span className="chip" key={profile.id}>{profile.alias}</span>)}</div> : <span className="muted">{t('Private', '保密')}</span>}</td>
        <td className="mono">{tmt(row.wallet.coins)}{row.wallet.escrow > 0 && <div className="muted">{t('Escrow', '托管')} {row.wallet.escrow}</div>}{row.frozenFunds > 0 && <div style={{ color: 'var(--bad)' }}>{t('Frozen', '冻结')} {row.frozenFunds}</div>}</td>
        <td>{fmtDate(row.createdAt)}</td><td>{row.banned ? <span className="chip chip--danger">{t('Suspended', '已封禁')}</span> : <span className="chip chip--good">{t('Active', '正常')}</span>}</td>
        <td><select className="select" value={row.siteRole} disabled={readOnly} onChange={(event) => act(row.id, { siteRole: event.target.value })}>{(['user', 'read_only_user', 'journalist', 'admin', 'read_only_admin'] as User['siteRole'][]).map((role) => <option value={role} key={role}>{roleName(role)}</option>)}</select></td>
        <td><button className={`btn btn--sm ${row.banned ? '' : 'btn--danger'}`} disabled={readOnly} onClick={() => { if (row.banned) void act(row.id, { banned: false }); else { const reason = window.prompt(t(`Reason for suspending ${row.username}:`, `封禁 ${row.username} 的原因：`)); if (reason) void act(row.id, { banned: true, banReason: reason }); } }}>{row.banned ? t('Restore', '恢复') : t('Suspend', '封禁')}</button></td>
      </tr>)}
    </tbody></table></div>
  </div>;
}
