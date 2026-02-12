-- Migration: Criar tabelas para Biblioteca de Prompts Claude Code
-- Data: 2026-02-12

-- Tabela principal de prompts da biblioteca
CREATE TABLE "prompts_library" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"category" text NOT NULL,
	"subcategory" text NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"content" text NOT NULL,
	"tools" text,
	"model" text,
	"source_url" text,
	"github_repo" text DEFAULT 'davila7/claude-code-templates' NOT NULL,
	"github_path" text NOT NULL,
	"last_synced_at" timestamp DEFAULT now(),
	"is_active" boolean DEFAULT true,
	"usage_count" integer DEFAULT 0,
	"is_translated" boolean DEFAULT false,
	"original_language" text DEFAULT 'en',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint

-- Tabela de favoritos dos usuários
CREATE TABLE "prompt_user_favorites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"user_id" varchar NOT NULL,
	"prompt_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint

-- Índices para melhor performance
CREATE INDEX "idx_prompts_library_category" ON "prompts_library"("category");
--> statement-breakpoint
CREATE INDEX "idx_prompts_library_subcategory" ON "prompts_library"("subcategory");
--> statement-breakpoint
CREATE INDEX "idx_prompts_library_is_active" ON "prompts_library"("is_active");
--> statement-breakpoint
CREATE INDEX "idx_prompts_library_name" ON "prompts_library"("name");
--> statement-breakpoint
CREATE INDEX "idx_prompt_user_favorites_user_id" ON "prompt_user_favorites"("user_id");
--> statement-breakpoint
CREATE INDEX "idx_prompt_user_favorites_prompt_id" ON "prompt_user_favorites"("prompt_id");
--> statement-breakpoint

-- Constraint única para evitar duplicatas de favoritos
CREATE UNIQUE INDEX "idx_prompt_user_favorites_unique" ON "prompt_user_favorites"("user_id", "prompt_id");
--> statement-breakpoint

-- Constraint única para evitar prompts duplicados do mesmo arquivo
CREATE UNIQUE INDEX "idx_prompts_library_github_path" ON "prompts_library"("github_path");
