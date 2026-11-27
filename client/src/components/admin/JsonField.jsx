import { useState } from 'react';
import PropTypes from 'prop-types';

const show = (value) => (value === undefined ? '' : JSON.stringify(value, null, 2));

/**
 * A JSON editor for admin params, fixed values and pools (D83, D89). The text is kept as typed; `onChange` gets the
 * parsed value only when the text parses, and `onValidity(false)` while it does not, so the form can block saving.
 * Give it a new `key` to load a different value.
 */
export default function JsonField({ id, label, value, onChange, onValidity = () => {}, error = '', hint = '', rows = 12, disabled = false }) {
  const [text, setText] = useState(() => show(value));
  const [parseError, setParseError] = useState('');

  function onText(event) {
    const next = event.target.value;
    setText(next);
    try {
      const parsed = JSON.parse(next);
      setParseError('');
      onValidity(true);
      onChange(parsed);
    } catch (err) {
      setParseError(`Not valid JSON: ${err.message}`);
      onValidity(false);
    }
  }

  const shown = parseError || error;
  const describedBy = [hint && `${id}-hint`, shown && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        value={text}
        onChange={onText}
        rows={rows}
        spellCheck="false"
        disabled={disabled}
        aria-invalid={shown ? 'true' : undefined}
        aria-describedby={describedBy}
      />
      {hint && <span id={`${id}-hint`} className="field-hint">{hint}</span>}
      {shown && <span id={`${id}-error`} className="field-error">{shown}</span>}
    </div>
  );
}

JsonField.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.string, PropTypes.number, PropTypes.bool]),
  onChange: PropTypes.func.isRequired,
  onValidity: PropTypes.func,
  error: PropTypes.string,
  hint: PropTypes.string,
  rows: PropTypes.number,
  disabled: PropTypes.bool,
};
