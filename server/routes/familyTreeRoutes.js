// routes/familyTreeRoutes.js
const express = require('express');
const router = express.Router();
const { getFamilyTree } = require('../controllers/familyTreeCont');

router.get('/family-tree', getFamilyTree);



module.exports = router;
