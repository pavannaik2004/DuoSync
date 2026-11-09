/**
 * Payload checks for socket events (NFR-5). express-validator works on HTTP requests,
 * so sockets use these small checks. Each throws 400 VALIDATION_ERROR.
 */
const AppError = require('../utils/AppError');

const invalid = (message) => new AppError(400, 'VALIDATION_ERROR', message);

/** A trimmed string of min..max characters. Rejects non-strings (objects, numbers). */
function str(value, { field, min = 1, max }) {
  if (typeof value !== 'string') throw invalid(`${field} must be text`);
  const trimmed = value.trim();
  if (trimmed.length < min || trimmed.length > max) throw invalid(`${field} must be ${min}-${max} characters`);
  return trimmed;
}

/** An integer in min..max. Strings such as "1" are rejected. */
function int(value, { field, min, max }) {
  if (!Number.isInteger(value) || value < min || value > max) throw invalid(`${field} must be a whole number from ${min} to ${max}`);
  return value;
}

function oneOf(value, list, field) {
  if (!list.includes(value)) throw invalid(`${field} must be one of ${list.join(', ')}`);
  return value;
}

module.exports = { str, int, oneOf };
