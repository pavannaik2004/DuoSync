import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage';
import AttemptScreen from '../components/game/AttemptScreen';
import useAsync from '../hooks/useAsync';
import useNow from '../hooks/useNow';
import { getChallenge } from '../api/challenges';
import { patterns } from '../utils/validators';
import { formatCountdown, formatLocal } from '../utils/time';
import challengeMessage from '../utils/challengeErrors';

function Waiting({ challenge, onOpen }) {
  const now = useNow();
  const start = new Date(challenge.startsAt).getTime();
  useEffect(() => {
    if (now >= start) onOpen();
  }, [now, start, onOpen]);
  return (
    <StatusMessage
      kind="empty"
      message={`Opens at ${formatLocal(challenge.startsAt)}. Starts in ${formatCountdown(start - now)}.`}
      action={<Link className="btn" to={`/challenge/${challenge.code}`}>Back to the challenge</Link>}
    />
  );
}

const challengeProp = PropTypes.shape({
  code: PropTypes.string.isRequired,
  startsAt: PropTypes.string.isRequired,
  myEntry: PropTypes.shape({ attemptId: PropTypes.string.isRequired }),
}).isRequired;

Waiting.propTypes = { challenge: challengeProp, onOpen: PropTypes.func.isRequired };

/** Loads the challenge, then shows the team's lobby, game and results once the window opens. */
function ChallengeAttempt({ challenge }) {
  const [waiting, setWaiting] = useState(() => Date.now() < new Date(challenge.startsAt).getTime());
  const back = <Link className="btn" to={`/challenge/${challenge.code}`}>Back to the challenge</Link>;
  if (!challenge.myEntry) {
    return (
      <StatusMessage
        kind="empty"
        message="Your team has not entered this challenge."
        action={back}
      />
    );
  }
  if (waiting) {
    return <Waiting challenge={challenge} onOpen={() => setWaiting(false)} />;
  }
  return (
    <AttemptScreen
      target={{ attemptId: challenge.myEntry.attemptId }}
      describeError={challengeMessage}
      backLink={back}
      resultActions={<Link className="btn btn-primary" to={`/challenge/${challenge.code}`}>See the leaderboard</Link>}
    />
  );
}

ChallengeAttempt.propTypes = { challenge: challengeProp };

/** /challenge/:code/play */
export default function ChallengePlay() {
  const { code = '' } = useParams();
  const valid = patterns.CHALLENGE_CODE.test(code);
  const challenge = useAsync(() => (valid ? getChallenge(code.toUpperCase()) : Promise.resolve(null)), [code]);
  const back = <Link className="btn" to="/dashboard">Back to the dashboard</Link>;

  if (!valid) {
    return <StatusMessage kind="error" message="That challenge code doesn't look right. Codes have 6 letters and digits." action={back} />;
  }
  if (challenge.loading) return <StatusMessage kind="loading" message="Loading the challenge…" />;
  if (challenge.error) return <StatusMessage kind="error" message={challengeMessage(challenge.error)} action={back} />;
  return <ChallengeAttempt challenge={challenge.data} />;
}
