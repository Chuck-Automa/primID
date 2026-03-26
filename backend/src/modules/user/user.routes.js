const express = require('express');
const { getMe, updateMe } = require('./user.controller');
const { authenticate } = require('../../shared/middleware/authenticate');

const router = express.Router();

router.get('/me', authenticate, getMe);
router.patch('/me', authenticate, updateMe);

module.exports = router;
