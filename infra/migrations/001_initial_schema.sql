-- Migration: 001_initial_schema.sql
-- Description: Initial database schema for SoulForge
-- Created: 2026-01-14

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create enum types
CREATE TYPE user_role AS ENUM ('buyer', 'seller', 'admin');
CREATE TYPE module_type AS ENUM ('base', 'remix');
CREATE TYPE module_status AS ENUM ('draft', 'published', 'blocked');
CREATE TYPE pricing_mode AS ENUM ('per_message', 'per_session');
CREATE TYPE payment_event AS ENUM ('settled', 'failed');
CREATE TYPE chat_message_role AS ENUM ('system', 'user', 'assistant');
CREATE TYPE document_source_type AS ENUM ('qa', 'doc');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address TEXT NOT NULL UNIQUE,
    role user_role NOT NULL DEFAULT 'buyer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_wallet_address ON users(wallet_address);

-- Modules table
CREATE TABLE modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type module_type NOT NULL DEFAULT 'base',
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tags TEXT[] NOT NULL DEFAULT '{}',
    status module_status NOT NULL DEFAULT 'draft',
    persona_prompt TEXT NOT NULL DEFAULT '',
    pricing_mode pricing_mode NOT NULL DEFAULT 'per_message',
    price_amount TEXT NOT NULL DEFAULT '10000', -- Integer string in smallest units
    session_policy JSONB, -- e.g., {minutes: 30, messageCredits: 10}
    pay_to TEXT NOT NULL,
    network TEXT NOT NULL,
    asset_contract TEXT NOT NULL,
    upstream_module_id UUID REFERENCES modules(id) ON DELETE SET NULL,
    remix_policy JSONB, -- e.g., {deltaPersona: "...", upstreamWeight: 0.5}
    eval_score INTEGER,
    last_eval_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_modules_owner ON modules(owner_user_id);
CREATE INDEX idx_modules_status ON modules(status);
CREATE INDEX idx_modules_type ON modules(type);
CREATE INDEX idx_modules_upstream ON modules(upstream_module_id);

-- Module documents table (for RAG/knowledge)
CREATE TABLE module_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    source_type document_source_type NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536), -- OpenAI text-embedding-3-small dimension
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_module_documents_module ON module_documents(module_id);

-- Payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    payer_wallet TEXT NOT NULL,
    pay_to TEXT NOT NULL,
    value TEXT NOT NULL, -- Integer string in smallest units
    tx_hash TEXT,
    network TEXT NOT NULL,
    event payment_event NOT NULL,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_module ON payments(module_id);
CREATE INDEX idx_payments_payer ON payments(payer_wallet);
CREATE INDEX idx_payments_tx_hash ON payments(tx_hash);
CREATE INDEX idx_payments_event ON payments(event);

-- Chats table
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    wallet_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chats_module ON chats(module_id);
CREATE INDEX idx_chats_wallet ON chats(wallet_address);

-- Chat messages table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role chat_message_role NOT NULL,
    content TEXT NOT NULL,
    token_usage JSONB, -- e.g., {promptTokens: 100, completionTokens: 50, totalTokens: 150}
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_chat ON chat_messages(chat_id);

-- Agent wallets table (for remix modules)
CREATE TABLE agent_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID NOT NULL UNIQUE REFERENCES modules(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    key_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agent_wallets_module ON agent_wallets(module_id);

-- Eval cases table
CREATE TABLE eval_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    rubric TEXT,
    expected_keywords TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_eval_cases_module ON eval_cases(module_id);

-- Eval runs table
CREATE TABLE eval_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_eval_runs_module ON eval_runs(module_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_modules_updated_at
    BEFORE UPDATE ON modules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
