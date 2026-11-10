/** The only place a challenge becomes a client payload (NFR-1): no levels, seed or usedFallback. */
function challengeView(challenge, { status, teamsEntered, viewerId, myEntry }) {
  const theme = challenge.theme;
  return {
    id: String(challenge._id),
    code: challenge.code,
    name: challenge.name,
    visibility: challenge.visibility,
    theme: { slug: theme.slug, name: theme.name, genre: theme.genre, story: theme.story, timerMinutes: theme.timerMinutes, roles: theme.roles },
    startsAt: challenge.startsAt.toISOString(),
    endsAt: challenge.endsAt.toISOString(),
    status,
    teamsEntered,
    maxTeams: challenge.maxTeams,
    isCreator: String(challenge.creatorId) === String(viewerId),
    myEntry,
  };
}

module.exports = { challengeView };
