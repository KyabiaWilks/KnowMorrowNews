import { useEffect, useState } from 'react';
import { get, patch } from '../../lib/api';
import type { User, Wallet } from '../../lib/types';
import { SearchBox, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { fmtDate, tmt } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import { useAdminLanguage } from './AdminLanguage';

type Row = { id: string; username: string; displayName: string; siteRole: User['siteRole']; banned: boolean; banReason: string | null; createdAt: string; wallet: Wallet; frozenFunds: number; profiles: { id: string; alias: string; retired: boolean }[] };

export default function AdminUsers() {
  const { t } = useAdminLanguage();
  const toast = useToast();
  const { user } = useAuth();
  const readOnly = !!user?.readOnly;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [query, setQuery] = useState('');
  const load = () => get<{ items: Row[] }>('/admin/users').then((result) => setRows(result.items));
  useEffect(() => { void load(); }, []);
  const act = async (id: string, body: Record<string, unknown>) => { try { await patch(`/admin/users/${id}`, body); await load(); toast.push(t('User updated.', '用户已更新。'), 'good'); } catch (error) { toast.push((error as Error).message, 'bad'); } };
  if (!rows) return <Spinner />;
  const roleLabel = (role: User['siteRole']) => ({ user: t('User', '用户'), journalist: t('Journalist', '记者'), admin: t('Administrator', '管理员'), read_only_admin: t('Read-only administrator', '只读管理员') }[role]);
  const filtered = rows.filter((row) => !query || [row.username, row.displayName, ...row.profiles.map((profile) => profile.alias)].some((value) => value.toLowerCase().includes(query.toLowerCase())));
  return <div className="stack">
    <div className="row row--between"><h2>{t(`Users and masks (${rows.length})`, `用户与马甲（${rows.length}）`)}</h2><SearchBox value={query} onChange={setQuery} placeholder={t('Search users or masks…', '搜索用户或马甲…')} /></div>
    <div className="notice-banner">{t('Account-to-mask relationships are visible for arbitration. Use this information only for authorized moderation.', '账号与马甲的关联仅供仲裁使用。请仅在授权管理工作中使用这些信息。')}</div>
    {readOnly && <div className="notice-banner">{t('Your access is read-only.', '你的访问权限为只读。')}</div>}
    <div className="card card--pad admin-table-scroll"><table className="table"><thead><tr><th>{t('Account', '账号')}</th><th>{t('Masks', '马甲')}</th><th>{t('Wallet', '钱包')}</th><th>{t('Joined', '加入时间')}</th><th>{t('Status', '状态')}</th><th>{t('Role', '身份')}</th><th /></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><strong>{row.username}</strong><div className="muted">{row.displayName}</div></td><td><div className="row">{row.profiles.length === 0 && <span className="muted">—</span>}{row.profiles.map((profile) => <span key={profile.id} className={`chip ${profile.retired ? 'chip--danger' : ''}`}>{profile.alias}</span>)}</div></td><td className="mono">{tmt(row.wallet.coins)}{row.wallet.escrow > 0 && <div className="muted">{t('Escrow', '托管')} {row.wallet.escrow}</div>}{row.frozenFunds > 0 && <div style={{ color: 'var(--bad)' }}>{t('Frozen', '冻结')} {row.frozenFunds}</div>}</td><td>{fmtDate(row.createdAt)}</td><td>{row.banned ? <span className="chip chip--danger">{t('Suspended', '已封禁')}</span> : <span className="chip chip--good">{t('Active', '正常')}</span>}</td><td><select className="select" value={row.siteRole} disabled={readOnly} onChange={(event) => act(row.id, { siteRole: event.target.value })}>{(['user', 'journalist', 'admin', 'read_only_admin'] as User['siteRole'][]).map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></td><td><button className={`btn btn--sm ${row.banned ? '' : 'btn--danger'}`} disabled={readOnly} onClick={() => { if (row.banned) return act(row.id, { banned: false }); const reason = window.prompt(t(`Reason for suspending ${row.username}:`, `封禁 ${row.username} 的原因：`)); if (reason) void act(row.id, { banned: true, banReason: reason }); }}>{row.banned ? t('Restore', '恢复') : t('Suspend', '封禁')}</button></td></tr>)}</tbody></table></div>
  </div>;
}
