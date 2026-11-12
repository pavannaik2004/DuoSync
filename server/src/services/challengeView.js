/** The only place a challenge becomes a client payload (NFR-1): no levels, seed or usedFallback. */
function challengeView(challenge, {
  status, teamsEntered, viewerId, myEntry, canSeeTeams = false,
}) {
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
    canSeeTeams, // SCORE-5: creator, organizer or admin (D75)
    myEntry,
  };
}

/** CHAL-10, D76: each level's answer and explanation. Only for a closed challenge; the caller checks. */
function solutionsView(challenge) {
  return {
    levels: challenge.levels.map((l) => ({
      order: l.order, title: l.title, answer: l.answer, explanation: l.explanation || null,
    })),
  };
}

module.exports = { challengeView, solutionsView };
