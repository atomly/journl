-- Additive Explore migration. Apply atomically through explore:setup.
CREATE UNIQUE INDEX IF NOT EXISTS document_owner_id ON document (user_id, id);
CREATE INDEX IF NOT EXISTS document_owner_activity ON document (user_id, updated_at DESC, id);
CREATE TABLE "explore_cluster" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"manual_name" text,
	"retired_at" timestamp with time zone
);
CREATE TABLE "explore_cluster_lineage" (
	"user_id" text NOT NULL,
	"from_id" uuid NOT NULL,
	"to_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "explore_cluster_lineage_from_id_to_id_pk" PRIMARY KEY("from_id","to_id")
);
CREATE TABLE "explore_cluster_member" (
	"user_id" text NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"cluster_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"role" text NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "explore_cluster_member_snapshot_id_cluster_id_document_id_pk" PRIMARY KEY("snapshot_id","cluster_id","document_id"),
	CONSTRAINT "explore_member_role" CHECK ("explore_cluster_member"."role" in ('primary', 'related'))
);
CREATE TABLE "explore_cluster_snapshot" (
	"user_id" text NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"cluster_id" uuid NOT NULL,
	"generated_name" text NOT NULL,
	"representatives" jsonb NOT NULL,
	"primary_count" integer NOT NULL,
	"related_count" integer NOT NULL,
	"source_count" integer NOT NULL,
	"last_activity" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "explore_cluster_snapshot_snapshot_id_cluster_id_pk" PRIMARY KEY("snapshot_id","cluster_id")
);
CREATE TABLE "explore_cluster_source" (
	"user_id" text NOT NULL,
	"snapshot_id" uuid NOT NULL,
	"cluster_id" uuid NOT NULL,
	"target_key" text NOT NULL,
	"url" text NOT NULL,
	"document_count" integer NOT NULL,
	CONSTRAINT "explore_cluster_source_snapshot_id_cluster_id_target_key_pk" PRIMARY KEY("snapshot_id","cluster_id","target_key")
);
CREATE TABLE "explore_refresh_outbox" (
	"user_id" text PRIMARY KEY NOT NULL,
	"revision" integer NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dispatched_at" timestamp with time zone
);
CREATE TABLE "explore_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"source_revision" integer NOT NULL,
	"algorithm_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE "explore_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"source_revision" integer DEFAULT 0 NOT NULL,
	"published_revision" integer DEFAULT -1 NOT NULL,
	"active_snapshot_id" uuid,
	"dirty_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_token" uuid,
	"lease_until" timestamp with time zone
);
CREATE UNIQUE INDEX "explore_cluster_owner_id" ON "explore_cluster" USING btree ("user_id","id");
CREATE UNIQUE INDEX "explore_primary_membership" ON "explore_cluster_member" USING btree ("snapshot_id","document_id") WHERE "explore_cluster_member"."role" = 'primary';
CREATE INDEX "explore_member_document" ON "explore_cluster_member" USING btree ("user_id","snapshot_id","document_id");
CREATE INDEX "explore_member_cluster" ON "explore_cluster_member" USING btree ("user_id","snapshot_id","cluster_id","role","document_id");
CREATE UNIQUE INDEX "explore_summary_owner_key" ON "explore_cluster_snapshot" USING btree ("user_id","snapshot_id","cluster_id");
CREATE INDEX "explore_summary_activity" ON "explore_cluster_snapshot" USING btree ("user_id","snapshot_id","last_activity" DESC NULLS LAST,"cluster_id");
CREATE UNIQUE INDEX "explore_snapshot_owner_id" ON "explore_snapshot" USING btree ("user_id","id");
CREATE UNIQUE INDEX "explore_snapshot_revision" ON "explore_snapshot" USING btree ("user_id","source_revision","algorithm_version");
ALTER TABLE "explore_cluster" ADD CONSTRAINT "explore_cluster_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "explore_cluster_lineage" ADD CONSTRAINT "explore_cluster_lineage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "explore_cluster_lineage" ADD CONSTRAINT "explore_cluster_lineage_user_id_from_id_explore_cluster_user_id_id_fk" FOREIGN KEY ("user_id","from_id") REFERENCES "public"."explore_cluster"("user_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "explore_cluster_lineage" ADD CONSTRAINT "explore_cluster_lineage_user_id_to_id_explore_cluster_user_id_id_fk" FOREIGN KEY ("user_id","to_id") REFERENCES "public"."explore_cluster"("user_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "explore_cluster_member" ADD CONSTRAINT "explore_cluster_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "explore_cluster_member" ADD CONSTRAINT "explore_cluster_member_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "explore_cluster_member" ADD CONSTRAINT "explore_cluster_member_user_id_document_id_document_user_id_id_fk" FOREIGN KEY ("user_id","document_id") REFERENCES "public"."document"("user_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "explore_cluster_member" ADD CONSTRAINT "explore_cluster_member_user_id_snapshot_id_cluster_id_explore_cluster_snapshot_user_id_snapshot_id_cluster_id_fk" FOREIGN KEY ("user_id","snapshot_id","cluster_id") REFERENCES "public"."explore_cluster_snapshot"("user_id","snapshot_id","cluster_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "explore_cluster_snapshot" ADD CONSTRAINT "explore_cluster_snapshot_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "explore_cluster_snapshot" ADD CONSTRAINT "explore_cluster_snapshot_user_id_snapshot_id_explore_snapshot_user_id_id_fk" FOREIGN KEY ("user_id","snapshot_id") REFERENCES "public"."explore_snapshot"("user_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "explore_cluster_snapshot" ADD CONSTRAINT "explore_cluster_snapshot_user_id_cluster_id_explore_cluster_user_id_id_fk" FOREIGN KEY ("user_id","cluster_id") REFERENCES "public"."explore_cluster"("user_id","id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "explore_cluster_source" ADD CONSTRAINT "explore_cluster_source_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "explore_cluster_source" ADD CONSTRAINT "explore_cluster_source_user_id_snapshot_id_cluster_id_explore_cluster_snapshot_user_id_snapshot_id_cluster_id_fk" FOREIGN KEY ("user_id","snapshot_id","cluster_id") REFERENCES "public"."explore_cluster_snapshot"("user_id","snapshot_id","cluster_id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "explore_refresh_outbox" ADD CONSTRAINT "explore_refresh_outbox_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "explore_snapshot" ADD CONSTRAINT "explore_snapshot_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "explore_state" ADD CONSTRAINT "explore_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "explore_cluster" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "explore_cluster_lineage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "explore_cluster_member" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "explore_cluster_snapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "explore_cluster_source" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "explore_refresh_outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "explore_snapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "explore_state" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "explore_state" ADD CONSTRAINT "explore_state_snapshot_owner_fk" FOREIGN KEY ("user_id", "active_snapshot_id") REFERENCES "explore_snapshot" ("user_id", "id");
