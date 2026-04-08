const express = require('express');
const { lookupHandle } = require('./public.controller');

const router = express.Router();

// No authenticate middleware — these routes are fully public
router.get('/lookup/:platform/:handle', lookupHandle);

module.exports = router;
