class AddArchiveFieldsToArticles < ActiveRecord::Migration[7.2]
  def change
    add_reference :articles, :chapter, null: true, foreign_key: true
    add_column :articles, :position, :integer, default: 0
    add_column :articles, :archived, :boolean, default: false
    add_column :articles, :archived_at, :datetime

  end
end
