import PropTypes from 'prop-types';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/**
 * `strip` clue: the alphabet with each letter's shifted partner under it.
 * direction 'back' maps a letter to the one `shift` places earlier (D → A for 3).
 */
export default function StripClue({ data }) {
  const step = data.direction === 'back' ? -data.shift : data.shift;
  const partner = (i) => ALPHABET[(i + step + 26 * 4) % 26];
  const arrow = data.direction === 'back' ? '←' : '→';
  return (
    <figure className="clue-strip">
      {data.caption && <figcaption>{data.caption}</figcaption>}
      <p className="strip-legend">
        Top letter becomes the bottom letter ({arrow} {data.shift} {data.shift === 1 ? 'place' : 'places'}).
      </p>
      <ol className="strip" aria-label={`Alphabet shifted ${data.direction} by ${data.shift}`}>
        {ALPHABET.map((letter, i) => (
          <li key={letter}>
            <span className="strip-top">{letter}</span>
            <span className="strip-bottom">{partner(i)}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

StripClue.propTypes = {
  data: PropTypes.shape({
    caption: PropTypes.string,
    shift: PropTypes.number.isRequired,
    direction: PropTypes.oneOf(['back', 'forward']).isRequired,
  }).isRequired,
};
