const { getResult } = require('../services/resultService');

async function result(req, res) {
  res.json(await getResult(req.params.id, req.auth));
}

module.exports = { result };
