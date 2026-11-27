import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import StatusMessage from '../../components/StatusMessage';
import ConfirmButton from '../../components/ConfirmButton';
import AdminError from '../../components/admin/AdminError';
import JsonField from '../../components/admin/JsonField';
import ProblemList from '../../components/admin/ProblemList';
import useAsync from '../../hooks/useAsync';
import { adminMessage } from '../../utils/adminErrors';
import {
  deleteLevel, deleteTheme, getCatalog, getTheme, reorderLevels, themeBody, updateTheme,
} from '../../api/admin';

const statusText = (theme) => (theme.deletedAt ? 'Deleted' : theme.active ? 'Active' : 'Inactive');

/**
 * ADMIN-2, 3, 4, 7: one theme's fields and pools, its levels (reorder, edit, delete), activation and soft delete.
 * Every write returns the whole ThemeDetail, which replaces the page state.
 */
export default function AdminThemeEdit() {
  const { id } = useParams();
  const detail = useAsync(() => getTheme(id), [id]);
  const catalog = useAsync(() => getCatalog(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [deleted, setDeleted] = useState(false);
  // The form reloads only after its own saves, so Activate or a level change never drops unsaved edits.
  const [formSaves, setFormSaves] = useState(0);

  async function write(action) {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      if (next) detail.setData(next);
      return true;
    } catch (err) {
      setError(err);
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (detail.loading) return <StatusMessage kind="loading" message="Loading the theme…" />;
  if (detail.error) {
    return (
      <StatusMessage
        kind="error"
        message={adminMessage(detail.error.code) || detail.error.message}
        action={<button type="button" className="btn" onClick={detail.reload}>Try again</button>}
      />
    );
  }

  const { theme, levels, problems } = detail.data;
  const readOnly = Boolean(theme.deletedAt);
  const ids = levels.map((l) => l.id);
  const move = (index, by) => {
    const next = [...ids];
    [next[index], next[index + by]] = [next[index + by], next[index]];
    return write(() => reorderLevels(theme.id, next));
  };

  return (
    <section className="page">
      <p className="crumb"><Link to="/admin/themes">← Themes</Link></p>
      <div className="page-head">
        <h1>{theme.name}</h1>
        <span className="badge">{statusText(theme)}</span>
      </div>
      <p className="form-note">Slug <code>{theme.slug}</code> (fixed). Edits never change challenges that already exist.</p>
      {readOnly && <p className="notice" role="status">{adminMessage('THEME_DELETED')}</p>}
      {deleted && <p className="notice" role="status">Theme deleted. Challenges that used it keep their levels and results.</p>}
      <AdminError error={error} />

      <h2 className="section-title">Playable?</h2>
      <ProblemList problems={problems} />
      {!readOnly && (
        <p className="actions">
          {theme.active ? (
            <button type="button" className="btn" disabled={busy} onClick={() => write(() => updateTheme(theme.id, themeBody(theme, { active: false })))}>
              Deactivate
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || problems.length > 0}
              aria-describedby={problems.length > 0 ? 'activate-why' : undefined}
              onClick={() => write(() => updateTheme(theme.id, themeBody(theme, { active: true })))}
            >
              Activate
            </button>
          )}
          {!theme.active && problems.length > 0 && <span id="activate-why" className="form-note">Fix the problems above to activate.</span>}
          <Link className="btn" to={`/admin/themes/${theme.id}/preview`}>Preview</Link>
        </p>
      )}

      <h2 className="section-title">Levels ({levels.length} / 5)</h2>
      {levels.length === 0 ? <p className="form-note">No levels yet.</p> : (
        <ol className="level-list">
          {levels.map((level, i) => (
            <li key={level.id} className="level-item">
              <span className="level-item-name"><strong>{level.order}. {level.title}</strong> <span className="form-note">· {level.mechanic}</span></span>
              {!readOnly && (
                <>
                  <button type="button" className="btn" disabled={busy || i === 0} aria-label={`Move ${level.title} up`} onClick={() => move(i, -1)}>↑</button>
                  <button type="button" className="btn" disabled={busy || i === levels.length - 1} aria-label={`Move ${level.title} down`} onClick={() => move(i, 1)}>↓</button>
                  <Link className="btn" to={`/admin/themes/${theme.id}/levels/${level.id}`} aria-label={`Edit ${level.title}`}>Edit</Link>
                  <ConfirmButton label="Delete" confirmLabel={`Delete ${level.title}`} danger busy={busy} onConfirm={() => write(() => deleteLevel(level.id))} />
                </>
              )}
            </li>
          ))}
        </ol>
      )}
      {!readOnly && levels.length < 5 && (
        <p className="actions"><Link className="btn" to={`/admin/themes/${theme.id}/levels/new`}>Add level</Link></p>
      )}

      <h2 className="section-title">Theme details</h2>
      <ThemeForm
        key={formSaves}
        theme={theme}
        styleKeys={catalog.data ? catalog.data.styleKeys : [theme.styleKey]}
        readOnly={readOnly}
        busy={busy}
        onSave={async (body) => { if (await write(() => updateTheme(theme.id, body))) setFormSaves((n) => n + 1); }}
      />

      {!readOnly && (
        <>
          <h2 className="section-title">Delete theme</h2>
          <p className="form-note">The theme disappears from new challenges and practice. Challenges that used it keep their levels and results. Its slug stays reserved.</p>
          <ConfirmButton
            label="Delete theme"
            confirmLabel={`Delete ${theme.name}`}
            danger
            busy={busy}
            onConfirm={async () => {
              if (await write(() => deleteTheme(theme.id))) {
                setDeleted(true);
                detail.reload();
              }
            }}
          />
        </>
      )}
    </section>
  );
}

const TEXT_FIELDS = [
  ['name', 'Name', false], ['genre', 'Genre', false], ['story', 'Story', true], ['boardLabel', 'Board label', false],
  ['revealText', 'Reveal text (finish)', true], ['failText', 'Failure text (time out)', true],
];

/** The ADMIN-2 fields and pools; Save sends the full set (PUT). */
function ThemeForm({ theme, styleKeys, readOnly, busy, onSave }) {
  const [values, setValues] = useState(() => ({
    ...Object.fromEntries(TEXT_FIELDS.map(([k]) => [k, theme[k] || ''])),
    timerMinutes: String(theme.timerMinutes),
    styleKey: theme.styleKey,
    roleA: theme.roles.A.name, roleADesc: theme.roles.A.description || '',
    roleB: theme.roles.B.name, roleBDesc: theme.roles.B.description || '',
  }));
  const [pools, setPools] = useState(theme.pools || {});
  const [poolsOk, setPoolsOk] = useState(true);
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  function onSubmit(event) {
    event.preventDefault();
    if (!poolsOk) return;
    onSave(themeBody(theme, {
      ...Object.fromEntries(TEXT_FIELDS.map(([k]) => [k, values[k]])),
      timerMinutes: Number(values.timerMinutes),
      styleKey: values.styleKey,
      roles: { A: { name: values.roleA, description: values.roleADesc }, B: { name: values.roleB, description: values.roleBDesc } },
      pools,
    }));
  }

  const field = (key, label, multi) => (
    <div className="field" key={key}>
      <label htmlFor={`theme-${key}`}>{label}</label>
      {multi
        ? <textarea id={`theme-${key}`} className="prose" value={values[key]} onChange={set(key)} />
        : <input id={`theme-${key}`} value={values[key]} onChange={set(key)} />}
    </div>
  );

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <fieldset disabled={readOnly || busy} className="radio-group">
        <div className="form">
          {TEXT_FIELDS.map(([k, label, multi]) => field(k, label, multi))}
          <div className="field-row">
            <div className="field">
              <label htmlFor="theme-timerMinutes">Timer (minutes)</label>
              <input id="theme-timerMinutes" type="number" inputMode="numeric" min="5" max="60" value={values.timerMinutes} onChange={set('timerMinutes')} />
            </div>
            <div className="field">
              <label htmlFor="theme-styleKey">Visual style</label>
              <select id="theme-styleKey" value={values.styleKey} onChange={set('styleKey')}>
                {styleKeys.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          </div>
          <div className="field-row">
            {field('roleA', 'Role A name', false)}
            {field('roleB', 'Role B name', false)}
          </div>
          {field('roleADesc', 'Role A description', true)}
          {field('roleBDesc', 'Role B description', true)}
          <JsonField
            id="theme-pools"
            label="Pools"
            hint={'Named lists the generators pick from, e.g. { "caesarWords": ["SECURITY", …] }.'}
            value={pools}
            onChange={setPools}
            onValidity={setPoolsOk}
            rows={14}
            disabled={readOnly}
          />
          {!readOnly && <button type="submit" className="btn btn-primary" disabled={busy || !poolsOk}>Save theme</button>}
          {!poolsOk && <p className="form-note">Fix the pools JSON to save.</p>}
        </div>
      </fieldset>
    </form>
  );
}

ThemeForm.propTypes = {
  theme: PropTypes.shape({
    roles: PropTypes.shape({ A: PropTypes.object, B: PropTypes.object }).isRequired,
    timerMinutes: PropTypes.number.isRequired,
    styleKey: PropTypes.string.isRequired,
    pools: PropTypes.object,
  }).isRequired,
  styleKeys: PropTypes.arrayOf(PropTypes.string).isRequired,
  readOnly: PropTypes.bool.isRequired,
  busy: PropTypes.bool.isRequired,
  onSave: PropTypes.func.isRequired,
};
