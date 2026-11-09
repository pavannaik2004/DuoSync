const AppError = require('../utils/AppError');

/**
 * The single error handler (NFR-20). Every failure leaves the server as
 * `{ error, message }` with the matching HTTP status; stack traces never do.
 */
// Express recognises error handlers by their 4 parameters, so `next` must stay.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    const body = { error: err.code, message: err.message };
    if (err.details) body.details = err.details;
    return res.status(err.status).json(body);
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'BAD_JSON', message: 'Request body is not valid JSON' });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'TOO_LARGE', message: 'Request body is too large' });
  }
  if (err && err.name === 'CastError') {
    return res.status(404).json({ error: 'NOT_FOUND', message: 'Not found' });
  }
  if (err && err.code === 11000) {
    return res.status(409).json({ error: 'DUPLICATE', message: 'That value is already taken' });
  }
  if (process.env.NODE_ENV !== 'test') console.error(err);
  return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong' });
}

module.exports = errorHandler;
