const { listActiveThemes } = require('../services/themeService');

async function list(req, res) {
  res.json(await listActiveThemes());
}

module.exports = { list };
