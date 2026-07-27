import { NavLink, Route, Routes } from 'react-router-dom';
import AdminOverview from './AdminOverview';
import AdminNews from './AdminNews';
import AdminJournalists from './AdminJournalists';
import AdminTags from './AdminTags';
import AdminUsers from './AdminUsers';
import AdminReports from './AdminReports';
import AdminTomatoes from './AdminTomatoes';

const TABS = [
  { to: '', label: '概览', end: true },
  { to: 'news', label: '新闻' },
  { to: 'journalists', label: '记者' },
  { to: 'reports', label: '举报与仲裁' },
  { to: 'users', label: '用户与马甲' },
  { to: 'tags', label: '标签' },
  { to: 'tomatoes', label: '番茄治理' },
];

export default function AdminPage() {
  return (
    <div className="stack" style={{ gap: 18 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">CONTROL ROOM</div>
          <h1 className="page-title">管理台</h1>
          <div className="page-sub">编辑部与仲裁小组的共用后台。这里的每一次操作都会写进审计日志。</div>
        </div>
      </div>

      <div className="admin-layout">
        <nav className="admin-nav">
          {TABS.map((t) => (
            <NavLink key={t.to} to={`/admin/${t.to}`} end={t.end}>
              {t.label}
            </NavLink>
          ))}
        </nav>
        <div>
          <Routes>
            <Route index element={<AdminOverview />} />
            <Route path="news" element={<AdminNews />} />
            <Route path="journalists" element={<AdminJournalists />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="tags" element={<AdminTags />} />
            <Route path="tomatoes" element={<AdminTomatoes />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
