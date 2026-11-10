import { Link, useParams } from 'react-router-dom';
import StatusMessage from '../components/StatusMessage';
import AttemptScreen from '../components/game/AttemptScreen';
import { patterns } from '../utils/validators';

const JOIN_ERRORS = {
  PRACTICE_NOT_FOUND: 'No practice room has that code. Check it with your teammate.',
  ROOM_FULL: 'This room already has 2 players.',
  ALREADY_STARTED: 'This game started without you. Ask for a new room.',
};

const backLink = <Link className="btn" to="/practice">Back to practice</Link>;
const describeError = (error) => JOIN_ERRORS[error.error] || error.message;

/** /play/:code — the lobby, the attempt and the results for one practice room. */
export default function PlayPage() {
  const { code = '' } = useParams();
  if (!patterns.PRACTICE_CODE.test(code)) {
    return <StatusMessage kind="error" message="That room code doesn't look right. Room codes have 6 letters and digits." action={backLink} />;
  }
  return <AttemptScreen key={code} target={{ practiceCode: code.toUpperCase() }} describeError={describeError} backLink={backLink} />;
}
