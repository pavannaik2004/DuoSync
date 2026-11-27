import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import StatusMessage from '../../components/StatusMessage';
import '../../styles/admin.css';

/** The admin panel shell (UI-1 admin pages). Lazy-loaded with its pages, so players never download it (NFR-12). */
export default function AdminLayout() {
  return (
    <div className="admin">
      <nav className="admin-nav" aria-label="Admin">
        <span className="admin-nav-title">Admin</span>
        <NavLink to="/admin/themes">Themes</NavLink>
        <NavLink to="/admin/users">Users</NavLink>
      </nav>
      <Suspense fallback={<StatusMessage kind="loading" message="Loading…" />}>
        <Outlet />
      </Suspense>
    </div>
  );
}
