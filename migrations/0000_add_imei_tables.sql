CREATE TABLE "ai_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"user_id" varchar NOT NULL,
	"title" text DEFAULT 'Nova conversa',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"conversation_id" varchar NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_space_conversations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"space_id" varchar NOT NULL,
	"conversation_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_spaces" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#00A137',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api_integrations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"base_url" text,
	"status" text DEFAULT 'aguardando_credenciais' NOT NULL,
	"documentation" text,
	"endpoints" text,
	"credentials_configured" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "collection_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"origem" text NOT NULL,
	"destino" text NOT NULL,
	"peso" text NOT NULL,
	"cubagem" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"operator_id" varchar,
	"valor_estimado" text,
	"prazo_estimado" integer,
	"observacao" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "flowchart_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flowchart_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"node_id" varchar,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "flowchart_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"flowchart_id" varchar NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"created_by" varchar NOT NULL,
	"snapshot_json" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "flowcharts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"owner_id" varchar NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"nodes_data" text,
	"edges_data" text,
	"viewport" text,
	"permissions" text,
	"is_template" boolean DEFAULT false,
	"template_category" text,
	"thumbnail" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "freight_simulations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"cidade_origem" text NOT NULL,
	"cidade_destino" text NOT NULL,
	"peso" text NOT NULL,
	"volume" text NOT NULL,
	"resultados" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "imei_info_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"threshold_value" integer NOT NULL,
	"alert_emails" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_triggered" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "imei_info_stats" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"date" timestamp NOT NULL,
	"total_orders" integer DEFAULT 0,
	"credits" integer DEFAULT 0,
	"success" integer DEFAULT 0,
	"pending" integer DEFAULT 0,
	"failed" integer DEFAULT 0,
	"number_of_checks" integer DEFAULT 0,
	"average_ticket" numeric(10, 2),
	"total_service_value" numeric(12, 2),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kanban_cards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"code" text NOT NULL,
	"column_id" varchar NOT NULL,
	"project_id" varchar NOT NULL,
	"title" text NOT NULL,
	"objectives" text,
	"development" text,
	"assignee_id" varchar,
	"reporter_id" varchar,
	"start_date" timestamp,
	"end_date" timestamp,
	"due_date" timestamp,
	"tags" text[],
	"priority" text DEFAULT 'normal' NOT NULL,
	"estimation" integer,
	"attachments" text[],
	"order" integer DEFAULT 0 NOT NULL,
	"ticket_id" varchar,
	"parent_card_id" varchar,
	"progress" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kanban_columns" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"project_id" varchar NOT NULL,
	"name" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kanban_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"card_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "key_result_updates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"key_result_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"previous_value" numeric,
	"new_value" numeric NOT NULL,
	"progress_percentage" numeric,
	"comment" text,
	"evidence_links" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "key_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"objective_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"measurement_type" text DEFAULT 'percentage' NOT NULL,
	"start_value" numeric,
	"target_value" numeric NOT NULL,
	"current_value" numeric DEFAULT '0' NOT NULL,
	"unit" text,
	"responsible_ids" text,
	"due_date" timestamp,
	"deadline_status" text DEFAULT 'on_track',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_audit_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"document_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"acao" text NOT NULL,
	"detalhes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_document_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"document_id" varchar NOT NULL,
	"versao" text NOT NULL,
	"conteudo" text,
	"anexos" text,
	"alterado_por" varchar NOT NULL,
	"resumo_alteracoes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"area" text NOT NULL,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"versao" text DEFAULT 'V1' NOT NULL,
	"data_mes_ano" text NOT NULL,
	"nome_arquivo" text NOT NULL,
	"conteudo" text,
	"tags" text,
	"anexos" text,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"aprovado_por" varchar,
	"aprovado_em" timestamp,
	"rejeitado_por" varchar,
	"rejeitado_em" timestamp,
	"motivo_rejeicao" text,
	"visibilidade" text DEFAULT 'todos' NOT NULL,
	"permissoes_visualizacao" text,
	"criador_id" varchar NOT NULL,
	"ultima_edicao_por" varchar,
	"ultima_edicao_em" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "knowledge_favorites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"user_id" varchar NOT NULL,
	"document_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "logistic_operators" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"razao_social" text NOT NULL,
	"cnpj" text NOT NULL,
	"contato" text,
	"email" text NOT NULL,
	"telefone" text,
	"ativo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "logistica_reversa_eventos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"pedido_id" varchar NOT NULL,
	"status" text NOT NULL,
	"descricao" text,
	"data_evento" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "logistica_reversa_pedidos" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"numero_pedido" text,
	"numero_etiqueta" text,
	"tipo" text NOT NULL,
	"codigo_servico" text NOT NULL,
	"status" text DEFAULT 'solicitado' NOT NULL,
	"id_cliente" text,
	"prazo" text,
	"remetente_nome" text,
	"remetente_cep" text,
	"remetente_endereco" text,
	"remetente_cidade" text,
	"remetente_uf" text,
	"remetente_email" text,
	"remetente_telefone" text,
	"remetente_ddd" text,
	"destinatario_nome" text,
	"destinatario_cep" text,
	"destinatario_endereco" text,
	"destinatario_cidade" text,
	"destinatario_uf" text,
	"observacao" text,
	"itens_coleta" text,
	"tipo_embalagem" text,
	"valor_declarado" text,
	"adicional_anac" boolean DEFAULT false,
	"custo_estimado" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meta_areas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"name" text NOT NULL,
	"color" text DEFAULT '#00A137' NOT NULL,
	"archived" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "meta_checkins" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"meta_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"previous_value" numeric NOT NULL,
	"new_value" numeric NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "metas" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"area_id" varchar NOT NULL,
	"responsible_id" varchar NOT NULL,
	"measurement_type" text DEFAULT 'percentage' NOT NULL,
	"target_value" numeric NOT NULL,
	"current_value" numeric DEFAULT '0' NOT NULL,
	"unit" text,
	"month" text NOT NULL,
	"status" text DEFAULT 'on_track' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"user_id" varchar NOT NULL,
	"from_user_id" varchar,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"module" text NOT NULL,
	"entity_id" varchar,
	"link_url" text NOT NULL,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "objectives" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"owner_id" varchar NOT NULL,
	"level" text DEFAULT 'company' NOT NULL,
	"cycle" text NOT NULL,
	"status" text DEFAULT 'on_track' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pricing_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"user_id" varchar NOT NULL,
	"device_id" varchar NOT NULL,
	"alert_type" text NOT NULL,
	"threshold_percent" numeric NOT NULL,
	"is_active" boolean DEFAULT true,
	"last_triggered" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pricing_devices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"category_id" text NOT NULL,
	"category_name" text NOT NULL,
	"manufacturer_name" text NOT NULL,
	"model_name" text NOT NULL,
	"storage" integer NOT NULL,
	"condition" text DEFAULT 'novo',
	"image_url" text,
	"specs" text,
	"release_date" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "pricing_price_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"device_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"min_price" numeric,
	"avg_price" numeric,
	"max_price" numeric,
	"sample_count" integer DEFAULT 0,
	"source" text DEFAULT 'scraping',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"project_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"code" text DEFAULT '' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"owner_id" varchar NOT NULL,
	"start_date" timestamp,
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "shipment_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"shipment_id" varchar NOT NULL,
	"status" text NOT NULL,
	"location" text,
	"description" text,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"tracking_code" text NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"carrier" text,
	"weight" text,
	"dimensions" text,
	"estimated_delivery" timestamp,
	"actual_delivery" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "shipments_tracking_code_unique" UNIQUE("tracking_code")
);
--> statement-breakpoint
CREATE TABLE "sla_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"tipo" text NOT NULL,
	"prioridade" text NOT NULL,
	"sla_horas" numeric NOT NULL,
	"ativo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_tag_members" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"tag_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_tags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"name" text NOT NULL,
	"description" text,
	"owner_id" varchar NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"scope" text DEFAULT 'tasks' NOT NULL,
	"color" text DEFAULT '#00A137',
	"icon" text DEFAULT 'folder',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_attachments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"task_id" varchar NOT NULL,
	"uploaded_by" varchar NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer,
	"file_type" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"task_id" varchar NOT NULL,
	"author_id" varchar NOT NULL,
	"content" text NOT NULL,
	"parent_comment_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_reactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"comment_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"structure" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"tag_id" varchar NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"attachments" text,
	"type" text DEFAULT 'task' NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"assignee_id" varchar,
	"assignee_ids" text,
	"due_date" timestamp,
	"created_by" varchar NOT NULL,
	"meeting_data" text,
	"order" integer DEFAULT 0 NOT NULL,
	"is_recurring" boolean DEFAULT false,
	"recurrence_type" text,
	"recurrence_weekdays" text,
	"recurrence_end_date" timestamp,
	"parent_task_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"cnpj" text,
	"logo" text,
	"primary_color" text DEFAULT '#00A137',
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ticket_comments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"ticket_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"content" text NOT NULL,
	"attachments" text,
	"is_internal" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ticket_responsaveis" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"categoria" text NOT NULL,
	"tipo" text NOT NULL,
	"usuario_responsavel_id" varchar NOT NULL,
	"ativo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"attachments" text,
	"category" text NOT NULL,
	"type" text DEFAULT 'bug' NOT NULL,
	"location" text DEFAULT 'outros' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"impact" text DEFAULT 'medio' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"requester_id" varchar NOT NULL,
	"assignee_id" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"due_date" timestamp,
	"data_abertura" timestamp DEFAULT now(),
	"data_primeira_resposta" timestamp,
	"data_resolucao" timestamp,
	"data_fechamento" timestamp,
	"description_last_edited_by" varchar,
	"description_last_edited_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "updates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"version" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" text DEFAULT 'feature' NOT NULL,
	"source" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp,
	"created_by" varchar
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text,
	"status" text DEFAULT 'active' NOT NULL,
	"auth_method" text DEFAULT 'email' NOT NULL,
	"avatar_url" text,
	"is_admin" boolean DEFAULT false,
	"area_negocio" text,
	"perfil_acesso" text,
	"module_permissions" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
