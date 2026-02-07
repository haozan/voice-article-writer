class AddWritingStyleToArticles < ActiveRecord::Migration[7.2]
  def change
    add_column :articles, :writing_style, :string, default: "original"

  end
end
