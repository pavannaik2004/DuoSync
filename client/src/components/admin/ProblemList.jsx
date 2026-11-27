import PropTypes from 'prop-types';

/** checkTheme's problems (ADMIN-4, D84) as text: a heading that says ready or how many, then one line each. */
export default function ProblemList({ problems }) {
  if (problems.length === 0) {
    return (
      <div className="problems problems-ok" role="status">
        <h3><span aria-hidden="true">✓ </span>Ready to activate</h3>
        <p className="form-note">5 levels, valid fixed values, and 10 generated sets built without falling back.</p>
      </div>
    );
  }
  return (
    <div className="problems problems-bad" role="status">
      <h3><span aria-hidden="true">✕ </span>{problems.length === 1 ? '1 problem' : `${problems.length} problems`}</h3>
      <ul>
        {problems.map((p) => (
          <li key={`${p.order}-${p.message}`}>{p.order ? `Level ${p.order}` : 'Theme'}: {p.message}</li>
        ))}
      </ul>
    </div>
  );
}

ProblemList.propTypes = {
  problems: PropTypes.arrayOf(PropTypes.shape({ order: PropTypes.number, message: PropTypes.string.isRequired })).isRequired,
};
