class AddBrainstormDoubaoToArticles < ActiveRecord::Migration[7.2]
  def change
    add_column :articles, :brainstorm_doubao, :text

  end
end
