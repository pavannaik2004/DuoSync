/**
 * An expected, client-facing error. The central error handler turns it into
 * `{ error: code, message, details? }` with the given HTTP status (NFR-20).
 */
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    if (details) this.details = details;
  }
}

module.exports = AppError;
