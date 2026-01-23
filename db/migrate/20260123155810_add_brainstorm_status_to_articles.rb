class AddBrainstormStatusToArticles < ActiveRecord::Migration[7.2]
  def change
    add_column :articles, :brainstorm_status, :jsonb, default: {}
  end
end
