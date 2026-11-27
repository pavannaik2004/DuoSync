const themes = require('../services/adminThemeService');
const levels = require('../services/adminLevelService');
const { catalog } = require('../services/adminCatalog');
const users = require('../services/adminUserService');

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

async function listLevels(req, res) {
  res.json(await levels.listLevels(req.params.id));
}

async function createLevel(req, res) {
  res.status(201).json(await levels.createLevel(req.params.id, req.body));
}

async function updateLevel(req, res) {
  res.json(await levels.updateLevel(req.params.id, req.body));
}

async function deleteLevel(req, res) {
  res.json(await levels.deleteLevel(req.params.id));
}

async function reorderLevels(req, res) {
  res.json(await levels.reorderLevels(req.params.id, req.body.levelIds));
}

function getCatalog(req, res) {
  res.json(catalog());
}

async function previewTheme(req, res) {
  res.json(await themes.previewTheme(req.params.id, req.body.seed || undefined));
}

async function searchUsers(req, res) {
  res.json(await users.searchUsers(req.query.q));
}

async function setOrganizer(req, res) {
  res.json(await users.setOrganizer(req.params.id, req.body.organizer));
}

module.exports = {
  searchUsers,
  setOrganizer,
  getCatalog,
  previewTheme,
  listThemes, getTheme, createTheme, updateTheme, deleteTheme, listLevels, createLevel, updateLevel, deleteLevel, reorderLevels,
};
