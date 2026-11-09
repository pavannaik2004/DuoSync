import PropTypes from 'prop-types';

// The built-in icon set for `symbols` clues (PRD §6.3), drawn as inline SVG.
const SHAPES = {
  triangle: <polygon points="24,6 43,40 5,40" />,
  circle: <circle cx="24" cy="24" r="18" />,
  square: <rect x="7" y="7" width="34" height="34" rx="2" />,
  diamond: <polygon points="24,4 44,24 24,44 4,24" />,
  hexagon: <polygon points="14,6 34,6 44,24 34,42 14,42 4,24" />,
  star: <polygon points="24,4 29.5,17.5 44,18 32.5,27.5 36.5,42 24,34 11.5,42 15.5,27.5 4,18 18.5,17.5" />,
};

/** One glyph. The accessible name is the shape, which is what a player would say aloud. */
export default function Glyph({ shape, size = 48 }) {
  return (
    <svg className="glyph" width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={shape}>
      <g fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="3" strokeLinejoin="round">
        {SHAPES[shape] || <text x="24" y="30" textAnchor="middle" fontSize="20">?</text>}
      </g>
    </svg>
  );
}

Glyph.propTypes = {
  shape: PropTypes.string.isRequired,
  size: PropTypes.number,
};
