import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import NotFound from './pages/NotFound';

// Replaced by the real pages in the next tasks.
function Placeholder() {
  return <section className="page"><p>Coming soon.</p></section>;
}
const Login = Placeholder;
const Signup = Placeholder;
const GuestEntry = Placeholder;
const MyTeams = Placeholder;
const TeamPage = Placeholder;
const JoinTeam = Placeholder;

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
