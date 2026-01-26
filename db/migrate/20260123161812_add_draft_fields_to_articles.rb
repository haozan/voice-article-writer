class AddDraftFieldsToArticles < ActiveRecord::Migration[7.2]
  def change
    add_column :articles, :draft_grok, :text
    add_column :articles, :draft_qwen, :text
    add_column :articles, :draft_deepseek, :text
    add_column :articles, :draft_gemini, :text
    add_column :articles, :draft_zhipu, :text
    add_column :articles, :draft_doubao, :text
    add_column :articles, :draft_status, :jsonb, default: {}

  end
end
