class AddTitles27ToArticles < ActiveRecord::Migration[7.2]
  def change
    add_column :articles, :titles_27, :jsonb
    add_column :articles, :titles_27_source, :string

  end
end
