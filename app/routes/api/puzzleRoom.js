const express = require('express');
const router = express.Router();
const puzzleRoomController = require('../../controllers/puzzleRoomController');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Configure Multer for file uploads
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

// --- User-facing API Routes for Puzzle Rooms ---

router.get('/:identifier', ioMiddleware, puzzleRoomController.renderRoom);
router.post('/:roomId/submit-answer', ioMiddleware, upload.single('answerFile'), puzzleRoomController.submitAnswer);
router.post('/:groupRoomStatusId/claim-prize', ioMiddleware, puzzleRoomController.claimPrize);
router.post('/:groupRoomStatusId/select-prize', ioMiddleware, puzzleRoomController.selectPrize);
router.post('/:groupRoomStatusId/delete', ioMiddleware, puzzleRoomController.deleteSubmission);

module.exports = router;
