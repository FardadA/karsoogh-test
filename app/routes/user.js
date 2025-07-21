const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/userController');
const puzzleRoomRouter = require('./puzzleRoom'); // Import puzzle room routes

router.get('/', ctrl.renderDashboard);

// Mount the puzzle room routes under /dashboard/rooms
router.use('/rooms', puzzleRoomRouter);

module.exports = router;
