class CreateChapters < ActiveRecord::Migration[7.2]
  def change
    create_table :chapters do |t|
      t.references :book
      t.references :parent
      t.string :title
      t.integer :position, default: 0
      t.integer :level, default: 1


      t.timestamps
    end
  end
end
