class CreateWritingTips < ActiveRecord::Migration[7.2]
  def change
    create_table :writing_tips do |t|
      t.text :content, default: ""
      t.boolean :active, default: true
      t.integer :position, default: 0


      t.timestamps
    end
  end
end
