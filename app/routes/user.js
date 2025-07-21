const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/userController');

router.get('/', ctrl.renderDashboard);

// Route to render the dashboard for any puzzle room URL, letting the frontend handle the rest.
router.get('/rooms/:identifier', ctrl.renderDashboard);

module.exports = router;
