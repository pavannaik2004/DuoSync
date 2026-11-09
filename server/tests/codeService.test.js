const { generateCode } = require('../src/services/codeService');
const Team = require('../src/models/Team');

test('generateCode returns the requested length from the alphabet', () => {
  for (let i = 0; i < 1000; i += 1) {
    expect(generateCode(8)).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  }
  expect(generateCode(6)).toHaveLength(6);
});

test('the Team inviteCode setter uppercases', () => {
  expect(new Team({ inviteCode: 'abcd2345' }).inviteCode).toBe('ABCD2345');
});
