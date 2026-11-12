/**
 * NFR-1 at socket level: before a reveal, no payload holds a level's real hint text, and every
 * "hint": key has the not-revealed shape { ready, text: null }.
 */
function expectNoUnrevealedHint(payloads, levels) {
  const json = JSON.stringify(payloads);
  levels.forEach((l) => {
    expect(l.hint).toBeTruthy();
    expect(json).not.toContain(JSON.stringify(l.hint).slice(1, -1));
  });
  const keys = json.match(/"hint":/g) || [];
  const shaped = json.match(/"hint":{"ready":(true|false),"text":null}/g) || [];
  expect(shaped).toHaveLength(keys.length);
}

/** NFR-1: no answer, accepted answer or explanation of any level appears in the payload. */
function expectNoAnswers(payload, levels) {
  const json = JSON.stringify(payload);
  for (const key of ['"answer"', 'acceptedAnswers', 'explanation', 'clueA', 'clueB']) expect(json).not.toContain(key);
  levels.forEach((l) => {
    [l.answer, ...(l.acceptedAnswers || [])].forEach((a) => expect(json).not.toContain(JSON.stringify(a)));
    if (l.explanation) expect(json).not.toContain(l.explanation);
  });
}

module.exports = { expectNoUnrevealedHint, expectNoAnswers };
