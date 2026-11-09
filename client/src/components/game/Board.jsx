import PropTypes from 'prop-types';
import { boardEntryShape } from './gameShapes';

/** GAME-8: the shared team board with the fragments earned from solved levels. */
export default function Board({ board }) {
  if (board.length === 0) {
    return <p className="board-empty">Solve a level to collect its fragment here.</p>;
  }
  return (
    <ul className="board">
      {board.map((b) => (
        <li key={b.order}>
          <span className="board-reward">{b.reward}</span>
          <span className="board-title">{b.title}</span>
        </li>
      ))}
    </ul>
  );
}

Board.propTypes = { board: PropTypes.arrayOf(boardEntryShape).isRequired };
