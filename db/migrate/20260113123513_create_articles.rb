class CreateArticles < ActiveRecord::Migration[7.2]
  def change
    create_table :articles do |t|
      t.text :transcript
      t.text :brainstorm_grok
      t.text :brainstorm_qwen
      t.text :brainstorm_deepseek
      t.text :brainstorm_gemini
      t.text :brainstorm_zhipu
      t.string :selected_model
      t.text :draft
      t.string :final_style
      t.text :final_content


      t.timestamps
    end
  end
end
