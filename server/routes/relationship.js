// server/routes/relationship.js
const express = require('express');
const router = express.Router();
const { getRelationship } = require('../neo4jRelationships');

router.post('/', async (req, res) => {
  const { person1, person2 } = req.body;
  try {
    const relationship = await getRelationship(person1, person2);
    res.json({ relationship });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get relationship' });
  }
});

module.exports = router;
