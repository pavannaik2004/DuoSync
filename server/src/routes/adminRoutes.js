const express = require('express');
const { body, query } = require('express-validator');
const validate = require('../middleware/validate');
const { requirePlayer, requireRole } = require('../middleware/auth');
const { STYLE_KEYS } = require('../content/catalog');
const { isPlainJson } = require('../utils/jsonGuard');
const admin = require('../controllers/adminController');

// No control characters; long texts may hold line breaks.
const ONE_LINE = /^[^\u0000-\u001f\u007f]*$/;
const MULTI_LINE = /^[^\u0000-\u0009\u000b-\u001f\u007f]*$/;

/** A string field of `min`–`max` characters. Optional fields may be omitted or null. */
function text(field, label, { min = 0, max, multiLine = false, optional = false }) {
  let chain = body(field);
  if (optional) chain = chain.optional({ values: 'null' });
  return chain.isString().withMessage(`${label} must be text`).bail()
    .isLength({ min, max }).withMessage(min ? `${label} must be ${min}-${max} characters` : `${label} must be at most ${max} characters`)
    .bail()
    .matches(multiLine ? MULTI_LINE : ONE_LINE).withMessage(`${label} has characters that are not allowed`);
}

const POOL_NAME = /^[A-Za-z][A-Za-z0-9]{0,39}$/;

/** D89: pools are an object of named lists; each entry a short string or a plain JSON object. */
function checkPools(pools) {
  if (!isPlainJson(pools)) throw new Error('Pools must be a JSON object of lists, without $ or . in keys, at most 10 deep');
  for (const [name, list] of Object.entries(pools)) {
    if (!POOL_NAME.test(name)) throw new Error(`Pool name "${name}" must be letters and digits, starting with a letter`);
    if (!Array.isArray(list)) throw new Error(`Pool "${name}" must be a list`);
    if (list.length > 300) throw new Error(`Pool "${name}" has more than 300 entries`);
    for (const entry of list) {
      const fine = (typeof entry === 'string' && entry.length <= 120) || isPlainJson(entry);
      if (!fine) throw new Error(`Pool "${name}" entries must be text up to 120 characters or objects`);
    }
  }
  return true;
}

/** ADMIN-2 fields. POST needs a slug; PUT takes the full editable set and may not change the slug (D86). */
function themeRules({ create }) {
  const optional = create;
  return [
    create
      ? body('slug').isString().withMessage('Slug is required').bail().isLength({ min: 3, max: 40 })
        .withMessage('Slug must be 3-40 characters').bail()
        .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).withMessage('Slug must be lowercase letters and digits joined by single dashes')
      : body('slug').not().exists().withMessage("The slug can't change"),
    text('name', 'Name', { min: 3, max: 60 }),
    text('genre', 'Genre', { max: 40, optional }),
    text('story', 'Story', { max: 1200, multiLine: true, optional }),
    text('boardLabel', 'Board label', { max: 30, optional }),
    text('revealText', 'Reveal text', { max: 600, multiLine: true, optional }),
    text('failText', 'Failure text', { max: 600, multiLine: true, optional }),
    body('roles').isObject().withMessage('Roles A and B are required'),
    text('roles.A.name', 'Role A name', { min: 2, max: 30 }),
    text('roles.B.name', 'Role B name', { min: 2, max: 30 }),
    text('roles.A.description', 'Role A description', { max: 200, optional: true }),
    text('roles.B.description', 'Role B description', { max: 200, optional: true }),
    body('timerMinutes').isInt({ min: 5, max: 60 }).withMessage('Timer must be a whole number of minutes from 5 to 60').toInt(),
    body('styleKey').isIn(STYLE_KEYS).withMessage('Choose a visual style from the list'),
    (create ? body('pools').optional() : body('pools')).custom(checkPools),
    create ? body('active').not().exists().withMessage('A new theme starts inactive') : body('active').optional().isBoolean({ strict: true })
      .withMessage('Active must be true or false'),
  ];
}

const listRules = [
  query('q').optional().isString().bail().isLength({ max: 40 }).withMessage('Search is at most 40 characters'),
  query('status').optional().isIn(['active', 'inactive', 'deleted', 'all']).withMessage('Status must be active, inactive, deleted or all'),
];

/** /api/admin — admins only (ADMIN-1, NFR-3). */
function createAdminRouter() {
  const router = express.Router();
  router.use(requirePlayer, requireRole('admin'));

  router.get('/themes', validate(listRules), admin.listThemes);
  router.post('/themes', validate(themeRules({ create: true })), admin.createTheme);
  router.get('/themes/:id', admin.getTheme);
  router.put('/themes/:id', validate(themeRules({ create: false })), admin.updateTheme);
  router.delete('/themes/:id', admin.deleteTheme);

  return router;
}

module.exports = { createAdminRouter, text, ONE_LINE };
