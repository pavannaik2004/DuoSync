import PropTypes from 'prop-types';
import { levelBarShape } from './gameShapes';

const STATE_TEXT = { solved: 'Solved', current: 'Current level', locked: 'Locked' };

/** GAME-9: the 5 levels, each solved (with points), current or locked, plus the running score. */
export default function LevelBar({ levels, score }) {
  return (
    <div className="level-bar">
      <ol aria-label="Levels">
        {levels.map((l) => (
          <li key={l.order} className={`level level-${l.state}`} aria-current={l.state === 'current' ? 'step' : undefined}>
            <span className="level-mark" aria-hidden="true">
              {l.state === 'solved' && '✓'}
              {l.state === 'current' && l.order}
              {l.state === 'locked' && (
                <svg viewBox="0 0 16 16" width="14" height="14"><path d="M4 7V5a4 4 0 0 1 8 0v2h1v8H3V7zm2 0h4V5a2 2 0 0 0-4 0z" fill="currentColor" /></svg>
              )}
            </span>
            <span className="level-title">{l.title}</span>
            <span className="level-detail">
              <span className="visually-hidden">{STATE_TEXT[l.state]}. </span>
              {l.state === 'solved' && `+${l.points}`}
              {l.state === 'current' && l.wrongCount > 0 && `${l.wrongCount} wrong`}
            </span>
          </li>
        ))}
      </ol>
      <p className="score"><span>Score</span> <strong>{score}</strong></p>
    </div>
  );
}

LevelBar.propTypes = {
  levels: PropTypes.arrayOf(levelBarShape).isRequired,
  score: PropTypes.number.isRequired,
};
