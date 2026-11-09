import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FormField from '../components/FormField';
import useForm from '../hooks/useForm';
import { createPractice } from '../api/practice';
import { validators } from '../utils/validators';

/** PRAC-1: open a practice room, or join one with its 6-character code. */
export default function PracticeHome() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const form = useForm({ code: '' }, { code: validators.practiceCode });

  async function create() {
    setCreating(true);
    setCreateError('');
    try {
      const { code } = await createPractice();
      navigate(`/play/${code}`);
    } catch (err) {
      setCreateError(err.message);
      setCreating(false);
    }
  }

  const onJoin = form.handleSubmit(async (values) => {
    navigate(`/play/${values.code.trim().toUpperCase()}`);
  });

  return (
    <section className="page">
      <h1>Practice</h1>
      <p>Play Cyber Heist with any partner. Practice games are never ranked.</p>
      <div className="tiles">
        <div className="tile tile-a">
          <h2>Start a room</h2>
          <p>You get a room code to send to your teammate.</p>
          <button type="button" className="btn btn-primary" onClick={create} disabled={creating}>
            {creating ? 'Opening…' : 'Start a practice room'}
          </button>
          {createError && <p className="form-error" role="alert">{createError}</p>}
        </div>
        <div className="tile tile-b">
          <h2>Join a room</h2>
          <form className="form" onSubmit={onJoin} noValidate>
            {form.formError && <p className="form-error" role="alert">{form.formError}</p>}
            <FormField
              label="Room code"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck="false"
              className="code-input"
              {...form.bind('code')}
            />
            <button type="submit" className="btn">Join room</button>
          </form>
        </div>
      </div>
    </section>
  );
}
