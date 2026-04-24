const { verifyAccessToken } = require('../utils/jwt.util');
const prisma = require('../db/prisma');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required. Please login.',
      });
    }

    const decoded = verifyAccessToken(token);

    if (!decoded.sub) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.',
      });
    }

    // Reject tombstoned users before any token issuance or data access.
    const user = await prisma.user.findUnique({
      where:  { id: decoded.sub },
      select: { gdprErasedAt: true },
    });
    if (!user || user.gdprErasedAt !== null) {
      return res.status(410).json({ success: false, code: 'ACCOUNT_ERASED', message: 'This account no longer exists.' });
    }

    req.userId = decoded.sub;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Access token expired.',
      });
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid token. Please login again.',
    });
  }
};

module.exports = { authenticate };
