import PropTypes from 'prop-types';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** A plain alphabet with A = 1 to Z = 26 and no shift row; the shift comes from elsewhere (D46). */
function NumberedStrip({ caption }) {
  return (
    <figure className="clue-strip">
      {caption && <figcaption>{caption}</figcaption>}
      <ol className="strip" aria-label="Alphabet numbered 1 to 26">
        {ALPHABET.map((letter, i) => (
          <li key={letter}>
            <span className="strip-top">{letter}</span>
            <span className="strip-bottom">{i + 1}</span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

NumberedStrip.propTypes = { caption: PropTypes.string };

/**
 * `strip` clue: the alphabet with each letter's shifted partner under it.
 * direction 'back' maps a letter to the one `shift` places earlier (D → A for 3).
 */
export default function StripClue({ data }) {
  if (data.numbered) return <NumberedStrip caption={data.caption} />;
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
    numbered: PropTypes.bool,
    shift: PropTypes.number,
    direction: PropTypes.oneOf(['back', 'forward']),
  }).isRequired,
};
