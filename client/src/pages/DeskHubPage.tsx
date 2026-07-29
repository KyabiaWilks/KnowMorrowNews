import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function DeskHubPage() {
  const { user } = useAuth();
  const editorial = user && ['journalist', 'admin', 'read_only_admin'].includes(user.siteRole);
  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">MY DESK</div>
          <h1 className="page-title">Choose a desk</h1>
          <div className="page-sub">Manage Tavern activity or prepare reporting for Know Morrow News.</div>
        </div>
      </div>
      <div className={`grid ${editorial ? 'grid--2' : ''}`}>
        <Link to="/tavern/desk" className="card card--pad card--hover stack desk-hub__card">
          <div style={{ fontSize: 34 }}>🍺</div>
          <h2>The Tavern Desk</h2>
          <p className="muted">Review listings, requests, unlocked intelligence, submissions and arbitration reports.</p>
          <span className="btn btn--primary desk-hub__action">Open Tavern Desk →</span>
        </Link>
        {editorial && (
          <Link to="/desk/news" className="card card--pad card--hover stack desk-hub__card">
            <div style={{ fontSize: 34 }}>📰</div>
            <h2>News Desk</h2>
            <p className="muted">{user?.readOnly ? 'Review published news and drafts in read-only mode.' : 'Write, save and publish reporting to the News section.'}</p>
            <span className="btn btn--primary desk-hub__action">Open News Desk →</span>
          </Link>
        )}
      </div>
    </div>
  );
}
