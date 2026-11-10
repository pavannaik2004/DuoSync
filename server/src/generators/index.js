/** The generator for each mechanic, keyed by the slugs in content/catalog MECHANICS. */
const GENERATORS = {
  'decode-key': require('./decodeKey'),
  caesar: require('./caesar'),
  'rule-filter': require('./ruleFilter'),
  'describe-match': require('./describeMatch'),
  ordering: require('./ordering'),
  'grid-lookup': require('./gridLookup'),
  'grid-navigation': require('./gridNavigation'),
  morse: require('./morse'),
  'split-riddle': require('./splitRiddle'),
  arithmetic: require('./arithmetic'),
  'fragment-finale': require('./fragmentFinale'),
};

module.exports = { GENERATORS };
