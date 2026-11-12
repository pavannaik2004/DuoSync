const { profile } = require('../services/profileService');
const { history } = require('../services/historyService');

async function me(req, res) {
  res.json(await profile(req.user));
}

async function myHistory(req, res) {
  res.json(await history({ memberId: req.user._id }, Number(req.query.page) || 1));
}

module.exports = { me, myHistory };
