class CreatePersonas < ActiveRecord::Migration[7.2]
  def change
    create_table :personas do |t|
      t.string :name
      t.text :description
      t.text :system_prompt
      t.boolean :active, default: true
      t.integer :position, default: 0


      t.timestamps
    end
  end
end
