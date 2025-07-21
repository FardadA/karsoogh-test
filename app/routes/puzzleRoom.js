const express = require('express');
const router = express.Router();
const puzzleRoomController = require('../controllers/puzzleRoomController');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'public/uploads/puzzle_answers/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images and PDFs
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('File type not supported! Only images and PDFs are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB
  },
  fileFilter: fileFilter
});

// Middleware to pass io object to the controller
const ioMiddleware = (req, res, next) => {
  req.io = req.app.get('io');
  next();
};

// --- User-facing Routes for Puzzle Rooms ---

// GET /rooms/:identifier - This route handles viewing a puzzle room.
// The identifier can be the room's 'name' or 'uniqueIdentifier'.
router.get('/:identifier', ioMiddleware, puzzleRoomController.renderRoom);

// POST /rooms/:roomId/submit-answer - For uploading an answer file.
router.post('/:roomId/submit-answer', ioMiddleware, upload.single('answerFile'), puzzleRoomController.submitAnswer);

// POST /rooms/:groupRoomStatusId/claim-prize - To initiate the prize claiming process.
router.post('/:groupRoomStatusId/claim-prize', ioMiddleware, puzzleRoomController.claimPrize);

// POST /rooms/:groupRoomStatusId/select-prize - To select the final prize room.
router.post('/:groupRoomStatusId/select-prize', ioMiddleware, puzzleRoomController.selectPrize);


module.exports = router;
