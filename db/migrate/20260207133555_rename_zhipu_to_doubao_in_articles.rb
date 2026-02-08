class RenameZhipuToDoubaoInArticles < ActiveRecord::Migration[7.2]
  def up
    # Copy data from zhipu to doubao
    execute <<-SQL
      UPDATE articles 
      SET brainstorm_doubao = brainstorm_zhipu 
      WHERE brainstorm_zhipu IS NOT NULL AND brainstorm_doubao IS NULL
    SQL
    
    execute <<-SQL
      UPDATE articles 
      SET draft_doubao = draft_zhipu 
      WHERE draft_zhipu IS NOT NULL AND draft_doubao IS NULL
    SQL
    
    # Remove zhipu columns
    remove_column :articles, :brainstorm_zhipu
    remove_column :articles, :draft_zhipu
  end
  
  def down
    # Restore zhipu columns
    add_column :articles, :brainstorm_zhipu, :text
    add_column :articles, :draft_zhipu, :text
    
    # Copy data back
    execute <<-SQL
      UPDATE articles 
      SET brainstorm_zhipu = brainstorm_doubao 
      WHERE brainstorm_doubao IS NOT NULL
    SQL
    
    execute <<-SQL
      UPDATE articles 
      SET draft_zhipu = draft_doubao 
      WHERE draft_doubao IS NOT NULL
    SQL
  end
end
