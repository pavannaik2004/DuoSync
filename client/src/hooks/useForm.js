import { useState } from 'react';
import { splitApiError } from '../utils/formErrors';

/**
 * Form state with regex checks on blur and on submit, and server errors mapped
 * back onto fields. `rules` maps a field name to a validator (value → message).
 */
export default function useForm(initial, rules) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const validateField = (name, value) => (rules[name] ? rules[name](value) : '');

  function bind(name) {
    return {
      name,
      value: values[name],
      error: errors[name] || '',
      onChange: (e) => {
        const { value } = e.target;
        setValues((v) => ({ ...v, [name]: value }));
        if (errors[name]) setErrors((errs) => ({ ...errs, [name]: validateField(name, value) }));
      },
      onBlur: (e) => {
        if (e.target.value) setErrors((errs) => ({ ...errs, [name]: validateField(name, e.target.value) }));
      },
    };
  }

  function handleSubmit(onValid) {
    return async (e) => {
      e.preventDefault();
      if (submitting) return;
      const found = Object.fromEntries(
        Object.keys(rules).map((name) => [name, validateField(name, values[name])]).filter(([, msg]) => msg),
      );
      setErrors(found);
      setFormError('');
      const firstInvalid = Object.keys(found)[0];
      if (firstInvalid) {
        document.getElementById(`field-${firstInvalid}`)?.focus();
        return;
      }
      setSubmitting(true);
      try {
        await onValid(values);
      } catch (err) {
        const { fields, form } = splitApiError(err);
        setErrors(fields);
        setFormError(form);
      } finally {
        setSubmitting(false);
      }
    };
  }

  return { values, setValues, errors, formError, submitting, bind, handleSubmit };
}
