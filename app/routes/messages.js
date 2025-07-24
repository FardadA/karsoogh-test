'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/messageController');
const { isUser } = require('../middlewares/auth'); // Assuming you have this middleware

router.get('/', isUser, ctrl.listMessages);

module.exports = router;
