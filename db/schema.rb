# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.2].define(version: 2026_03_10_020132) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "admin_oplogs", force: :cascade do |t|
    t.bigint "administrator_id", null: false
    t.string "action"
    t.string "resource_type"
    t.integer "resource_id"
    t.string "ip_address"
    t.text "user_agent"
    t.text "details"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["action"], name: "index_admin_oplogs_on_action"
    t.index ["administrator_id"], name: "index_admin_oplogs_on_administrator_id"
    t.index ["created_at"], name: "index_admin_oplogs_on_created_at"
    t.index ["resource_type", "resource_id"], name: "index_admin_oplogs_on_resource_type_and_resource_id"
  end

  create_table "administrators", force: :cascade do |t|
    t.string "name", null: false
    t.string "password_digest"
    t.string "role", null: false
    t.boolean "first_login", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_administrators_on_name", unique: true
    t.index ["role"], name: "index_administrators_on_role"
  end

  create_table "articles", force: :cascade do |t|
    t.text "transcript"
    t.text "brainstorm_grok"
    t.text "brainstorm_qwen"
    t.text "brainstorm_deepseek"
    t.text "brainstorm_gemini"
    t.string "selected_model"
    t.text "draft"
    t.string "final_style"
    t.text "final_content"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "chapter_id"
    t.integer "position", default: 0
    t.boolean "archived", default: false
    t.datetime "archived_at"
    t.integer "word_count", default: 0
    t.string "thinking_framework", default: "original"
    t.bigint "user_id"
    t.text "brainstorm_doubao"
    t.text "title"
    t.string "title_style"
    t.text "variant"
    t.string "variant_style"
    t.jsonb "brainstorm_status", default: {}
    t.text "draft_grok"
    t.text "draft_qwen"
    t.text "draft_deepseek"
    t.text "draft_gemini"
    t.text "draft_doubao"
    t.jsonb "draft_status", default: {}
    t.string "writing_style", default: "original"
    t.jsonb "titles_27"
    t.string "titles_27_source"
    t.index ["chapter_id"], name: "index_articles_on_chapter_id"
    t.index ["user_id"], name: "index_articles_on_user_id"
  end

  create_table "books", force: :cascade do |t|
    t.string "title"
    t.string "subtitle"
    t.text "description"
    t.string "author"
    t.string "status", default: "draft"
    t.datetime "published_at"
    t.boolean "pinned", default: false
    t.string "cover_style", default: "gradient"
    t.string "slug"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "cover_scheme_index"
    t.bigint "user_id"
    t.index ["user_id"], name: "index_books_on_user_id"
  end

  create_table "case_authors", force: :cascade do |t|
    t.bigint "legal_case_id"
    t.bigint "user_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["legal_case_id"], name: "index_case_authors_on_legal_case_id"
    t.index ["user_id"], name: "index_case_authors_on_user_id"
  end

  create_table "case_deadlines", force: :cascade do |t|
    t.bigint "legal_case_id"
    t.string "deadline_type"
    t.datetime "deadline_date"
    t.text "description"
    t.boolean "is_completed", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["legal_case_id"], name: "index_case_deadlines_on_legal_case_id"
    t.index ["user_id"], name: "index_case_deadlines_on_user_id"
  end

  create_table "case_organizations", force: :cascade do |t|
    t.bigint "legal_case_id"
    t.bigint "organization_id"
    t.string "stage"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "case_number"
    t.decimal "claim_amount"
    t.integer "primary_contact_id"
    t.integer "secondary_contact_id"
    t.string "crime_name"
    t.string "officer_name"
    t.string "assistant_name"
    t.integer "tertiary_contact_id"
    t.index ["legal_case_id"], name: "index_case_organizations_on_legal_case_id"
    t.index ["organization_id"], name: "index_case_organizations_on_organization_id"
  end

  create_table "case_parties", force: :cascade do |t|
    t.bigint "legal_case_id"
    t.bigint "client_id"
    t.string "party_role"
    t.boolean "is_client", default: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["client_id"], name: "index_case_parties_on_client_id"
    t.index ["legal_case_id"], name: "index_case_parties_on_legal_case_id"
  end

  create_table "categories", force: :cascade do |t|
    t.string "name"
    t.string "slug"
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_categories_on_name", unique: true
    t.index ["slug"], name: "index_categories_on_slug", unique: true
  end

  create_table "chapters", force: :cascade do |t|
    t.bigint "book_id"
    t.bigint "parent_id"
    t.string "title"
    t.integer "position", default: 0
    t.integer "level", default: 1
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["book_id"], name: "index_chapters_on_book_id"
    t.index ["parent_id"], name: "index_chapters_on_parent_id"
  end

  create_table "client_notes", force: :cascade do |t|
    t.bigint "client_id"
    t.text "content"
    t.bigint "user_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["client_id"], name: "index_client_notes_on_client_id"
    t.index ["user_id"], name: "index_client_notes_on_user_id"
  end

  create_table "clients", force: :cascade do |t|
    t.string "name_first"
    t.string "name_middle"
    t.string "name_last"
    t.date "date_birth"
    t.string "citizen_number"
    t.string "gender", default: "unknown"
    t.string "civil_status", default: "unknown"
    t.string "income", default: "unknown"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "client_type", default: "individual"
    t.string "company_name"
    t.string "unified_social_credit_code"
    t.string "legal_representative"
    t.text "address"
    t.string "phone"
    t.string "star_level", default: "none"
    t.bigint "user_id"
    t.index ["star_level"], name: "index_clients_on_star_level"
    t.index ["user_id"], name: "index_clients_on_user_id"
  end

  create_table "court_hearings", force: :cascade do |t|
    t.bigint "legal_case_id"
    t.datetime "hearing_date"
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["legal_case_id"], name: "index_court_hearings_on_legal_case_id"
    t.index ["user_id"], name: "index_court_hearings_on_user_id"
  end

  create_table "feedbacks", force: :cascade do |t|
    t.bigint "user_id"
    t.text "content"
    t.text "admin_reply", default: ""
    t.string "status", default: "pending"
    t.datetime "replied_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_feedbacks_on_user_id"
  end

  create_table "followups", force: :cascade do |t|
    t.string "type_followup", default: "consultation"
    t.text "description"
    t.datetime "date_start"
    t.datetime "date_end"
    t.decimal "sumbilled"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "legal_case_id"
    t.bigint "user_id", null: false
    t.boolean "is_billable", default: false, null: false
    t.index ["legal_case_id"], name: "index_followups_on_legal_case_id"
    t.index ["user_id"], name: "index_followups_on_user_id"
  end

  create_table "friendly_id_slugs", force: :cascade do |t|
    t.string "slug", null: false
    t.integer "sluggable_id", null: false
    t.string "sluggable_type", limit: 50
    t.string "scope"
    t.datetime "created_at"
    t.index ["slug", "sluggable_type", "scope"], name: "index_friendly_id_slugs_on_slug_and_sluggable_type_and_scope", unique: true
    t.index ["slug", "sluggable_type"], name: "index_friendly_id_slugs_on_slug_and_sluggable_type"
    t.index ["sluggable_type", "sluggable_id"], name: "index_friendly_id_slugs_on_sluggable_type_and_sluggable_id"
  end

  create_table "good_job_batches", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "description"
    t.jsonb "serialized_properties"
    t.text "on_finish"
    t.text "on_success"
    t.text "on_discard"
    t.text "callback_queue_name"
    t.integer "callback_priority"
    t.datetime "enqueued_at"
    t.datetime "discarded_at"
    t.datetime "finished_at"
    t.datetime "jobs_finished_at"
  end

  create_table "good_job_executions", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.uuid "active_job_id", null: false
    t.text "job_class"
    t.text "queue_name"
    t.jsonb "serialized_params"
    t.datetime "scheduled_at"
    t.datetime "finished_at"
    t.text "error"
    t.integer "error_event", limit: 2
    t.text "error_backtrace", array: true
    t.uuid "process_id"
    t.interval "duration"
    t.index ["active_job_id", "created_at"], name: "index_good_job_executions_on_active_job_id_and_created_at"
    t.index ["process_id", "created_at"], name: "index_good_job_executions_on_process_id_and_created_at"
  end

  create_table "good_job_processes", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "state"
    t.integer "lock_type", limit: 2
  end

  create_table "good_job_settings", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "key"
    t.jsonb "value"
    t.index ["key"], name: "index_good_job_settings_on_key", unique: true
  end

  create_table "good_jobs", id: :uuid, default: -> { "gen_random_uuid()" }, force: :cascade do |t|
    t.text "queue_name"
    t.integer "priority"
    t.jsonb "serialized_params"
    t.datetime "scheduled_at"
    t.datetime "performed_at"
    t.datetime "finished_at"
    t.text "error"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.uuid "active_job_id"
    t.text "concurrency_key"
    t.text "cron_key"
    t.uuid "retried_good_job_id"
    t.datetime "cron_at"
    t.uuid "batch_id"
    t.uuid "batch_callback_id"
    t.boolean "is_discrete"
    t.integer "executions_count"
    t.text "job_class"
    t.integer "error_event", limit: 2
    t.text "labels", array: true
    t.uuid "locked_by_id"
    t.datetime "locked_at"
    t.index ["active_job_id", "created_at"], name: "index_good_jobs_on_active_job_id_and_created_at"
    t.index ["batch_callback_id"], name: "index_good_jobs_on_batch_callback_id", where: "(batch_callback_id IS NOT NULL)"
    t.index ["batch_id"], name: "index_good_jobs_on_batch_id", where: "(batch_id IS NOT NULL)"
    t.index ["concurrency_key", "created_at"], name: "index_good_jobs_on_concurrency_key_and_created_at"
    t.index ["concurrency_key"], name: "index_good_jobs_on_concurrency_key_when_unfinished", where: "(finished_at IS NULL)"
    t.index ["cron_key", "created_at"], name: "index_good_jobs_on_cron_key_and_created_at_cond", where: "(cron_key IS NOT NULL)"
    t.index ["cron_key", "cron_at"], name: "index_good_jobs_on_cron_key_and_cron_at_cond", unique: true, where: "(cron_key IS NOT NULL)"
    t.index ["finished_at"], name: "index_good_jobs_jobs_on_finished_at", where: "((retried_good_job_id IS NULL) AND (finished_at IS NOT NULL))"
    t.index ["labels"], name: "index_good_jobs_on_labels", where: "(labels IS NOT NULL)", using: :gin
    t.index ["locked_by_id"], name: "index_good_jobs_on_locked_by_id", where: "(locked_by_id IS NOT NULL)"
    t.index ["priority", "created_at"], name: "index_good_job_jobs_for_candidate_lookup", where: "(finished_at IS NULL)"
    t.index ["priority", "created_at"], name: "index_good_jobs_jobs_on_priority_created_at_when_unfinished", order: { priority: "DESC NULLS LAST" }, where: "(finished_at IS NULL)"
    t.index ["priority", "scheduled_at"], name: "index_good_jobs_on_priority_scheduled_at_unfinished_unlocked", where: "((finished_at IS NULL) AND (locked_by_id IS NULL))"
    t.index ["queue_name", "scheduled_at"], name: "index_good_jobs_on_queue_name_and_scheduled_at", where: "(finished_at IS NULL)"
    t.index ["scheduled_at"], name: "index_good_jobs_on_scheduled_at", where: "(finished_at IS NULL)"
  end

  create_table "legal_cases", force: :cascade do |t|
    t.string "title", default: "Untitled Case"
    t.string "status", default: "open"
    t.text "notes"
    t.date "date_assignment"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.date "entrust_date"
    t.decimal "lawyer_fee"
    t.string "cause_of_action"
    t.string "procedure_stage"
    t.string "project_type", default: "civil", null: false
    t.bigint "user_id", null: false
    t.index ["created_at", "project_type"], name: "index_legal_cases_on_created_at_and_project_type"
    t.index ["project_type"], name: "index_legal_cases_on_project_type"
    t.index ["user_id"], name: "index_legal_cases_on_user_id"
  end

  create_table "memberships", force: :cascade do |t|
    t.bigint "user_id"
    t.string "plan_type", default: "trial"
    t.datetime "started_at"
    t.datetime "expires_at"
    t.string "status", default: "active"
    t.string "stripe_subscription_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "is_trial_upgrade", default: false, null: false
    t.boolean "trial_discount_applied", default: false, null: false
    t.index ["user_id"], name: "index_memberships_on_user_id"
  end

  create_table "orders", force: :cascade do |t|
    t.bigint "user_id"
    t.string "product_name"
    t.decimal "amount"
    t.string "currency", default: "usd"
    t.string "status", default: "pending"
    t.string "stripe_payment_intent_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_orders_on_user_id"
  end

  create_table "organization_contacts", force: :cascade do |t|
    t.bigint "organization_id"
    t.string "contact_type"
    t.string "name"
    t.string "phone"
    t.text "address"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "notes"
    t.string "star_level", default: "none"
    t.bigint "user_id"
    t.index ["organization_id"], name: "index_organization_contacts_on_organization_id"
    t.index ["star_level"], name: "index_organization_contacts_on_star_level"
    t.index ["user_id"], name: "index_organization_contacts_on_user_id"
  end

  create_table "organizations", force: :cascade do |t|
    t.string "name"
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "org_type"
    t.bigint "user_id"
    t.index ["user_id"], name: "index_organizations_on_user_id"
  end

  create_table "packages", force: :cascade do |t|
    t.string "name"
    t.integer "price"
    t.integer "articles_count"
    t.text "description"
    t.boolean "recommended", default: false
    t.integer "position", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  create_table "payment_records", force: :cascade do |t|
    t.bigint "legal_case_id"
    t.date "payment_date", null: false
    t.decimal "amount", precision: 10, scale: 2, default: "0.0", null: false
    t.text "notes"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["legal_case_id"], name: "index_payment_records_on_legal_case_id"
    t.index ["payment_date"], name: "index_payment_records_on_payment_date"
    t.index ["user_id"], name: "index_payment_records_on_user_id"
  end

  create_table "payments", force: :cascade do |t|
    t.string "payable_type", null: false
    t.bigint "payable_id", null: false
    t.bigint "user_id"
    t.decimal "amount"
    t.string "currency", default: "usd"
    t.string "status", default: "pending"
    t.string "stripe_payment_intent_id"
    t.string "stripe_checkout_session_id"
    t.string "payment_method"
    t.jsonb "metadata"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["payable_type", "payable_id"], name: "index_payments_on_payable"
    t.index ["user_id"], name: "index_payments_on_user_id"
  end

  create_table "personas", force: :cascade do |t|
    t.string "name"
    t.text "description"
    t.text "system_prompt"
    t.boolean "active", default: true
    t.integer "position", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "llm_provider", default: "grok"
  end

  create_table "sessions", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "user_agent"
    t.string "ip_address"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["user_id"], name: "index_sessions_on_user_id"
  end

  create_table "skills", force: :cascade do |t|
    t.string "title"
    t.text "description"
    t.decimal "price", default: "99.0"
    t.bigint "category_id"
    t.string "author_name"
    t.integer "template_count", default: 0
    t.integer "download_count", default: 0
    t.decimal "rating", default: "0.0"
    t.string "slug"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["category_id"], name: "index_skills_on_category_id"
    t.index ["slug"], name: "index_skills_on_slug", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.string "name"
    t.string "email", null: false
    t.string "password_digest"
    t.boolean "verified", default: false, null: false
    t.string "provider"
    t.string "uid"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "credits", default: 30
    t.string "email_verification_code"
    t.datetime "email_verification_code_expires_at"
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  create_table "video_resources", force: :cascade do |t|
    t.string "title"
    t.string "bilibili_url"
    t.string "duration"
    t.integer "views_count", default: 0
    t.bigint "category_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["category_id"], name: "index_video_resources_on_category_id"
  end

  create_table "writing_tips", force: :cascade do |t|
    t.text "content", default: ""
    t.boolean "active", default: true
    t.integer "position", default: 0
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "admin_oplogs", "administrators"
  add_foreign_key "articles", "chapters"
  add_foreign_key "articles", "users"
  add_foreign_key "books", "users"
  add_foreign_key "followups", "legal_cases", on_delete: :nullify
  add_foreign_key "payment_records", "legal_cases", on_delete: :nullify
  add_foreign_key "sessions", "users"
end
