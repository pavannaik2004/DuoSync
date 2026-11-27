const { profile, updateProfile } = require('../services/profileService');
const { history } = require('../services/historyService');

async function me(req, res) {
  res.json(await profile(req.user));
}

async function updateMe(req, res) {
  res.json(await updateProfile(req.user, { username: req.body.username, avatarColor: req.body.avatarColor }));
}

async function myHistory(req, res) {
  res.json(await history({ memberId: req.user._id }, Number(req.query.page) || 1));
}

module.exports = { me, updateMe, myHistory };
