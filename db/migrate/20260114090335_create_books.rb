class CreateBooks < ActiveRecord::Migration[7.2]
  def change
    create_table :books do |t|
      t.string :title
      t.string :subtitle
      t.text :description
      t.string :author
      t.string :status, default: "draft"
      t.datetime :published_at
      t.boolean :pinned, default: false
      t.string :cover_style, default: "gradient"
      t.string :slug


      t.timestamps
    end
  end
end
