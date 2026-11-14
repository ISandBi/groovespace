const express = require('express');
const service = require('./service');
const { requireActor } = require('../../middlewares/actor');

const router = express.Router();
router.use(requireActor());

router.get('/', async (req, res) => {
  try {
    const [items, unread] = await Promise.all([service.listFor(req.actor), service.unreadCount(req.actor)]);
    res.set('Cache-Control', 'no-store');
    return res.status(200).json({ items, unread });
  } catch {
    return res.status(500).json({ error: 'No se pudieron cargar las notificaciones.' });
  }
});

router.post('/read-all', async (req, res) => {
  try {
    await service.markAllRead(req.actor);
    return res.status(200).json({ unread: 0 });
  } catch {
    return res.status(500).json({ error: 'No se pudieron marcar las notificaciones.' });
  }
});

module.exports = router;
