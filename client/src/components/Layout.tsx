import { useEffect, useState } from 'react';
import { NavLink, Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { TomatoLayer, TomatoToolbar } from './TomatoLayer';
import { NotificationBell } from './NotificationBell';

const NAV = [
  { to: '/', label: 'Front Page', end: true },
  { to: '/news', label: 'News' },
  { to: '/journalists', label: 'Contributors' },
  { to: '/tavern', label: 'The Tavern' },
  { to: '/desk', label: 'My Desk' },
];

function roleLabel(role: string) {
  if (role === 'admin') return 'Administrator';
  if (role === 'read_only_admin') return 'Read-only administrator';
  if (role === 'journalist') return 'Journalist';
  return 'Reader';
}

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isEditor = Boolean(user && ['admin', 'read_only_admin'].includes(user.siteRole));

  useEffect(() => setMobileOpen(false), [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileOpen]);

  const signOut = () => {
    setMobileOpen(false);
    logout();
  };

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
            {isEditor && <NavLink to="/admin">Editor’s Desk</NavLink>}
          </nav>
          <div className="masthead__right desktop-header-actions">
            {user ? (
              <>
                <Link to="/wallet" className="coin-pill">🍅 {user.wallet.coins.toLocaleString('en-US')}</Link>
                <NotificationBell />
                <Link to="/profile" className="btn btn--sm">
                  {user.displayName}
                  {user.siteRole !== 'user' && <span className="role-label">{roleLabel(user.siteRole)}</span>}
                </Link>
                <button className="btn btn--sm btn--ghost" onClick={signOut}>Sign out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn--sm">Sign in</Link>
                <Link to="/login" className="btn btn--sm btn--primary">Join with Discord</Link>
              </>
            )}
          </div>
          <div className="mobile-header-actions">
            {user && <Link to="/wallet" className="coin-pill" aria-label={`${user.wallet.coins} Tomato Coins`}>🍅 {user.wallet.coins.toLocaleString('en-US')}</Link>}
            {user && <NotificationBell />}
            <button
              type="button"
              className="mobile-menu-button"
              aria-label="Open navigation"
              aria-controls="mobile-navigation"
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(true)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <button
        type="button"
        className={`mobile-drawer-backdrop${mobileOpen ? ' is-open' : ''}`}
        aria-label="Close navigation"
        tabIndex={mobileOpen ? 0 : -1}
        onClick={() => setMobileOpen(false)}
      />
      <aside id="mobile-navigation" className={`mobile-drawer${mobileOpen ? ' is-open' : ''}`} aria-hidden={!mobileOpen}>
        <div className="mobile-drawer__head">
          <div>
            <span className="eyebrow">KNOW MORROW NEWS</span>
            <strong>Navigation</strong>
          </div>
          <button type="button" className="mobile-drawer__close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}>×</button>
        </div>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {NAV.map((item) => <NavLink key={item.to} to={item.to} end={item.end}>{item.label}<span aria-hidden="true">→</span></NavLink>)}
          {isEditor && <NavLink to="/admin">Editor’s Desk<span aria-hidden="true">→</span></NavLink>}
        </nav>
        <div className="mobile-drawer__account">
          {user ? (
            <>
              <div className="mobile-account-card">
                <div className="mobile-account-card__avatar">
                  {user.avatar ? <img src={user.avatar} alt="" /> : user.displayName.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <strong>{user.displayName}</strong>
                  <span>@{user.username}</span>
                  <span>{roleLabel(user.siteRole)}</span>
                </div>
              </div>
              <div className="mobile-account-links">
                <Link to="/profile">Profile</Link>
                <Link to="/wallet">Wallet</Link>
                <Link to="/notifications">Notifications</Link>
                <Link to="/masks">Masks</Link>
              </div>
              <button className="btn btn--ghost mobile-signout" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <div className="stack">
              <Link to="/login" className="btn">Sign in</Link>
              <Link to="/login" className="btn btn--primary">Join with Discord</Link>
            </div>
          )}
        </div>
      </aside>

      <main className={location.pathname.startsWith('/tavern') ? 'page page--tavern' : 'page'}><Outlet /></main>
      <footer className="footer">
        <div className="footer__inner">
          <div><strong>Know Morrow News</strong> — Every tale can prove useful. Every story deserves to be told.</div>
          <div className="row" style={{ gap: 16 }}>
            <Link to="/tavern/rules">Submission rules</Link>
            <Link to="/tavern/disclosures">Disclosures</Link>
            <a href="https://discord.gg/u7ujs2wbXV" target="_blank" rel="noreferrer">Discord</a>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>
      <TomatoLayer />
      <TomatoToolbar />
    </div>
  );
}
