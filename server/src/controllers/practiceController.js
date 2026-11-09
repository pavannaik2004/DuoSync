const practiceService = require('../services/practiceService');
const { resolveIdentity } = require('../services/identityService');

async function create(req, res) {
  res.status(201).json(await practiceService.createPractice(await resolveIdentity(req.auth)));
}

async function show(req, res) {
  res.json(await practiceService.getPracticePreview(req.params.code, await resolveIdentity(req.auth)));
}

module.exports = { create, show };
