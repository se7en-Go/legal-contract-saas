create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
create extension if not exists "vector";

create table if not exists tenants (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    plan text not null default 'free',
    settings jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

create table if not exists tenant_users (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references tenants(id) on delete cascade,
    user_id uuid references auth.users(id) on delete cascade,
    role text not null default 'member',
    status text not null default 'active',
    created_at timestamptz not null default now(),
    unique (tenant_id, user_id)
);

create table if not exists contracts (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants(id) on delete cascade,
    title text not null,
    counterparty text,
    status text not null default 'uploaded',
    storage_path text not null,
    checksum text,
    metadata jsonb not null default '{}'::jsonb,
    created_by uuid references auth.users(id),
    created_at timestamptz not null default now()
);

create table if not exists contract_versions (
    id uuid primary key default gen_random_uuid(),
    contract_id uuid not null references contracts(id) on delete cascade,
    version_no integer not null,
    source_path text not null,
    parsed_json jsonb,
    summary text,
    created_at timestamptz not null default now(),
    unique (contract_id, version_no)
);

create table if not exists clauses (
    id uuid primary key default gen_random_uuid(),
    contract_version_id uuid not null references contract_versions(id) on delete cascade,
    clause_no text,
    title text,
    body text not null,
    clause_type text,
    embedding vector(1536),
    risk_score numeric,
    created_at timestamptz not null default now()
);

create table if not exists risk_findings (
    id uuid primary key default gen_random_uuid(),
    clause_id uuid not null references clauses(id) on delete cascade,
    risk_level text not null,
    risk_type text,
    description text,
    recommendation text,
    regulation_refs jsonb,
    llm_trace_id uuid,
    created_at timestamptz not null default now()
);

create table if not exists regulations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    jurisdiction text,
    effective_date date,
    expiry_date date,
    source_url text,
    created_at timestamptz not null default now()
);

create table if not exists regulation_sections (
    id uuid primary key default gen_random_uuid(),
    regulation_id uuid not null references regulations(id) on delete cascade,
    section_no text,
    text text not null,
    tags text[] default '{}',
    embedding vector(1536)
);

create table if not exists key_clauses (
    id uuid primary key default gen_random_uuid(),
    clause_id uuid references clauses(id) on delete cascade,
    contract_version_id uuid references contract_versions(id) on delete cascade,
    category text not null,
    summary text,
    attributes jsonb default '{}'::jsonb,
    created_at timestamptz default now()
);

create table if not exists clause_rewrites (
    id uuid primary key default gen_random_uuid(),
    clause_id uuid not null references clauses(id) on delete cascade,
    rewrite text not null,
    rationale text,
    approval_status text default 'pending',
    created_at timestamptz default now()
);

create table if not exists tasks (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants(id) on delete cascade,
    task_type text not null,
    payload jsonb not null,
    status text not null default 'queued',
    progress numeric default 0,
    error text,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists audit_logs (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants(id) on delete cascade,
    actor_id uuid references auth.users(id),
    action text not null,
    payload jsonb,
    created_at timestamptz default now()
);

create table if not exists notifications (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants(id) on delete cascade,
    entity text,
    message text not null,
    read_at timestamptz,
    created_at timestamptz default now()
);

-- Row Level Security
alter table tenants enable row level security;
alter table tenant_users enable row level security;
alter table contracts enable row level security;
alter table contract_versions enable row level security;
alter table clauses enable row level security;
alter table risk_findings enable row level security;
alter table regulations enable row level security;
alter table regulation_sections enable row level security;
alter table key_clauses enable row level security;
alter table clause_rewrites enable row level security;
alter table tasks enable row level security;
alter table audit_logs enable row level security;
alter table notifications enable row level security;

-- Policies expect JWT to include tenant_id claim
create policy tenant_isolation on tenants for select using (id::text = auth.jwt()->>'tenant_id');
create policy tenant_users_policy on tenant_users for all using (tenant_id::text = auth.jwt()->>'tenant_id');
create policy tenant_contracts on contracts for all using (tenant_id::text = auth.jwt()->>'tenant_id');
create policy tenant_contract_versions on contract_versions for all using (
    (select tenant_id from contracts where contracts.id = contract_versions.contract_id)::text = auth.jwt()->>'tenant_id'
);
create policy tenant_clauses on clauses for all using (
    (select c.tenant_id from contracts c join contract_versions cv on c.id = cv.contract_id where cv.id = clauses.contract_version_id)::text = auth.jwt()->>'tenant_id'
);
create policy tenant_risk_findings on risk_findings for all using (
    (select c.tenant_id from contracts c join contract_versions cv on c.id = cv.contract_id join clauses cl on cl.contract_version_id = cv.id where cl.id = risk_findings.clause_id)::text = auth.jwt()->>'tenant_id'
);
create policy tenant_key_clauses on key_clauses for all using (
    (select c.tenant_id from contracts c join contract_versions cv on c.id = cv.contract_id where cv.id = key_clauses.contract_version_id)::text = auth.jwt()->>'tenant_id'
);
create policy tenant_clause_rewrites on clause_rewrites for all using (
    (select c.tenant_id from contracts c join contract_versions cv on c.id = cv.contract_id join clauses cl on cl.contract_version_id = cv.id where cl.id = clause_rewrites.clause_id)::text = auth.jwt()->>'tenant_id'
);
create policy tenant_tasks on tasks for all using (tenant_id::text = auth.jwt()->>'tenant_id');
create policy tenant_notifications on notifications for all using (tenant_id::text = auth.jwt()->>'tenant_id');
create policy tenant_audit on audit_logs for select using (tenant_id::text = auth.jwt()->>'tenant_id');

create policy read_regulations on regulations for select using (true);
create policy read_regulation_sections on regulation_sections for select using (true);


