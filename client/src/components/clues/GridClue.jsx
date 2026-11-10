import PropTypes from 'prop-types';
import Glyph from './Glyph';

/**
 * `grid` clue: rows x cols of cells, with optional column labels on top and row labels on the left.
 * A cell shows a glyph (`mark`) or text (`label`); each one reads as "row R, column C" aloud,
 * counting from 1 (NFR-16).
 */
export default function GridClue({ data }) {
  const { rows, cols, colLabels, rowLabels, cells } = data;
  const byPos = new Map(cells.map((c) => [`${c.r},${c.c}`, c]));
  const offsetCol = rowLabels ? 2 : 1;
  const offsetRow = colLabels ? 2 : 1;

  const items = [];
  if (colLabels) {
    colLabels.forEach((label, c) => {
      items.push(<span key={`col-${label}`} className="grid-head" style={{ gridColumn: c + offsetCol, gridRow: 1 }}>{label}</span>);
    });
  }
  if (rowLabels) {
    rowLabels.forEach((label, r) => {
      items.push(<span key={`row-${label}`} className="grid-head" style={{ gridColumn: 1, gridRow: r + offsetRow }}>{label}</span>);
    });
  }
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cell = byPos.get(`${r},${c}`);
      items.push(
        <span
          key={`${r},${c}`}
          className={`grid-cell${cell ? ' has-content' : ''}`}
          style={{ gridColumn: c + offsetCol, gridRow: r + offsetRow }}
          role="img"
          aria-label={`Row ${r + 1}, column ${c + 1}${cell ? `: ${cell.mark || cell.label || ''}` : ', empty'}`}
        >
          {cell?.mark && <Glyph shape={cell.mark} size={28} decorative />}
          {cell?.label && <span className="grid-label" aria-hidden="true">{cell.label}</span>}
        </span>,
      );
    }
  }

  return (
    <figure className="clue-grid">
      {data.caption && <figcaption>{data.caption}</figcaption>}
      <div
        className="grid-board"
        style={{ gridTemplateColumns: `${rowLabels ? 'auto ' : ''}repeat(${cols}, minmax(0, 1fr))` }}
      >
        {items}
      </div>
    </figure>
  );
}

GridClue.propTypes = {
  data: PropTypes.shape({
    caption: PropTypes.string,
    rows: PropTypes.number.isRequired,
    cols: PropTypes.number.isRequired,
    colLabels: PropTypes.arrayOf(PropTypes.string),
    rowLabels: PropTypes.arrayOf(PropTypes.string),
    cells: PropTypes.arrayOf(PropTypes.shape({
      r: PropTypes.number.isRequired,
      c: PropTypes.number.isRequired,
      mark: PropTypes.string,
      label: PropTypes.string,
    })).isRequired,
  }).isRequired,
};
