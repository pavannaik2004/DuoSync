import PropTypes from 'prop-types';
import FormField from './FormField';
import useForm from '../hooks/useForm';
import { validators } from '../utils/validators';
import { updateProfile } from '../api/users';

/** Names for the 8 avatar colours, so each swatch has a text label (NFR-16). */
const COLOR_NAMES = {
  '#E4572E': 'Flame',
  '#29335C': 'Navy',
  '#F3A712': 'Amber',
  '#669BBC': 'Sky',
  '#A8C686': 'Sage',
  '#7D5BA6': 'Violet',
  '#2A9D8F': 'Teal',
  '#D1495B': 'Rose',
};

/** AUTH-7: change the username (AUTH-1 rules) and the avatar colour. */
export default function ProfileEditor({ profile, onSaved, onCancel }) {
  const form = useForm({ username: profile.username, avatarColor: profile.avatarColor }, { username: validators.username });

  const save = form.handleSubmit(async (values) => {
    const changes = {};
    if (values.username.trim() !== profile.username) changes.username = values.username.trim();
    if (values.avatarColor !== profile.avatarColor) changes.avatarColor = values.avatarColor;
    if (Object.keys(changes).length === 0) {
      onCancel();
      return;
    }
    onSaved(await updateProfile(changes));
  });

  return (
    <form className="profile-editor" onSubmit={save} noValidate aria-label="Edit profile">
      <FormField label="Username" autoComplete="username" hint="3-20 letters, digits or underscores." {...form.bind('username')} />
      <fieldset className="swatches">
        <legend>Avatar colour</legend>
        {profile.avatarColors.map((color) => (
          <label key={color} className="swatch">
            <input
              type="radio"
              name="avatarColor"
              value={color}
              checked={form.values.avatarColor === color}
              onChange={() => form.setValues((v) => ({ ...v, avatarColor: color }))}
            />
            <span className="swatch-dot" style={{ background: color }} aria-hidden="true" />
            {COLOR_NAMES[color] || color}
          </label>
        ))}
      </fieldset>
      {form.formError && <p className="form-error" role="alert">{form.formError}</p>}
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={form.submitting}>{form.submitting ? 'Saving…' : 'Save profile'}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

ProfileEditor.propTypes = {
  profile: PropTypes.shape({
    username: PropTypes.string.isRequired,
    avatarColor: PropTypes.string.isRequired,
    avatarColors: PropTypes.arrayOf(PropTypes.string).isRequired,
  }).isRequired,
  onSaved: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
