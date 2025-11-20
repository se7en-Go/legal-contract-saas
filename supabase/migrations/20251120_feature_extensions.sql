-- Feature extensions: approvals, task retries, sample regulations/key clauses

alter table tasks
  add column if not exists retry_count integer not null default 0,
  add column if not exists last_error text;

create table if not exists task_attempts (
    id uuid primary key default gen_random_uuid(),
    task_id uuid not null references tasks(id) on delete cascade,
    attempt_no integer not null,
    status text not null,
    message text,
    created_at timestamptz not null default now()
);

alter table notifications
  add column if not exists severity text not null default 'info',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists delivered_at timestamptz;

create table if not exists approvals (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants(id) on delete cascade,
    entity_type text not null,
    entity_id uuid not null,
    status text not null default 'pending',
    assigned_to uuid references auth.users(id),
    note text,
    resolution text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists outgoing_webhooks (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants(id) on delete cascade,
    url text not null,
    secret text,
    event text not null,
    last_success_at timestamptz,
    created_at timestamptz not null default now()
);

-- Sample data for regulations
insert into regulations (id, name, jurisdiction, effective_date, expiry_date, source_url, created_at)
values
    ('8cf0f4b4-40bb-4d75-b0f0-dfdde4b1f111', '数据跨境安全管理规范', 'CN', '2024-01-01', null, 'https://example.com/regulations/cn/data-cross-border', now()),
    ('3f04b9ac-6247-4a90-91c4-55de4fd1d222', '通用数据保护条例 (GDPR)', 'EU', '2018-05-25', null, 'https://gdpr.eu', now())
on conflict (id) do nothing;

insert into regulation_sections (id, regulation_id, section_no, text, tags, embedding)
values
    ('1b6b8e8f-ba3a-4f6f-84d5-111111111111', '8cf0f4b4-40bb-4d75-b0f0-dfdde4b1f111', '第 8 条', '个人信息出境需通过安全评估，合同需明确双方责任。', array['security','contract'], null),
    ('1b6b8e8f-ba3a-4f6f-84d5-222222222222', '8cf0f4b4-40bb-4d75-b0f0-dfdde4b1f111', '第 15 条', '关键信息基础设施运营者需要与海外接收方约定技术与管理措施。', array['critical','infrastructure'], null),
    ('3b6b8e8f-ba3a-4f6f-84d5-333333333333', '3f04b9ac-6247-4a90-91c4-55de4fd1d222', 'Article 28', 'Controllers must include data processing obligations and audit rights in contracts.', array['gdpr','controller'], null)
on conflict (id) do nothing;

-- Sample key clauses
insert into key_clauses (id, clause_id, contract_version_id, category, summary, attributes, created_at)
values
    ('6c1601a7-5b66-4f89-a58f-444444444444', null, null, '数据保护', '双方需遵守跨境传输安全评估，并在 10 日内通报安全事件。', jsonb_build_object('sla_hours', 24, 'notify_window', '10d'), now()),
    ('7d2702b8-6c77-4e9a-b69f-555555555555', null, null, '服务等级', 'AI 审查平台需要提供 99.5% 可用性并记录所有 LLM 操作日志。', jsonb_build_object('availability', '99.5%', 'log_retention_days', 365), now())
on conflict (id) do nothing;
