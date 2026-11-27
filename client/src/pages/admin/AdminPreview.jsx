import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StatusMessage from '../../components/StatusMessage';
import AdminError from '../../components/admin/AdminError';
import ClueView from '../../components/clues/ClueView';
import useAsync from '../../hooks/useAsync';
import { adminMessage } from '../../utils/adminErrors';
import { getTheme, previewTheme } from '../../api/admin';

const SEED = /^[A-Za-z0-9-]{0,32}$/;

/** ADMIN-5 / D96: generate a sample level set and show clue A, clue B and the answer side by side. Nothing is saved. */
export default function AdminPreview() {
  const { id } = useParams();
  const detail = useAsync(() => getTheme(id), [id]);
  const [seed, setSeed] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function onGenerate(event) {
    event.preventDefault();
    if (!SEED.test(seed)) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await previewTheme(id, seed.trim()));
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (detail.loading) return <StatusMessage kind="loading" message="Loading the theme…" />;
  if (detail.error) return <StatusMessage kind="error" message={adminMessage(detail.error.code) || detail.error.message} />;
  const { theme } = detail.data;
  const badSeed = !SEED.test(seed);

  return (
    <section className="page">
      <p className="crumb"><Link to={`/admin/themes/${theme.id}`}>← {theme.name}</Link></p>
      <h1>Preview: {theme.name}</h1>
      <p className="form-note">A sample set from this theme&apos;s current levels. The same seed always gives the same values. Nothing is saved.</p>
      <form className="filters" onSubmit={onGenerate}>
        <div className="field">
          <label htmlFor="preview-seed">Seed</label>
          <input
            id="preview-seed"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            maxLength={32}
            placeholder="Empty = random"
            aria-invalid={badSeed ? 'true' : undefined}
            aria-describedby={badSeed ? 'preview-seed-error' : undefined}
          />
          {badSeed && <span id="preview-seed-error" className="field-error">Use letters, digits or dashes.</span>}
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || badSeed}>{busy ? 'Generating…' : 'Generate'}</button>
      </form>
      <AdminError error={error} />
      {result && (
        <div aria-live="polite">
          <p>Seed used: <code>{result.seed}</code></p>
          {result.usedFallback && (
            <p className="notice" role="status">
              Used the fixed values: level {result.failure.order} — {result.failure.reason}
            </p>
          )}
          {result.levels.map((level) => (
            <article key={level.order} className="preview-level" aria-labelledby={`preview-level-${level.order}`}>
              <h2 id={`preview-level-${level.order}`}>{level.order}. {level.title} <span className="form-note">· {level.mechanic}</span></h2>
              <div className="preview-grid">
                <div>
                  <h3>Clue A · {theme.roles.A.name}</h3>
                  <ClueView clue={level.clueA} />
                </div>
                <div>
                  <h3>Clue B · {theme.roles.B.name}</h3>
                  <ClueView clue={level.clueB} />
                </div>
                <div>
                  <h3>Answer</h3>
                  <p><strong><code>{level.answer}</code></strong> <span className="form-note">({level.answerKind})</span></p>
                  {level.acceptedAnswers.length > 0 && <p>Also accepted: {level.acceptedAnswers.join(', ')}</p>}
                  <p>Reward: {level.reward ?? 'none'}</p>
                  <p>{level.explanation}</p>
                  {level.hint && <p className="form-note">Hint: {level.hint}</p>}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
