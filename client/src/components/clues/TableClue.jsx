import PropTypes from 'prop-types';

/** `table` clue: rows and columns. Wide tables scroll inside their own box on phones. */
export default function TableClue({ data }) {
  return (
    <figure className="clue-table">
      {data.caption && <figcaption id="clue-table-caption">{data.caption}</figcaption>}
      {/* Focusable so keyboard users can scroll a wide table. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div className="table-scroll" tabIndex={0} role="region" aria-labelledby={data.caption ? 'clue-table-caption' : undefined} aria-label={data.caption ? undefined : 'Clue table'}>
        <table>
          <thead>
            <tr>{data.columns.map((c) => <th key={c} scope="col">{c}</th>)}</tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.join('|')}>
                {row.map((cell, i) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <td key={i}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}

TableClue.propTypes = {
  data: PropTypes.shape({
    caption: PropTypes.string,
    columns: PropTypes.arrayOf(PropTypes.string).isRequired,
    rows: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.string)).isRequired,
  }).isRequired,
};
