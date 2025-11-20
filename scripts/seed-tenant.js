const { Client } = require('pg');

const conn = {
  host: 'aws-1-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.crndpzhpvhcncoscoiba',
  password: 'sYrrAY6OYCLKuUyI',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
};

async function seedTenant(name) {
  const client = new Client(conn);
  await client.connect();
  try {
    const existing = await client.query('select id from tenants where name = $1 limit 1', [name]);
    if (existing.rows.length) {
      console.log(`Tenant already exists: ${existing.rows[0].id}`);
      return existing.rows[0].id;
    }
    const result = await client.query('insert into tenants (name) values ($1) returning id', [name]);
    const id = result.rows[0].id;
    console.log(`Created tenant ${name}: ${id}`);
    return id;
  } finally {
    await client.end();
  }
}

const tenantName = process.argv[2] || 'Demo Tenant';
seedTenant(tenantName).catch((err) => {
  console.error('Failed to seed tenant', err);
  process.exit(1);
});
