import PropTypes from 'prop-types';

/** `tokens` clue: a row of coloured chips. The colour name is always printed (NFR-16). */
export default function TokensClue({ data }) {
  return (
    <figure className="clue-tokens">
      {data.caption && <figcaption>{data.caption}</figcaption>}
      <ol className="token-row">
        {data.tokens.map((t, i) => (
          // Order matters in these clues and never changes, so the index is part of the key.
          // eslint-disable-next-line react/no-array-index-key
          <li key={`${t.label}-${i}`} className={`token token-${t.color}`}>
            <span className="token-swatch" aria-hidden="true" />
            <span className="token-label">{t.label}</span>
            {t.value !== undefined && t.value !== null && <span className="token-value">{t.value}</span>}
          </li>
        ))}
      </ol>
    </figure>
  );
}

TokensClue.propTypes = {
  data: PropTypes.shape({
    caption: PropTypes.string,
    tokens: PropTypes.arrayOf(PropTypes.shape({
      label: PropTypes.string.isRequired,
      color: PropTypes.string.isRequired,
      value: PropTypes.string,
    })).isRequired,
  }).isRequired,
};
