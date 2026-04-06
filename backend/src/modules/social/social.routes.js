const express = require('express');
const { listSocialAccounts, addSocialAccount, removeSocialAccount } = require('./social.controller');
const { authenticate } = require('../../shared/middleware/authenticate');

const router = express.Router();

router.get('/',          authenticate, listSocialAccounts);
router.post('/',         authenticate, addSocialAccount);
router.patch('/:id/remove', authenticate, removeSocialAccount);

module.exports = router;
