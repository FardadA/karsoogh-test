const express = require('express');
const router = express.Router();
const adminPuzzleRoomController = require('../controllers/adminPuzzleRoomController');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Configure Multer for question image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

const upload = multer({ storage: storage });

// Middleware to pass io object to the controller
const ioMiddleware = (req, res, next) => {
  req.io = req.app.get('io');
  next();
};

// --- Admin API Routes for Puzzle Rooms ---

// GET /admin/api/rooms - Get a list of all puzzle rooms.
router.get('/rooms', adminPuzzleRoomController.listRooms);

// POST /admin/api/rooms - Create a new puzzle room.
router.post('/rooms', upload.single('questionImage'), adminPuzzleRoomController.createRoom);

// PUT /admin/api/rooms/:id - Update an existing puzzle room.
router.put('/rooms/:id', upload.single('questionImage'), adminPuzzleRoomController.updateRoom);

// DELETE /admin/api/rooms/:id - Delete a puzzle room.
router.delete('/rooms/:id', adminPuzzleRoomController.deleteRoom);

// --- Admin API Routes for Submissions ---

// GET /admin/api/submissions - Get a list of submissions pending correction.
router.get('/submissions', adminPuzzleRoomController.listSubmissions);

// GET /admin/api/submissions/:submissionId - Get details of a specific submission.
router.get('/submissions/:submissionId', adminPuzzleRoomController.getSubmissionDetails);

// POST /admin/api/submissions/:submissionId/correct - Correct a submission and assign a score.
router.post('/submissions/:submissionId/correct', ioMiddleware, adminPuzzleRoomController.correctSubmission);

module.exports = router;
