class AddVariantFieldsToArticles < ActiveRecord::Migration[7.2]
  def change
    add_column :articles, :variant, :text
    add_column :articles, :variant_style, :string

  end
end
