import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TomatoLayer, TomatoToolbar } from './TomatoLayer';

const NAV = [
  { to: '/', label: 'Front Page', end: true },
  { to: '/news', label: 'Stories' },
  { to: '/journalists', label: 'Contributors' },
  { to: '/tavern', label: 'The Newsroom' },
  { to: '/tavern/desk', label: 'My Desk' },
];

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  return (
    <div className="app-shell">
      <header className="masthead">
        <div className="masthead__inner">
          <Link to="/" className="brand">
            <img className="brand__mark" src="/know-morrow-mark.webp" alt="" />
            <span>KNOW MORROW<span className="brand__sub">NEWS &amp; UNFINISHED BUSINESS</span></span>
          </Link>
          <nav className="nav" aria-label="Primary navigation">
            {NAV.map((item) => <NavLink key={item.to} to={item.to} end={item.end}>{item.label}</NavLink>)}
            {user?.role === 'admin' && <NavLink to="/admin">Editor’s Desk</NavLink>}
          </nav>
          <div className="masthead__right">
            {user ? (
              <>
                <Link to="/wallet" className="coin-pill">🍅 {user.wallet.coins.toLocaleString('en-US')}</Link>
                <Link to="/masks" className="btn btn--sm">
                  {user.displayName}
                  {user.siteRole !== 'reader' && <span className="role-label">
                    {user.siteRole === 'superadmin' ? 'Supreme Admin' : user.siteRole === 'event_staff' ? 'Event Staff · Read only' : 'Journalist'}
                  </span>}
                </Link>
                <button className="btn btn--sm btn--ghost" onClick={logout}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn--sm">Sign in</Link>
                <Link to="/login" className="btn btn--sm btn--primary">Join with Discord</Link>
              </>
            )}
          </div>
        </div>
      </header>
      <main className={location.pathname.startsWith('/tavern') ? 'page page--wide' : 'page'}><Outlet /></main>
      <footer className="footer">
        <div className="footer__inner">
          <div><strong>Know Morrow News</strong> — Every tale can prove useful. Every story deserves to be told.</div>
          <div className="row" style={{ gap: 16 }}>
            <Link to="/tavern/rules">Submission rules</Link>
            <Link to="/tavern/disclosures">Disclosures</Link>
            <a href="https://discord.gg/u7ujs2wbXV" target="_blank" rel="noreferrer">Discord</a>
            <span className="footer__friends">Friend Links:</span>
            <a href="https://theciveventportal.online/" target="_blank" rel="noopener noreferrer">The Civ Event Portal ↗</a>
            <a href="https://lordeaux.app/" target="_blank" rel="noopener noreferrer">Lordeaux ↗</a>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
      <TomatoLayer />
      <TomatoToolbar />
    </div>
  );
}
