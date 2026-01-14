class AddThinkingFrameworkToArticles < ActiveRecord::Migration[7.2]
  def change
    add_column :articles, :thinking_framework, :string, default: 'original'

  end
end
