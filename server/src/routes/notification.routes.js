const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth.middleware');
const notificationService = require('../services/notificationService');

// GET /notifications/:userId
router.get('/:userId', isAuthenticated, async (req, res) => {
  try {
    if (req.params.userId !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    const notifications = await notificationService.getRecentNotifications(req.user.id);
    res.json(notifications);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /notifications/:id/read
router.patch('/:id/read', isAuthenticated, async (req, res) => {
  try {
    const updated = await notificationService.markAsRead(req.params.id, req.user.id);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH /notifications/mark-all-read
router.patch('/mark-all-read', isAuthenticated, async (req, res) => {
  try {
    const result = await notificationService.markAllAsRead(req.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
