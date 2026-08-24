import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useAuth } from './context/AuthContext';
import { Spinner } from './components/ui';
import { ErrorBoundary } from './components/ErrorBoundary';

import HomePage from './pages/HomePage';
import NewsPage from './pages/NewsPage';
import ArticlePage from './pages/ArticlePage';
import JournalistsPage from './pages/JournalistsPage';
import JournalistPage from './pages/JournalistPage';
import TavernPage from './pages/tavern/TavernPage';
import OfferPage from './pages/tavern/OfferPage';
import RequestPage from './pages/tavern/RequestPage';
import ComposePage from './pages/tavern/ComposePage';
import DeskPage from './pages/tavern/DeskPage';
import RulesPage from './pages/tavern/RulesPage';
import DisclosuresPage from './pages/tavern/DisclosuresPage';
import WalletPage from './pages/WalletPage';
import LoginPage from './pages/LoginPage';
import AdminPage from './pages/admin/AdminPage';
import GhostPage from './pages/ghost/GhostPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';
import DeskHubPage from './pages/DeskHubPage';
import NewsDeskPage from './pages/NewsDeskPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import LeadershipVotePage from './pages/LeadershipVotePage';
import ContributorHonorsPage from './pages/ContributorHonorsPage';
import MajorConflictPreview from './pages/admin/MajorConflictPreview';
import TheGunRatQuotesPage from './pages/TheGunRatQuotesPage';

function RequireAuth({ children, admin, editorial }: { children: JSX.Element; admin?: boolean; editorial?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && !['admin', 'read_only_admin'].includes(user.siteRole)) return <Navigate to="/" replace />;
  if (editorial && !['journalist', 'admin', 'read_only_admin'].includes(user.siteRole) && !user.editorialScope) return <Navigate to="/desk" replace />;
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/ghost/*" element={<GhostPage />} />
        <Route path="/preview/major-conflict-alert" element={<MajorConflictPreview />} />

        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="news" element={<NewsPage />} />
          <Route path="news/:id" element={<ArticlePage />} />
          <Route path="thegunrat-quotes" element={<TheGunRatQuotesPage />} />
          <Route path="journalists" element={<JournalistsPage />} />
          <Route path="journalists/hall-of-fame" element={<ContributorHonorsPage kind="hallOfFame" />} />
          <Route path="journalists/friends" element={<ContributorHonorsPage kind="friends" />} />
          <Route path="journalists/memorial" element={<ContributorHonorsPage kind="memorials" />} />
          <Route path="journalists/:id" element={<JournalistPage />} />
          <Route path="events/leadership-2026" element={<LeadershipVotePage />} />

          <Route path="tavern" element={<TavernPage />} />
          <Route path="tavern/rules" element={<RulesPage />} />
          <Route path="tavern/disclosures" element={<DisclosuresPage />} />
          <Route
            path="tavern/compose"
            element={
              <RequireAuth>
                <ComposePage />
              </RequireAuth>
            }
          />
          <Route
            path="tavern/desk"
            element={
              <RequireAuth>
                <DeskPage />
              </RequireAuth>
            }
          />
          <Route path="tavern/offers/:id" element={<OfferPage />} />
          <Route path="tavern/requests/:id" element={<RequestPage />} />

          <Route path="masks" element={<Navigate to="/tavern/desk?tab=masks" replace />} />
          <Route
            path="wallet"
            element={
              <RequireAuth>
                <WalletPage />
              </RequireAuth>
            }
          />
          <Route path="login" element={<LoginPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
          <Route path="profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="desk" element={<RequireAuth><DeskHubPage /></RequireAuth>} />
          <Route path="desk/news" element={<RequireAuth editorial><NewsDeskPage /></RequireAuth>} />
          <Route
            path="admin/*"
            element={
              <RequireAuth admin>
                <AdminPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}
