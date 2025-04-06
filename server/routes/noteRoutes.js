const {
    getNotes,
    createNote,
    searchNotes,    // Add this
    getNoteStats    // Add this
  } = require('../controllers/noteController');
  
  router.get('/search', protect, searchNotes);
  router.get('/stats', protect, getNoteStats);