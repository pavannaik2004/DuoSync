import PropTypes from 'prop-types';
import StatusMessage from './StatusMessage';
import useAsync from '../hooks/useAsync';
import { getSolutions } from '../api/challenges';
import challengeMessage from '../utils/challengeErrors';

/** CHAL-10: once the challenge has closed, each level's answer and explanation (D76). */
export default function Solutions({ challengeId }) {
  const solutions = useAsync(() => getSolutions(challengeId), [challengeId]);

  let body;
  if (solutions.loading) body = <StatusMessage kind="loading" message="Loading the answers…" />;
  else if (solutions.error) {
    body = (
      <StatusMessage
        kind="error"
        message={challengeMessage(solutions.error)}
        action={<button type="button" className="btn" onClick={solutions.reload}>Try again</button>}
      />
    );
  } else {
    body = (
      <ol className="solutions">
        {solutions.data.levels.map((l) => (
          <li key={l.order}>
            <p><strong>{l.title}</strong>: <span className="code-display">{l.answer}</span></p>
            {l.explanation && <p className="form-note">{l.explanation}</p>}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <section aria-labelledby="solutions-title">
      <h2 id="solutions-title" className="section-title">Answers</h2>
      {body}
    </section>
  );
}

Solutions.propTypes = { challengeId: PropTypes.string.isRequired };
