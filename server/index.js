const express = require('express');
const cors = require('cors');
require('dotenv').config();
const familyTreeRoutes = require('./routes/familyTreeRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Mount your route
app.use('/api', familyTreeRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
