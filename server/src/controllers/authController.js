const authService = require('../services/authService');

async function signup(req, res) {
  const { username, email, password } = req.body;
  res.status(201).json(await authService.signup({ username, email, password }));
}

async function login(req, res) {
  const { email, password } = req.body;
  res.json(await authService.login({ email, password }));
}

module.exports = { signup, login };
