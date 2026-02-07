class CreatePackages < ActiveRecord::Migration[7.2]
  def change
    create_table :packages do |t|
      t.string :name
      t.integer :price
      t.integer :articles_count
      t.text :description
      t.boolean :recommended, default: false
      t.integer :position, default: 0


      t.timestamps
    end
  end
end
