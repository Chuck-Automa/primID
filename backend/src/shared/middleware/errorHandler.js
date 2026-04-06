const { scrubForLog } = require('./loggerScrub');

const statusMap = new Map([
  ['ValidationError', 400],
  ['JsonWebTokenError', 401],
  ['TokenExpiredError', 401],
  ['P2002', 409],
  ['P2025', 404],
  ['P2003', 400],
  ['SyntaxError', 400],
]);

const friendlyMessages = new Map([
  ['P2002', 'This information is already in use.'],
  ['P2025', 'The requested resource was not found.'],
  ['JsonWebTokenError', 'Your session is invalid. Please log in again.'],
  ['TokenExpiredError', 'Your session has expired. Please log in again.'],
  ['ValidationError', 'Please check your input and try again.'],
]);

function getStatusCode(err) {
  return err.statusCode
    || statusMap.get(err.name)
    || statusMap.get(err.code)
    || 500;
}

function getUserMessage(err) {
  const friendly = friendlyMessages.get(err.name) || friendlyMessages.get(err.code);
  if (friendly) return friendly;
  const code = getStatusCode(err);
  return code >= 500
    ? 'An unexpected error occurred. Please try again later.'
    : err.message || 'Invalid request';
}

const errorHandler = (err, req, res, next) => {
  const statusCode = getStatusCode(err);
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // Scrub PII from request body before logging — phone_number, oauth_sub, etc.
    // must never appear in logs or error traces.
    console.error('ERROR:', {
      name:    err.name,
      message: err.message,
      code:    err.code,
      body:    req.safeBody || scrubForLog(req.body),
      stack:   err.stack,
    });
  }

  const response = {
    success: false,
    message: getUserMessage(err),
    ...(err.errors && { errors: err.errors }),
    // In dev, expose sanitized debug info — never raw req.body.
    ...(isDev && { debug: { type: err.name, originalMessage: err.message } }),
  };

  res.status(statusCode).json(response);
};

module.exports = { errorHandler };
