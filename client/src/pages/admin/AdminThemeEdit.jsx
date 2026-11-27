import { useParams } from 'react-router-dom';
import StatusMessage from '../../components/StatusMessage';
import useAsync from '../../hooks/useAsync';
import { getTheme } from '../../api/admin';

/** Placeholder until the theme editor lands (Phase 5 Task 11). */
export default function AdminThemeEdit() {
  const { id } = useParams();
  const theme = useAsync(() => getTheme(id), [id]);
  if (theme.loading) return <StatusMessage kind="loading" message="Loading the theme…" />;
  if (theme.error) return <StatusMessage kind="error" message={theme.error.message} />;
  return (
    <section className="page">
      <h1>{theme.data.theme.name}</h1>
    </section>
  );
}
