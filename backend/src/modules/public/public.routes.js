const express = require('express');
const { lookupHandle, suggestHandles, listPublicAttestations } = require('./public.controller');

const router = express.Router();

// No authenticate middleware — these routes are fully public
router.get('/suggestions/:platform', suggestHandles);
router.get('/lookup/:platform/:handle', lookupHandle);
router.get('/attestations/:platform/:handle', listPublicAttestations);

module.exports = router;
