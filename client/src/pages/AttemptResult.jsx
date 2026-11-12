import { Link, useParams } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage';
import Results from '../components/game/Results';
import useAsync from '../hooks/useAsync';
import { getResult } from '../api/attempts';

const ERRORS = {
  ATTEMPT_NOT_FOUND: 'We could not find that game.',
  NOT_IN_ATTEMPT: 'Only the two players of a game can see its results.',
  NOT_FINISHED: 'This game has not ended yet.',
};

/** /results/:attemptId — a past game's results, rank and chat log (SCORE-2, CHAT-4). */
export default function AttemptResult() {
  const { attemptId = '' } = useParams();
  const data = useAsync(() => getResult(attemptId), [attemptId]);
  const back = <Link className="btn" to="/profile">Back to my profile</Link>;

  if (data.loading) return <StatusMessage kind="loading" message="Loading the results…" />;
  if (data.error) return <StatusMessage kind="error" message={ERRORS[data.error.code] || data.error.message} action={back} />;

  const { result, theme, chat, challenge } = data.data;
  const actions = challenge
    ? <Link className="btn btn-primary" to={`/challenge/${challenge.code}`}>See the leaderboard</Link>
    : back;
  return (
    <section className="page">
      {challenge && <p className="crumb"><Link to={`/challenge/${challenge.code}`}>{challenge.name}</Link></p>}
      <Results result={result} theme={theme} chat={chat} actions={actions} />
    </section>
  );
}
