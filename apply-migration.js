const { Client } = require('pg');
const fs = require('fs');

const conn = {
  host: 'aws-1-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.crndpzhpvhcncoscoiba',
  password: 'sYrrAY6OYCLKuUyI',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
  statement_timeout: 60000,
};

const sql = fs.readFileSync('supabase/migrations/20251119_init_schema.sql', 'utf8');
const [schemaPart, rlsPart] = sql.split('-- Row Level Security');
const batches = [
  'create extension if not exists "pgcrypto"; create extension if not exists "vector";',
  schemaPart,
  rlsPart,
];

(async () => {
  const client = new Client(conn);
  try {
    await client.connect();
    let batchIndex = 1;
    for (const raw of batches) {
      if (!raw || !raw.trim()) continue;
      const statement = raw.trim();
      console.log(`Running batch ${batchIndex}`);
      await client.query(statement);
      console.log(`Batch ${batchIndex} done`);
      batchIndex++;
    }
    console.log('All batches applied');
  } catch (err) {
    console.error('Batch failed', err);
  } finally {
    await client.end();
  }
})();
