import { formatLocal } from './time';

const MESSAGES = {
  PUBLIC_NEEDS_ORGANIZER: 'Only organizers can create public challenges.',
  NOT_CREATOR: 'Only the person who created this challenge can do that.',
  CHALLENGE_STARTED: 'This challenge has already started, so it can no longer be changed.',
  HAS_ENTRIES: 'A team has already entered, so this challenge cannot be deleted.',
  MAX_TEAMS_TOO_LOW: 'More teams than that have already entered. Choose a higher limit.',
  CHALLENGE_NOT_FOUND: 'No challenge has that code. Check it with whoever shared it.',
  CHALLENGE_CLOSED: 'This challenge is closed.',
  NOT_TEAM_MEMBER: 'Choose a team you belong to.',
  TEAM_NOT_FULL: 'A team needs 2 members to enter. Invite your partner first.',
  CHALLENGE_FULL: 'This challenge has reached its team limit.',
  ALREADY_ENTERED: 'Your team has already entered this challenge.',
  MEMBER_IN_CHALLENGE: 'A member of this team has already entered with another team.',
  GUEST_NOT_ALLOWED: 'Challenges need an account. Guests can play practice games.',
  ATTEMPT_NOT_FOUND: "We could not find your team's entry in this challenge.",
  NOT_IN_ATTEMPT: "You are not part of this team's entry. You may have been removed from the team.",
};

/** Friendly text for a challenge API error (`code`) or socket ack (`error`); falls back to the server's message. */
export default function challengeMessage(err) {
  if (!err) return '';
  const code = err.code || err.error;
  if (code === 'NOT_OPEN') {
    const iso = /\d{4}-\d{2}-\d{2}T[\d:.]+Z/.exec(err.message || '');
    return iso ? `Opens at ${formatLocal(iso[0])}` : 'This challenge has not opened yet.';
  }
  return MESSAGES[code] || err.message || 'Something went wrong. Try again.';
}
