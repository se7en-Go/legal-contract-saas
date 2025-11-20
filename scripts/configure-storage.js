const { Client } = require('pg');
const conn = {
  host: 'aws-1-ap-southeast-1.pooler.supabase.com',
  port: 5432,
  user: 'postgres.crndpzhpvhcncoscoiba',
  password: 'sYrrAY6OYCLKuUyI',
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
};

(async () => {
  const client = new Client(conn);
  try {
    await client.connect();
    await client.query("insert into storage.buckets (id, name, public) values ('contracts', 'contracts', false) on conflict (id) do update set name = excluded.name, public = excluded.public;");
    await client.query("alter table storage.objects enable row level security;");
    await client.query("drop policy if exists \"TenantReadObjects\" on storage.objects;");
    await client.query("drop policy if exists \"TenantWriteObjects\" on storage.objects;");
    await client.query("create policy \"TenantReadObjects\" on storage.objects for select using ((bucket_id = 'contracts' and (metadata ->> 'tenant_id') = auth.jwt()->>'tenant_id') or bucket_id <> 'contracts');");
    await client.query("create policy \"TenantWriteObjects\" on storage.objects for insert with check ((bucket_id = 'contracts' and (metadata ->> 'tenant_id') = auth.jwt()->>'tenant_id') or bucket_id <> 'contracts');");
    console.log('Storage bucket + policies configured');
  } catch (err) {
    console.error('Failed', err.message);
  } finally {
    await client.end();
  }
})();
