import { NavLink, Route, Routes } from 'react-router-dom';
import AdminOverview from './AdminOverview';
import AdminNews from './AdminNews';
import AdminJournalists from './AdminJournalists';
import AdminTags from './AdminTags';
import AdminUsers from './AdminUsers';
import AdminReports from './AdminReports';
import AdminTomatoes from './AdminTomatoes';
import { AdminLanguageProvider, useAdminLanguage } from './AdminLanguage';

const TABS = [
  { to: '', en: 'Overview', zh: '概览', end: true },
  { to: 'news', en: 'News', zh: '新闻' },
  { to: 'journalists', en: 'Journalists', zh: '记者' },
  { to: 'reports', en: 'Reports & arbitration', zh: '举报与仲裁' },
  { to: 'users', en: 'Users & masks', zh: '用户与马甲' },
  { to: 'tags', en: 'Tags', zh: '标签' },
  { to: 'tomatoes', en: 'Tomato moderation', zh: '番茄管理' },
];

function AdminShell() {
  const { language, setLanguage, t } = useAdminLanguage();
  return <div className="stack" style={{ gap: 18 }}>
    <div className="page-head">
      <div><div className="eyebrow">CONTROL ROOM</div><h1 className="page-title">{t('Administration', '管理后台')}</h1><div className="page-sub">{t('Editorial and arbitration controls. Administrative actions are recorded in the audit log.', '编辑与仲裁控制中心。管理操作会记录在审计日志中。')}</div></div>
      <div className="admin-language" role="group" aria-label="Admin language">
        <button className={language === 'en' ? 'is-active' : ''} onClick={() => setLanguage('en')}>English</button>
        <button className={language === 'zh' ? 'is-active' : ''} onClick={() => setLanguage('zh')}>中文</button>
      </div>
    </div>
    <div className="admin-layout">
      <nav className="admin-nav">{TABS.map((tab) => <NavLink key={tab.to} to={`/admin/${tab.to}`} end={tab.end}>{t(tab.en, tab.zh)}</NavLink>)}</nav>
      <div><Routes><Route index element={<AdminOverview />} /><Route path="news" element={<AdminNews />} /><Route path="journalists" element={<AdminJournalists />} /><Route path="reports" element={<AdminReports />} /><Route path="users" element={<AdminUsers />} /><Route path="tags" element={<AdminTags />} /><Route path="tomatoes" element={<AdminTomatoes />} /></Routes></div>
    </div>
  </div>;
}

export default function AdminPage() {
  return <AdminLanguageProvider><AdminShell /></AdminLanguageProvider>;
}
