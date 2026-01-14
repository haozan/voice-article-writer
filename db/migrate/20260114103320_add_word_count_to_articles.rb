class AddWordCountToArticles < ActiveRecord::Migration[7.2]
  def change
    add_column :articles, :word_count, :integer, default: 0
    
    # Update existing articles with word count
    reversible do |dir|
      dir.up do
        Article.find_each do |article|
          word_count = article.final_content.to_s.gsub(/\s+/, '').length
          article.update_column(:word_count, word_count)
        end
      end
    end
  end
end
