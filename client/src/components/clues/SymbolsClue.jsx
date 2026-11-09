import PropTypes from 'prop-types';
import Glyph from './Glyph';

/** `symbols` clue: a row of glyphs, with a caption under each when it has a label (a legend). */
export default function SymbolsClue({ data }) {
  return (
    <figure className="clue-symbols">
      {data.caption && <figcaption>{data.caption}</figcaption>}
      <ol className="symbol-row">
        {data.symbols.map((s, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <li key={`${s.shape}-${i}`}>
            <Glyph shape={s.shape} />
            {s.label && <span className="symbol-label">{s.label}</span>}
          </li>
        ))}
      </ol>
    </figure>
  );
}

SymbolsClue.propTypes = {
  data: PropTypes.shape({
    caption: PropTypes.string,
    symbols: PropTypes.arrayOf(PropTypes.shape({ shape: PropTypes.string.isRequired, label: PropTypes.string })).isRequired,
  }).isRequired,
};
