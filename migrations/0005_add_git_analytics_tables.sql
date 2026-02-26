-- Migration: Add Git Analytics Tables
-- Date: 2026-02-25
-- Purpose: Criar tabelas do módulo Git Analytics que podem não existir em produção

-- ============================================
-- Tabela: git_repositories
-- ============================================
CREATE TABLE IF NOT EXISTS git_repositories (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    github_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    owner TEXT NOT NULL,
    default_branch TEXT DEFAULT 'main',
    is_active BOOLEAN DEFAULT true,
    sync_enabled BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_git_repositories_full_name ON git_repositories(full_name);
CREATE INDEX IF NOT EXISTS idx_git_repositories_is_active ON git_repositories(is_active);

-- ============================================
-- Tabela: git_commits
-- ============================================
CREATE TABLE IF NOT EXISTS git_commits (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    repository_id VARCHAR(255) NOT NULL,
    sha TEXT NOT NULL UNIQUE,
    message TEXT NOT NULL,
    full_message TEXT,
    author_name TEXT NOT NULL,
    author_email TEXT,
    author_avatar_url TEXT,
    commit_type TEXT DEFAULT 'improvement',
    branch TEXT,
    pr_number INTEGER,
    files_changed INTEGER DEFAULT 0,
    additions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    committed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_git_commits_repository_id ON git_commits(repository_id);
CREATE INDEX IF NOT EXISTS idx_git_commits_author_name ON git_commits(author_name);
CREATE INDEX IF NOT EXISTS idx_git_commits_commit_type ON git_commits(commit_type);
CREATE INDEX IF NOT EXISTS idx_git_commits_committed_at ON git_commits(committed_at);
CREATE INDEX IF NOT EXISTS idx_git_commits_sha ON git_commits(sha);

-- ============================================
-- Tabela: git_pull_requests
-- ============================================
CREATE TABLE IF NOT EXISTS git_pull_requests (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    repository_id VARCHAR(255) NOT NULL,
    github_pr_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    author_name TEXT NOT NULL,
    author_avatar_url TEXT,
    status TEXT DEFAULT 'open',
    pr_type TEXT DEFAULT 'improvement',
    source_branch TEXT,
    target_branch TEXT,
    commits_count INTEGER DEFAULT 0,
    additions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    reviewers TEXT,
    labels TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    merged_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(repository_id, github_pr_number)
);

CREATE INDEX IF NOT EXISTS idx_git_pull_requests_repository_id ON git_pull_requests(repository_id);
CREATE INDEX IF NOT EXISTS idx_git_pull_requests_author_name ON git_pull_requests(author_name);
CREATE INDEX IF NOT EXISTS idx_git_pull_requests_status ON git_pull_requests(status);
CREATE INDEX IF NOT EXISTS idx_git_pull_requests_created_at ON git_pull_requests(created_at);

-- ============================================
-- Tabela: git_security_alerts
-- ============================================
CREATE TABLE IF NOT EXISTS git_security_alerts (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    repository_id VARCHAR(255) NOT NULL,
    github_alert_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL,
    package_name TEXT NOT NULL,
    package_ecosystem TEXT,
    vulnerable_version TEXT,
    patched_version TEXT,
    status TEXT DEFAULT 'open',
    is_direct_dependency BOOLEAN DEFAULT false,
    cve_id TEXT,
    ghsa_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    dismissed_at TIMESTAMP WITH TIME ZONE,
    fixed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(repository_id, github_alert_number)
);

CREATE INDEX IF NOT EXISTS idx_git_security_alerts_repository_id ON git_security_alerts(repository_id);
CREATE INDEX IF NOT EXISTS idx_git_security_alerts_severity ON git_security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_git_security_alerts_status ON git_security_alerts(status);

-- ============================================
-- Tabela: git_branches
-- ============================================
CREATE TABLE IF NOT EXISTS git_branches (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255),
    repository_id VARCHAR(255) NOT NULL,
    name TEXT NOT NULL,
    sha TEXT NOT NULL,
    is_default BOOLEAN DEFAULT false,
    is_protected BOOLEAN DEFAULT false,
    ahead_by INTEGER DEFAULT 0,
    behind_by INTEGER DEFAULT 0,
    has_open_pr BOOLEAN DEFAULT false,
    last_commit_at TIMESTAMP WITH TIME ZONE,
    last_commit_author TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(repository_id, name)
);

CREATE INDEX IF NOT EXISTS idx_git_branches_repository_id ON git_branches(repository_id);
CREATE INDEX IF NOT EXISTS idx_git_branches_has_open_pr ON git_branches(has_open_pr);
CREATE INDEX IF NOT EXISTS idx_git_branches_ahead_by ON git_branches(ahead_by);
