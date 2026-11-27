import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate, useParams } from 'react-router-dom';
import StatusMessage from '../../components/StatusMessage';
import AdminError from '../../components/admin/AdminError';
import JsonField from '../../components/admin/JsonField';
import useAsync from '../../hooks/useAsync';
import { adminMessage } from '../../utils/adminErrors';
import {
  createLevel, getCatalog, getTheme, levelBody, themeBody, updateLevel, updateTheme,
} from '../../api/admin';

const BLANK_FALLBACK = {
  answerKind: 'word',
  answer: '',
  acceptedAnswers: [],
  reward: null,
  clueA: { type: 'text', data: { paragraphs: [''] } },
  clueB: { type: 'text', data: { paragraphs: [''] } },
  explanation: '',
};

/**
 * ADMIN-3: create or edit one level. "Load example" fills the form from a built-in level of the chosen mechanic
 * (D83), and offers to add the pools that example needs to this theme.
 */
export default function AdminLevelEdit() {
  const { id, levelId } = useParams();
  const detail = useAsync(() => getTheme(id), [id]);
  const catalog = useAsync(() => getCatalog(), []);

  if (detail.loading || catalog.loading) return <StatusMessage kind="loading" message="Loading…" />;
  const failed = detail.error || catalog.error;
  if (failed) {
    return (
      <StatusMessage
        kind="error"
        message={adminMessage(failed.code) || failed.message}
        action={<button type="button" className="btn" onClick={() => { detail.reload(); catalog.reload(); }}>Try again</button>}
      />
    );
  }
  const { theme, levels } = detail.data;
  const level = levelId ? levels.find((l) => l.id === levelId) : null;
  if (levelId && !level) return <StatusMessage kind="error" message={adminMessage('LEVEL_NOT_FOUND')} />;
  if (theme.deletedAt) return <StatusMessage kind="error" message={adminMessage('THEME_DELETED')} />;

  return (
    <LevelForm
      key={levelId || 'new'}
      theme={theme}
      level={level}
      nextOrder={levels.length + 1}
      catalog={catalog.data}
      onThemeChange={(next) => detail.setData(next)}
    />
  );
}

function LevelForm({ theme, level, nextOrder, catalog, onThemeChange }) {
  const navigate = useNavigate();
  const start = level || { title: '', mechanic: catalog.mechanics[0].slug, params: {}, fallback: BLANK_FALLBACK, hint: '', rewardRule: null, timeEstimateSec: null };
  const [values, setValues] = useState({
    title: start.title, mechanic: start.mechanic, hint: start.hint || '', rewardRule: start.rewardRule || '', timeEstimateSec: start.timeEstimateSec == null ? '' : String(start.timeEstimateSec),
  });
  const [params, setParams] = useState(start.params);
  const [fallback, setFallback] = useState(start.fallback);
  const [jsonOk, setJsonOk] = useState({ params: true, fallback: true });
  const [loaded, setLoaded] = useState(0); // remounts the JSON fields when an example is loaded
  const [needPools, setNeedPools] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const examples = catalog.mechanics.find((m) => m.slug === values.mechanic)?.examples || [];
  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  function loadExample(index) {
    const ex = examples[Number(index)];
    if (!ex) return;
    setValues({ title: ex.title, mechanic: ex.mechanic, hint: ex.hint || '', rewardRule: ex.rewardRule || '', timeEstimateSec: ex.timeEstimateSec == null ? '' : String(ex.timeEstimateSec) });
    setParams(ex.params);
    setFallback(ex.fallback);
    setJsonOk({ params: true, fallback: true });
    setLoaded((n) => n + 1);
    setNeedPools(Object.fromEntries(Object.entries(ex.pools).filter(([name]) => !(theme.pools || {})[name])));
  }

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const addPools = () => run(async () => {
    const next = await updateTheme(theme.id, themeBody(theme, { pools: { ...(theme.pools || {}), ...needPools } }));
    onThemeChange(next);
    setNeedPools({});
  });

  function onSubmit(event) {
    event.preventDefault();
    if (!jsonOk.params || !jsonOk.fallback) return;
    const body = levelBody({
      title: values.title.trim(),
      mechanic: values.mechanic,
      params,
      fallback,
      hint: values.hint.trim() ? values.hint : null,
      rewardRule: values.rewardRule || null,
      timeEstimateSec: values.timeEstimateSec === '' ? null : Number(values.timeEstimateSec),
    });
    run(async () => {
      if (level) await updateLevel(level.id, body);
      else await createLevel(theme.id, body);
      navigate(`/admin/themes/${theme.id}`);
    });
  }

  const missing = Object.keys(needPools);
  return (
    <section className="page">
      <p className="crumb"><Link to={`/admin/themes/${theme.id}`}>← {theme.name}</Link></p>
      <h1>{level ? `Level ${level.order}: ${level.title}` : `New level ${nextOrder}`}</h1>
      <AdminError error={error} />
      <form className="form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="level-title">Title</label>
          <input id="level-title" value={values.title} onChange={set('title')} maxLength={40} />
        </div>
        <div className="field">
          <label htmlFor="level-mechanic">Mechanic</label>
          <select id="level-mechanic" value={values.mechanic} onChange={set('mechanic')}>
            {catalog.mechanics.map((m) => <option key={m.slug} value={m.slug}>{m.slug}</option>)}
          </select>
        </div>
        {examples.length > 0 && (
          <div className="field">
            <label htmlFor="level-example">Load example</label>
            <select id="level-example" value="" onChange={(e) => loadExample(e.target.value)}>
              <option value="">Choose a built-in {values.mechanic} level…</option>
              {examples.map((ex, i) => <option key={`${ex.theme}-${ex.order}`} value={i}>{ex.theme} · {ex.title}</option>)}
            </select>
            <span className="field-hint">Fills the parameters and fixed values below. Edit the words and text to make it your own.</span>
          </div>
        )}
        {missing.length > 0 && (
          <div className="notice" role="status">
            <p>This example uses pools this theme does not have: {missing.map((name) => `${name} (${needPools[name].length} entries)`).join(', ')}.</p>
            <button type="button" className="btn" disabled={busy} onClick={addPools}>Add these pools to the theme</button>
          </div>
        )}
        <JsonField
          key={`params-${loaded}`}
          id="level-params"
          label="Parameters"
          hint="What the generator randomizes: ranges, pool names and the wording (copy)."
          value={params}
          onChange={setParams}
          onValidity={(ok) => setJsonOk((s) => ({ ...s, params: ok }))}
        />
        <JsonField
          key={`fallback-${loaded}`}
          id="level-fallback"
          label="Fixed values (clue templates)"
          hint="Clue A, clue B, the answer and its explanation. Used for captions and when generation fails."
          value={fallback}
          onChange={setFallback}
          onValidity={(ok) => setJsonOk((s) => ({ ...s, fallback: ok }))}
          rows={18}
        />
        <div className="field">
          <label htmlFor="level-hint">Hint</label>
          <textarea id="level-hint" className="prose" value={values.hint} onChange={set('hint')} maxLength={300} />
          <span className="field-hint">Shared by every generated copy, so it names no values.</span>
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="level-reward">Reward rule</label>
            <select id="level-reward" value={values.rewardRule} onChange={set('rewardRule')}>
              <option value="">None</option>
              {catalog.rewardRules.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="level-time">Time estimate (seconds)</label>
            <input id="level-time" type="number" inputMode="numeric" min="30" max="1800" value={values.timeEstimateSec} onChange={set('timeEstimateSec')} />
          </div>
        </div>
        <p className="actions">
          <button type="submit" className="btn btn-primary" disabled={busy || !jsonOk.params || !jsonOk.fallback}>
            {busy ? 'Saving…' : level ? 'Save level' : 'Add level'}
          </button>
          <Link className="btn" to={`/admin/themes/${theme.id}`}>Cancel</Link>
        </p>
        {(!jsonOk.params || !jsonOk.fallback) && <p className="form-note">Fix the JSON to save.</p>}
      </form>
    </section>
  );
}

const levelShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  order: PropTypes.number.isRequired,
  title: PropTypes.string.isRequired,
  mechanic: PropTypes.string.isRequired,
  params: PropTypes.object,
  fallback: PropTypes.object,
  hint: PropTypes.string,
  rewardRule: PropTypes.string,
  timeEstimateSec: PropTypes.number,
});

LevelForm.propTypes = {
  theme: PropTypes.shape({ id: PropTypes.string.isRequired, name: PropTypes.string.isRequired, pools: PropTypes.object }).isRequired,
  level: levelShape,
  nextOrder: PropTypes.number.isRequired,
  catalog: PropTypes.shape({
    mechanics: PropTypes.arrayOf(PropTypes.shape({ slug: PropTypes.string.isRequired, examples: PropTypes.array.isRequired })).isRequired,
    rewardRules: PropTypes.arrayOf(PropTypes.string).isRequired,
  }).isRequired,
  onThemeChange: PropTypes.func.isRequired,
};
