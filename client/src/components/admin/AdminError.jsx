import PropTypes from 'prop-types';
import { adminError } from '../../utils/adminErrors';

/** An admin API error as text, with THEME_INVALID or validation details as a list (NFR-16: not colour alone). */
export default function AdminError({ error = null }) {
  const shown = adminError(error);
  if (!shown) return null;
  return (
    <div className="form-error" role="alert">
      <p>{shown.message}</p>
      {shown.items.length > 0 && <ul>{shown.items.map((item) => <li key={item}>{item}</li>)}</ul>}
    </div>
  );
}

AdminError.propTypes = {
  error: PropTypes.shape({ code: PropTypes.string, message: PropTypes.string, details: PropTypes.arrayOf(PropTypes.object) }),
};
