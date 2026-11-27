const themes = require('../services/adminThemeService');

async function listThemes(req, res) {
  res.json(await themes.listThemes({ q: req.query.q, status: req.query.status }));
}

async function getTheme(req, res) {
  res.json(await themes.getTheme(req.params.id));
}

async function createTheme(req, res) {
  res.status(201).json(await themes.createTheme(req.body));
}

async function updateTheme(req, res) {
  res.json(await themes.updateTheme(req.params.id, req.body));
}

async function deleteTheme(req, res) {
  await themes.deleteTheme(req.params.id, Date.now());
  res.status(204).end();
}

module.exports = { listThemes, getTheme, createTheme, updateTheme, deleteTheme };
