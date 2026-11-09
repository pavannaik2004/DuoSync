const { validationResult } = require('express-validator');
const AppError = require('../utils/AppError');

/**
 * Runs express-validator chains and rejects with 400 VALIDATION_ERROR,
 * listing the first problem for each field as `details: [{ field, message }]`.
 */
function validate(chains) {
  return async (req, res, next) => {
    for (const chain of chains) {
      await chain.run(req);
    }
    const errors = validationResult(req).array({ onlyFirstError: true });
    if (errors.length === 0) return next();
    const details = errors.map((e) => ({ field: e.path, message: e.msg }));
    return next(new AppError(400, 'VALIDATION_ERROR', details[0].message, details));
  };
}

module.exports = validate;
