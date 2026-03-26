const express = require('express');
const { listSocialAccounts, addSocialAccount, deleteSocialAccount } = require('./social.controller');
const { authenticate } = require('../../shared/middleware/authenticate');

const router = express.Router();

router.get('/', authenticate, listSocialAccounts);
router.post('/', authenticate, addSocialAccount);
router.delete('/:id', authenticate, deleteSocialAccount);

module.exports = router;
