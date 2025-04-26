// server/db.js
const { Pool } = require('pg');


const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // store the URL in .env
  ssl: {
    rejectUnauthorized: false, // required for Neon
  },
});

module.exports = pool;
