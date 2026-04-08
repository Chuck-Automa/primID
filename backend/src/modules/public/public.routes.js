const express = require('express');
const { lookupHandle, suggestHandles } = require('./public.controller');

const router = express.Router();

// No authenticate middleware — these routes are fully public
router.get('/suggestions/:platform', suggestHandles);
router.get('/lookup/:platform/:handle', lookupHandle);

module.exports = router;
