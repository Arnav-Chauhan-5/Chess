const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth.middleware');
const friendService = require('../services/friendService');

// POST /friends/request
router.post('/request', isAuthenticated, async (req, res) => {
  try {
    const { toUsername } = req.body;
    if (!toUsername) {
      return res.status(400).json({ error: 'toUsername is required' });
    }
    const friendship = await friendService.sendRequest(req.user.id, toUsername);
    res.json(friendship);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST /friends/respond
router.post('/respond', isAuthenticated, async (req, res) => {
  try {
    const { friendshipId, accept } = req.body;
    if (!friendshipId || accept === undefined) {
      return res.status(400).json({ error: 'friendshipId and accept are required' });
    }
    const result = await friendService.respondToRequest(friendshipId, req.user.id, accept);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /friends/:userId
router.get('/:userId', isAuthenticated, async (req, res) => {
  try {
    // Optionally ensure users can only get their own list, but letting it be open for now or strict
    if (req.params.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    const lists = await friendService.getFriendsList(req.user.id);
    res.json(lists);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
