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

module.exports = { expectNoUnrevealedHint };
