import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';
import Login from './pages/Login';
import Signup from './pages/Signup';
import GuestEntry from './pages/GuestEntry';
import MyTeams from './pages/MyTeams';
import TeamPage from './pages/TeamPage';
import JoinTeam from './pages/JoinTeam';

const players = ['user'];
const anyone = ['user', 'guest'];

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="login" element={<Login />} />
        <Route path="signup" element={<Signup />} />
        <Route path="guest" element={<GuestEntry />} />
        <Route path="dashboard" element={<ProtectedRoute allow={anyone}><Dashboard /></ProtectedRoute>} />
        <Route path="teams" element={<ProtectedRoute allow={players}><MyTeams /></ProtectedRoute>} />
        <Route path="teams/join" element={<ProtectedRoute allow={players}><JoinTeam /></ProtectedRoute>} />
        <Route path="teams/join/:code" element={<ProtectedRoute allow={players}><JoinTeam /></ProtectedRoute>} />
        <Route path="teams/:id" element={<ProtectedRoute allow={players}><TeamPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
