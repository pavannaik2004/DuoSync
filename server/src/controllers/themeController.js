const { listActiveThemes } = require('../services/themeService');
const { themeRankings } = require('../services/rankingService');

async function list(req, res) {
  res.json(await listActiveThemes());
}

async function rankings(req, res) {
  res.json(await themeRankings(req.params.slug));
}

module.exports = { list, rankings };
