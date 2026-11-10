import PropTypes from 'prop-types';

// The 16 built-in shapes for `symbols` and `grid` clues (D45), each one SVG element in a 48 × 48 box.
const SHAPES = {
  triangle: <polygon points="24,6 43,40 5,40" />,
  circle: <circle cx="24" cy="24" r="18" />,
  square: <rect x="7" y="7" width="34" height="34" rx="2" />,
  diamond: <polygon points="24,4 44,24 24,44 4,24" />,
  hexagon: <polygon points="14,6 34,6 44,24 34,42 14,42 4,24" />,
  star: <polygon points="24,4 29.5,17.5 44,18 32.5,27.5 36.5,42 24,34 11.5,42 15.5,27.5 4,18 18.5,17.5" />,
  moon: <path d="M30 6A18 18 0 1 0 42 32A14 14 0 0 1 30 6Z" />,
  cross: <path d="M19 5h10v14h14v10H29v14H19V29H5V19h14z" />,
  heart: <path d="M24 42C8 30 5 21 5 15a9.5 9.5 0 0 1 19-3a9.5 9.5 0 0 1 19 3c0 6-3 15-19 27z" />,
  wave: <path d="M4 18q10-12 20 0t20 0M4 32q10-12 20 0t20 0" />,
  eye: <path d="M3 24Q24 4 45 24Q24 44 3 24ZM24 17a7 7 0 1 0 .01 0Z" />,
  key: <path d="M30 6a12 12 0 1 1-8.5 20.5L8 40v-5h4v-4h4v-4l2.5-2.5A12 12 0 0 1 30 6z" />,
  crown: <path d="M5 38V14l10 10 9-14 9 14 10-10v24z" />,
  sun: <polygon points="24,4 28.6,12.9 38.1,9.9 35.1,19.4 44,24 35.1,28.6 38.1,38.1 28.6,35.1 24,44 19.4,35.1 9.9,38.1 12.9,28.6 4,24 12.9,19.4 9.9,9.9 19.4,12.9" />,
  anchor: <path d="M24 4a5 5 0 1 0 .01 0zM22 17h4v21c8-1 13-6 13-13h-4l7-8 7 8h-4c0 11-8 18-19 18S5 36 5 25H1l7-8 7 8h-4c0 7 5 12 11 13z" />,
  bolt: <path d="M28 4L10 28h12l-4 16 20-26H26z" />,
};

/** One glyph. The accessible name is the shape, which is what a player would say aloud. */
export default function Glyph({ shape, size = 48, decorative = false }) {
  const a11y = decorative ? { 'aria-hidden': true } : { role: 'img', 'aria-label': shape };
  return (
    <svg className="glyph" width={size} height={size} viewBox="0 0 48 48" {...a11y}>
      <g fill="currentColor" fillOpacity="0.18" stroke="currentColor" strokeWidth="3" strokeLinejoin="round">
        {SHAPES[shape] || <text x="24" y="30" textAnchor="middle" fontSize="20">?</text>}
      </g>
    </svg>
  );
}

Glyph.propTypes = {
  shape: PropTypes.string.isRequired,
  size: PropTypes.number,
  decorative: PropTypes.bool,
};
