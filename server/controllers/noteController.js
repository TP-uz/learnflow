const mongoose = require('mongoose');
const Note = require('../models/Note');
const ErrorResponse = require('../utils/ErrorReponse');
const asyncHandler = require('../middleware/asyncHandler');
const AI = require('../services/AIService');

// @desc    Get all notes (with pagination/filtering)
// @route   GET /api/v1/notes
// @access  Private
exports.getNotes = asyncHandler(async (req, res, next) => {
  // Destructure query params
  const { page = 1, limit = 10, subject, tag, q: searchQuery } = req.query;
  
  // Build query
  const query = { userId: req.user.id };
  if (subject) query.subject = subject;
  if (tag) query.tags = { $in: [tag.toLowerCase()] };
  if (searchQuery) query.$text = { $search: searchQuery };

  // Execute query with pagination
  const notes = await Note.find(query)
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .sort('-createdAt')
    .lean();

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
// @route   GET /api/v1/notes/:id
// @access  Private
exports.getNote = asyncHandler(async (req, res, next) => {
  const note = await Note.findOne({
    _id: req.params.id,
    userId: req.user.id
  }).lean();

  if (!note) {
    return next(new ErrorResponse(`Note not found with id ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: note
  });
});

// @desc    Create new note
// @route   POST /api/v1/notes
// @access  Private
exports.createNote = asyncHandler(async (req, res, next) => {
  // Format input
  const { title, content, subject = 'other', tags = [] } = req.body;
  
  const note = await Note.create({
    title,
    content,
    subject,
    tags: tags.map(tag => tag.toLowerCase().trim()),
    userId: req.user.id
  });

  res.status(201).json({
    success: true,
    data: note
  });
});

// @desc    Update note
// @route   PUT /api/v1/notes/:id
// @access  Private
exports.updateNote = asyncHandler(async (req, res, next) => {
  const updates = { ...req.body };
  
  // Format tags if provided
  if (updates.tags) {
    updates.tags = updates.tags.map(tag => tag.toLowerCase().trim());
  }

  const note = await Note.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    updates,
    { new: true, runValidators: true }
  );

  if (!note) {
    return next(new ErrorResponse(`Note not found with id ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: note
  });
});

// @desc    Delete note
// @route   DELETE /api/v1/notes/:id
// @access  Private
exports.deleteNote = asyncHandler(async (req, res, next) => {
  const note = await Note.findOneAndDelete({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!note) {
    return next(new ErrorResponse(`Note not found with id ${req.params.id}`, 404));
  }

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Generate flashcards from note
// @route   POST /api/v1/notes/:id/generate-flashcards
// @access  Private
exports.generateFlashcards = asyncHandler(async (req, res, next) => {
  const note = await Note.findOne({
    _id: req.params.id,
    userId: req.user.id
  });

  if (!note) {
    return next(new ErrorResponse(`Note not found with id ${req.params.id}`, 404));
  }

  // Call AI service
  const flashcards = await AI.generateFlashcards(note.content);
  
  // Update note
  note.flashcards = flashcards;
  note.aiGenerated = true;
  note.aiModel = 'deepseek-chat';
  await note.save();

  res.status(200).json({
    success: true,
    data: note
  });
});

// @desc    Search notes (full-text)
// @route   GET /api/v1/notes/search
// @access  Private
exports.searchNotes = asyncHandler(async (req, res, next) => {
  if (!req.query.q) {
    return next(new ErrorResponse('Search query required', 400));
  }

  const notes = await Note.find(
    {
      $text: { $search: req.query.q },
      userId: req.user.id
    },
    { score: { $meta: "textScore" } }
  )
  .sort({ score: { $meta: "textScore" } })
  .limit(10)
  .lean();

  res.status(200).json({
    success: true,
    count: notes.length,
    data: notes
  });
});

// @desc    Get note statistics
// @route   GET /api/v1/notes/stats
// @access  Private
exports.getNoteStats = asyncHandler(async (req, res, next) => {
  const stats = await Note.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(req.user.id) } },
    {
      $group: {
        _id: '$subject',
        count: { $sum: 1 },
        avgLength: { $avg: { $strLenCP: "$content" } },
        totalFlashcards: { $sum: { $size: "$flashcards" } }
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.status(200).json({
    success: true,
    data: stats
  });
});