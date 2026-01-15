class AddTitleFieldsToArticles < ActiveRecord::Migration[7.2]
  def change
    add_column :articles, :title, :text
    add_column :articles, :title_style, :string

  end
end
