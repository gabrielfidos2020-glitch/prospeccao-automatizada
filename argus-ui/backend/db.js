const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL
});

pool.on('error', (err, client) => {
  console.error('Erro inesperado no client PostgreSQL', err);
});

module.exports = pool;
