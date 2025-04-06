const mongoose = require('mongoose');
const Note = require('../models/Note');
const ErrorResponse = require('../utils/ErrorReponse');
const asyncHandler = require('../middleware/async');

// @desc    Get all notes
// @route   GET /api/notes
// @access  Private
exports.getNotes = asyncHandler(async (req, res, next) => {
  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (page - 1) * limit;

  // Filtering
  let query = { userId: req.user.id };
  
  // Subject filter
  if (req.query.subject) {
    query.subject = req.query.subject;
  }

  // Tag filter
  if (req.query.tag) {
    query.tags = { $in: [req.query.tag.toLowerCase()] };
  }

  // Text search (requires text index)
  if (req.query.q) {
    query.$text = { $search: req.query.q };
  }

  const notes = await Note.find(query)
    .skip(skip)
    .limit(limit)
    .sort('-createdAt');

  const total = await Note.countDocuments(query);

  res.status(200).json({
    success: true,
    count: notes.length,
    total,
    pages: Math.ceil(total / limit),
    data: notes
  });
});

// @desc    Get single note
// @route   GET /api/notes/:id
// @access  Private
exports.getNote = asyncHandler(async (req, res, next) => {
  const note = await Note.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!note) {
    return next(
      new ErrorResponse(`Note not found with id of ${req.params.id}`, 404)
    );
  }

  res.status(200).json({
    success: true,
    data: note
  });
});

// @desc    Create note
// @route   POST /api/notes
// @access  Private
exports.createNote = asyncHandler(async (req, res, next) => {
  // Add user to req.body
  req.body.userId = req.user.id;

  // Format tags
  if (req.body.tags) {
    req.body.tags = req.body.tags.map(tag => 
      tag.toLowerCase().trim()
    );
  }

  const note = await Note.create(req.body);

  res.status(201).json({
    success: true,
    data: note
  });
});

// @desc    Update note
// @route   PUT /api/notes/:id
// @access  Private
exports.updateNote = asyncHandler(async (req, res, next) => {
  let note = await Note.findById(req.params.id);

  if (!note) {
    return next(
      new ErrorResponse(`Note not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user owns the note
  if (note.userId.toString() !== req.user.id) {
    return next(
      new ErrorResponse(`Not authorized to update this note`, 401)
    );
  }

  // Format tags if updating
  if (req.body.tags) {
    req.body.tags = req.body.tags.map(tag => 
      tag.toLowerCase().trim()
    );
  }

  note = await Note.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: note
  });
});

// @desc    Delete note
// @route   DELETE /api/notes/:id
// @access  Private
exports.deleteNote = asyncHandler(async (req, res, next) => {
  const note = await Note.findById(req.params.id);

  if (!note) {
    return next(
      new ErrorResponse(`Note not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user owns the note
  if (note.userId.toString() !== req.user.id) {
    return next(
      new ErrorResponse(`Not authorized to delete this note`, 401)
    );
  }

  await note.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Search notes
// @route   GET /api/notes/search
// @access  Private
exports.searchNotes = asyncHandler(async (req, res, next) => {
  if (!req.query.q) {
    return next(new ErrorResponse('Please provide a search query', 400));
  }

  const notes = await Note.find(
    { 
      $text: { $search: req.query.q },
      userId: req.user.id 
    },
    { score: { $meta: "textScore" } }
  )
  .sort({ score: { $meta: "textScore" } })
  .limit(10);

  res.status(200).json({
    success: true,
    count: notes.length,
    data: notes
  });
});

// @desc    Get note statistics
// @route   GET /api/notes/stats
// @access  Private
exports.getNoteStats = asyncHandler(async (req, res, next) => {
  const stats = await Note.aggregate([
    { $match: { userId: mongoose.Types.ObjectId(req.user.id) } },
    {
      $group: {
        _id: '$subject',
        count: { $sum: 1 },
        avgFlashcards: { $avg: { $size: '$flashcards' } },
        totalFlashcards: { $sum: { $size: '$flashcards' } }
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.status(200).json({
    success: true,
    data: stats
  });
});

// @desc    Generate flashcards from note
// @route   POST /api/notes/:id/generate-flashcards
// @access  Private
exports.generateFlashcards = asyncHandler(async (req, res, next) => {
  const note = await Note.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!note) {
    return next(
      new ErrorResponse(`Note not found with id of ${req.params.id}`, 404)
    );
  }

  // Call AI service to generate flashcards
  const flashcards = await req.aiService.generateFlashcards(note.content);

  // Update note with generated flashcards
  note.flashcards = flashcards;
  note.aiGenerated = true;
  note.aiModel = 'deepseek-chat';
  await note.save();

  res.status(200).json({
    success: true,
    data: note
  });
});
// In Note model (/server/models/Note.js)
NoteSchema.index({ userId: 1, createdAt: -1 }); // For user notes pagination
NoteSchema.index({ tags: 1 }); // For tag filtering
NoteSchema.index({ title: 'text', content: 'text' }); // Full-text search