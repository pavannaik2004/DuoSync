import PropTypes from 'prop-types';

// A single word or code in capitals (like an intercepted password) gets the code style.
const looksLikeCode = (text) => /^[A-Z0-9-]{3,16}$/.test(text);

/** `text` clue: paragraphs of riddles, statements and rules. */
export default function TextClue({ data }) {
  return (
    <div className="clue-text">
      {data.paragraphs.map((p, i) => (
        // Paragraphs are fixed per level and never reorder, so the index is a stable key.
        // eslint-disable-next-line react/no-array-index-key
        <p key={i} className={looksLikeCode(p) ? 'clue-code' : undefined}>{p}</p>
      ))}
    </div>
  );
}

TextClue.propTypes = {
  data: PropTypes.shape({ paragraphs: PropTypes.arrayOf(PropTypes.string).isRequired }).isRequired,
};
