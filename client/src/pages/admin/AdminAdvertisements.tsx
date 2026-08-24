import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { del, get, patch, post } from '../../lib/api';
import { SearchBox, Spinner } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { useAdminLanguage } from './AdminLanguage';

type Ad = { id: string; kind?: 'opening_alert'; title: string; body: string; imageUrl: string | null; href: string | null; placement: 'all' | 'home' | 'news'; includedIslands?: string[]; excludedIslands: string[]; excludedNations: string[]; active: boolean; startsAt: string | null; endsAt: string | null };
type Audience = { id: string; discordName: string; discordId: string | null; minecraftIgn: string | null; island: string | null; nation: string | null };
type AudienceResponse = { items: Audience[]; summary: { total: number; linked: number; islands: string[]; nations: string[] } };
type Draft = Omit<Ad, 'id' | 'startsAt' | 'endsAt'>;

const initialDraft: Draft = { title: '', body: '', imageUrl: null, href: null, placement: 'all', excludedIslands: ['Cold Island'], excludedNations: ['Lucentine'], active: true };

export default function AdminAdvertisements() {
  const { t } = useAdminLanguage();
  const toast = useToast();
  const { user } = useAuth();
  const [ads, setAds] = useState<Ad[] | null>(null);
  const [audience, setAudience] = useState<AudienceResponse | null>(null);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [query, setQuery] = useState('');
  const readOnly = !!user?.readOnly;
  const load = () => Promise.all([
    get<{ items: Ad[] }>('/admin/advertisements').then((result) => setAds(result.items)),
    get<AudienceResponse>('/admin/audience').then(setAudience),
  ]);
  useEffect(() => { void load(); }, []);
  const filteredAudience = useMemo(() => (audience?.items || []).filter((item) => !query || `${item.discordName} ${item.discordId || ''} ${item.minecraftIgn || ''} ${item.island || ''} ${item.nation || ''}`.toLowerCase().includes(query.toLowerCase())), [audience, query]);
  const toggle = (key: 'excludedIslands' | 'excludedNations', value: string) => setDraft((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] }));
  const create = async () => {
    try {
      await post('/admin/advertisements', draft);
      setDraft(initialDraft);
      await load();
      toast.push(t('Advertisement created.', '广告已创建。'), 'good');
    } catch (error) { toast.push((error as Error).message, 'bad'); }
  };
  if (!ads || !audience) return <Spinner />;
  const openingAlert = ads.find((item) => item.kind === 'opening_alert');
  return <div className="stack">
    <div className="row row--between"><h2>{t('Advertisements & audience', '广告与受众')}</h2><span className="chip">{audience.summary.linked}/{audience.summary.total} {t('linked', '已关联')}</span></div>
    <div className="notice-banner">{t('Discord IDs and imported membership data are available only through administrator endpoints. Targeted ads are hidden from unlinked accounts.', 'Discord ID 与导入的成员资料仅通过管理员接口提供。未关联账号不会看到定向广告。')}</div>
    {openingAlert && <section className="card card--pad stack admin-opening-alert-card"><div><div className="eyebrow">OPENING ALERT</div><h3>{t('Major Conflict warning', '重大冲突警报')}</h3><p className="muted">{t('Audience: linked Cold Island users whose nation is not Lucentine. It is inactive by default.', '受众：国家不是 Lucentine 的 Cold Island 已关联用户。默认处于停用状态。')}</p></div><div className="row"><Link className="btn" to="/preview/major-conflict-alert" target="_blank">{t('Preview alert', '预览弹窗')}</Link><button className={`btn ${openingAlert.active ? 'btn--danger' : 'btn--primary'}`} disabled={readOnly} onClick={() => void patch(`/admin/advertisements/${openingAlert.id}`, { active: !openingAlert.active }).then(load)}>{openingAlert.active ? t('Disable for everyone', '停止应用') : t('Enable for target audience', '一键启用弹窗')}</button><span className={`chip ${openingAlert.active ? 'chip--danger' : ''}`}>{openingAlert.active ? t('Active', '应用中') : t('Inactive', '未应用')}</span></div></section>}
    <section className="card card--pad stack">
      <h3>{t('Create advertisement', '创建广告')}</h3>
      <label className="field"><span>{t('Title', '标题')}</span><input className="input" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <label className="field"><span>{t('Copy', '文案')}</span><textarea className="textarea" value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} /></label>
      <div className="grid grid--2"><label className="field"><span>{t('Destination URL', '目标链接')}</span><input className="input" value={draft.href || ''} onChange={(event) => setDraft({ ...draft, href: event.target.value || null })} /></label><label className="field"><span>{t('Image URL', '图片链接')}</span><input className="input" value={draft.imageUrl || ''} onChange={(event) => setDraft({ ...draft, imageUrl: event.target.value || null })} /></label></div>
      <label className="field"><span>{t('Placement', '展示位置')}</span><select className="select" value={draft.placement} onChange={(event) => setDraft({ ...draft, placement: event.target.value as Draft['placement'] })}><option value="all">{t('Home + News', '首页 + 新闻页')}</option><option value="home">{t('Home only', '仅首页')}</option><option value="news">{t('News only', '仅新闻页')}</option></select></label>
      <div className="grid grid--2">
        <div className="field"><span>{t('Exclude islands', '排除岛屿')}</span><div className="row">{audience.summary.islands.map((value) => <label className="chip" key={value}><input type="checkbox" checked={draft.excludedIslands.includes(value)} onChange={() => toggle('excludedIslands', value)} /> {value}</label>)}</div></div>
        <div className="field"><span>{t('Exclude nations', '排除国家')}</span><div className="row">{audience.summary.nations.map((value) => <label className="chip" key={value}><input type="checkbox" checked={draft.excludedNations.includes(value)} onChange={() => toggle('excludedNations', value)} /> {value}</label>)}</div></div>
      </div>
      <div className="muted">{t('Current rule: show only to linked users outside the checked islands and nations.', '当前规则：仅向不属于已勾选岛屿和国家的已关联用户展示。')}</div>
      <button className="btn btn--primary" disabled={readOnly || !draft.title.trim()} onClick={() => void create()}>{t('Create advertisement', '创建广告')}</button>
    </section>
    <section className="card card--pad stack"><h3>{t(`Advertisements (${ads.filter((item) => item.kind !== 'opening_alert').length})`, `广告（${ads.filter((item) => item.kind !== 'opening_alert').length}）`)}</h3>{ads.filter((item) => item.kind !== 'opening_alert').length === 0 ? <div className="muted">{t('No standard advertisements yet.', '暂无普通广告。')}</div> : ads.filter((item) => item.kind !== 'opening_alert').map((ad) => <div className="row row--between" key={ad.id}><div><strong>{ad.title}</strong><div className="muted">{ad.placement} · {t('Exclude', '排除')}: {[...ad.excludedIslands, ...ad.excludedNations].join(', ') || t('none', '无')}</div></div><div className="row"><button className="btn btn--sm" disabled={readOnly} onClick={() => void patch(`/admin/advertisements/${ad.id}`, { active: !ad.active }).then(load)}>{ad.active ? t('Pause', '暂停') : t('Activate', '启用')}</button><button className="btn btn--sm btn--danger" disabled={readOnly} onClick={() => void del(`/admin/advertisements/${ad.id}`).then(load)}>{t('Delete', '删除')}</button></div></div>)}</section>
    <section className="card card--pad stack"><div className="row row--between"><h3>{t('Imported audience', '已导入受众')}</h3><SearchBox value={query} onChange={setQuery} placeholder={t('Search audience…', '搜索受众…')} /></div><div className="admin-table-scroll"><table className="table"><thead><tr><th>Discord</th><th>{t('Discord ID', 'Discord ID')}</th><th>Minecraft IGN</th><th>{t('Island', '岛屿')}</th><th>{t('Nation', '国家')}</th></tr></thead><tbody>{filteredAudience.slice(0, 200).map((item) => <tr key={item.id}><td>{item.discordName}</td><td className="mono">{item.discordId || <span className="muted">{t('Not linked', '未关联')}</span>}</td><td>{item.minecraftIgn || '—'}</td><td>{item.island || '—'}</td><td>{item.nation || '—'}</td></tr>)}</tbody></table></div>{filteredAudience.length > 200 && <div className="muted">{t(`Showing the first 200 of ${filteredAudience.length} matches.`, `显示 ${filteredAudience.length} 条匹配结果中的前 200 条。`)}</div>}</section>
  </div>;
}
