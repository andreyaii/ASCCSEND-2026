import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import MyGroupPage from './pages/student/MyGroupPage';
import ExplorePage from './pages/student/ExplorePage';
import EvaluatePage from './pages/student/EvaluatePage';
import MyEvaluationsPage from './pages/student/MyEvaluationsPage';
import AllProjectsPage from './pages/faculty/AllProjectsPage';
import MyTeamsPage from './pages/faculty/MyTeamsPage';
import ProjectDetailPage from './pages/shared/ProjectDetailPage';
import ProfilePage from './pages/shared/ProfilePage';
import { EmptyState } from './components/Feedback';
import { useAuth } from './context/AuthContext';
import { homePathFor, isFaculty, isStudent } from './utils/roles';

export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute allow={isStudent} />}>
        <Route path="/student" element={<AppLayout />}>
          <Route index element={<Navigate to="my-group" replace />} />
          <Route path="my-group" element={<MyGroupPage />} />
          <Route path="explore" element={<ExplorePage />} />
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="projects/:projectId/evaluate" element={<EvaluatePage />} />
          <Route path="evaluations" element={<MyEvaluationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allow={isFaculty} />}>
        <Route path="/faculty" element={<AppLayout />}>
          <Route index element={<Navigate to="all-projects" replace />} />
          <Route path="all-projects" element={<AllProjectsPage />} />
          <Route path="my-teams" element={<MyTeamsPage />} />
          <Route path="projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to={user ? homePathFor(user) : '/login'} replace />} />
      <Route path="*" element={<EmptyState title="Page not found" message="The page you are looking for does not exist." />} />
    </Routes>
  );
}
