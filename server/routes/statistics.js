const express = require('express');
const router = express.Router();
const { getStatistics } = require('../neo4jStatistics');

router.get('/', async (req, res) => {
  try {
    const stats = await getStatistics();
    res.json(stats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;

