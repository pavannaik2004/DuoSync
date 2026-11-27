import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import FormField from '../../components/FormField';
import StatusMessage from '../../components/StatusMessage';
import useAsync from '../../hooks/useAsync';
import useForm from '../../hooks/useForm';
import { validators } from '../../utils/validators';
import { adminMessage } from '../../utils/adminErrors';
import { createTheme, getCatalog, listThemes } from '../../api/admin';

const STATUSES = [['', 'Not deleted'], ['active', 'Active'], ['inactive', 'Inactive'], ['deleted', 'Deleted'], ['all', 'All']];
const statusText = (t) => (t.deleted ? 'Deleted' : t.active ? 'Active' : 'Inactive');

/** ADMIN-2 / ADMIN-8: the themes list with a search box and a status filter (both in the URL), and a new-theme form. */
export default function AdminThemes() {
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') || '').slice(0, 40);
  const status = STATUSES.some(([v]) => v === params.get('status')) ? params.get('status') : '';
  const themes = useAsync(() => listThemes({ q, status }), [q, status]);

  function onFilter(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    if (data.get('q').trim()) next.set('q', data.get('q').trim());
    if (data.get('status')) next.set('status', data.get('status'));
    setParams(next);
  }

  return (
    <section className="page">
      <h1>Themes</h1>
      <form className="filters" onSubmit={onFilter} key={params.toString()} role="search" aria-label="Find themes">
        <div className="field">
          <label htmlFor="theme-q">Search name or slug</label>
          <input id="theme-q" name="q" type="search" defaultValue={q} maxLength={40} />
        </div>
        <div className="field">
          <label htmlFor="theme-status">Status</label>
          <select id="theme-status" name="status" defaultValue={status}>
            {STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <button type="submit" className="btn">Search</button>
      </form>

      {themes.loading && <StatusMessage kind="loading" message="Loading themes…" />}
      {themes.error && (
        <StatusMessage
          kind="error"
          message={adminMessage(themes.error.code) || themes.error.message}
          action={<button type="button" className="btn" onClick={themes.reload}>Try again</button>}
        />
      )}
      {themes.data && !themes.loading && (themes.data.length === 0 ? (
        <StatusMessage kind="empty" message="No themes match." />
      ) : (
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Themes">
          <table className="results-table">
            <caption className="visually-hidden">Themes</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Slug</th>
                <th scope="col">Levels</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {themes.data.map((t) => (
                <tr key={t.id}>
                  <th scope="row"><Link to={`/admin/themes/${t.id}`}>{t.name}</Link></th>
                  <td><code>{t.slug}</code></td>
                  <td>{t.levelCount} / 5</td>
                  <td>{statusText(t)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <NewTheme />
    </section>
  );
}

/** A new theme starts inactive with no levels (D86); its page is where the rest is filled in. */
function NewTheme() {
  const navigate = useNavigate();
  const catalog = useAsync(() => getCatalog(), []);
  const form = useForm(
    { slug: '', name: '', timerMinutes: '15', styleKey: 'cyber', 'roles.A.name': '', 'roles.B.name': '' },
    {
      slug: validators.themeSlug,
      name: validators.themeName,
      timerMinutes: validators.timerMinutes,
      'roles.A.name': validators.roleName,
      'roles.B.name': validators.roleName,
    },
  );
  const onCreate = form.handleSubmit(async (v) => {
    try {
      const created = await createTheme({
        slug: v.slug,
        name: v.name.trim(),
        timerMinutes: Number(v.timerMinutes),
        styleKey: v.styleKey,
        roles: { A: { name: v['roles.A.name'].trim() }, B: { name: v['roles.B.name'].trim() } },
      });
      navigate(`/admin/themes/${created.theme.id}`);
    } catch (err) {
      if (err.code === 'SLUG_TAKEN') {
        err.code = 'VALIDATION_ERROR';
        err.details = [{ field: 'slug', message: adminMessage('SLUG_TAKEN') }];
      }
      throw err;
    }
  });
  const styleKeys = catalog.data ? catalog.data.styleKeys : ['cyber'];

  return (
    <section aria-labelledby="new-theme-title">
      <h2 id="new-theme-title" className="section-title">New theme</h2>
      <p className="form-note">A new theme starts inactive. Add its 5 levels and pools on the next page, then activate it.</p>
      <form className="form" onSubmit={onCreate} noValidate>
        {form.formError && <p className="form-error" role="alert">{form.formError}</p>}
        <FormField label="Slug" hint="Lowercase, with dashes. It can't change later." autoComplete="off" spellCheck="false" {...form.bind('slug')} />
        <FormField label="Name" autoComplete="off" {...form.bind('name')} />
        <div className="field-row">
          <FormField label="Timer (minutes)" type="number" inputMode="numeric" min="5" max="60" {...form.bind('timerMinutes')} />
          <div className="field">
            <label htmlFor="field-styleKey">Visual style</label>
            <select id="field-styleKey" name="styleKey" value={form.values.styleKey} onChange={(e) => form.setValues((x) => ({ ...x, styleKey: e.target.value }))}>
              {styleKeys.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        </div>
        <div className="field-row">
          <FormField label="Role A name" autoComplete="off" {...form.bind('roles.A.name')} />
          <FormField label="Role B name" autoComplete="off" {...form.bind('roles.B.name')} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={form.submitting}>{form.submitting ? 'Creating…' : 'Create theme'}</button>
      </form>
    </section>
  );
}
