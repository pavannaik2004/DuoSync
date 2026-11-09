import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

const SHOW_MS = 3500;

/**
 * Shows the last answer's outcome to both teammates (GAME-5, GAME-6), with an
 * icon and text, not colour alone (NFR-16). It fades out after a few seconds.
 */
export default function ResultFlash({ result = null, roles }) {
  const [hiddenSeq, setHiddenSeq] = useState(0);

  useEffect(() => {
    if (!result) return undefined;
    const timer = setTimeout(() => setHiddenSeq(result.seq), SHOW_MS);
    return () => clearTimeout(timer);
  }, [result]);

  if (!result || hiddenSeq === result.seq) return <div className="result-flash-slot" aria-live="polite" />;

  const who = result.submittedBy.role ? `${result.submittedBy.name} (${roles[result.submittedBy.role].name})` : result.submittedBy.name;
  return (
    <div className="result-flash-slot" aria-live="polite">
      <p key={result.seq} className={`result-flash ${result.correct ? 'is-correct' : 'is-wrong'}`}>
        <span className="result-icon" aria-hidden="true">{result.correct ? '✓' : '✗'}</span>
        {result.correct
          ? <span><strong>Correct: +{result.points}.</strong> {who} answered {result.text}.</span>
          : <span><strong>Wrong: −{result.deduction}.</strong> {who} tried &ldquo;{result.text}&rdquo;.</span>}
      </p>
    </div>
  );
}

ResultFlash.propTypes = {
  result: PropTypes.shape({
    seq: PropTypes.number.isRequired,
    correct: PropTypes.bool.isRequired,
    text: PropTypes.string.isRequired,
    points: PropTypes.number,
    deduction: PropTypes.number,
    submittedBy: PropTypes.shape({ name: PropTypes.string.isRequired, role: PropTypes.oneOf(['A', 'B', null]) }).isRequired,
  }),
  roles: PropTypes.objectOf(PropTypes.shape({ name: PropTypes.string.isRequired })).isRequired,
};
