alter table if exists risk_findings
  add column if not exists resolution_status text not null default 'open',
  add column if not exists resolved_at timestamptz;
