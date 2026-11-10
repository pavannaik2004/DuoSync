const { createRng } = require('../src/generators/rng');

const seq = (r) => Array.from({ length: 5 }, () => r.int(1, 1000));

test('the same key gives the same sequence; different keys differ', () => {
  const a = createRng('s:1:0');
  const b = createRng('s:1:0');
  const c = createRng('s:1:1');
  expect(seq(a)).toEqual(seq(b));
  expect(seq(createRng('s:1:0'))).not.toEqual(seq(c));
});

test('float is in [0, 1)', () => {
  const r = createRng('floats');
  for (let i = 0; i < 1000; i += 1) {
    const f = r.float();
    expect(f >= 0 && f < 1).toBe(true);
  }
});

test('int is inclusive and in range', () => {
  const r = createRng('ints');
  const seen = new Set();
  for (let i = 0; i < 1000; i += 1) seen.add(r.int(1, 3));
  expect([...seen].sort()).toEqual([1, 2, 3]);
});

test('pick, shuffle and sample', () => {
  const r = createRng('lists');
  const list = [1, 2, 3, 4, 5, 6];
  expect(list).toContain(r.pick(list));
  const shuffled = r.shuffle(list);
  expect(shuffled).not.toBe(list);
  expect([...shuffled].sort()).toEqual(list);
  expect(list).toEqual([1, 2, 3, 4, 5, 6]);
  for (let i = 0; i < 50; i += 1) {
    const s = r.sample(list, 4);
    expect(s).toHaveLength(4);
    expect(new Set(s).size).toBe(4);
    s.forEach((x) => expect(list).toContain(x));
  }
});
