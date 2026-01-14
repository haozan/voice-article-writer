class Article < ApplicationRecord
  belongs_to :chapter, optional: true
  
  before_save :calculate_word_count
  
  scope :archived, -> { where(archived: true) }
  scope :unarchived, -> { where(archived: false) }
  scope :ordered_in_chapter, -> { order(:position) }
  
  def calculate_word_count
    # Count Chinese characters, English words, and numbers
    # Remove all whitespace and count remaining characters
    self.word_count = final_content.to_s.gsub(/\s+/, '').length
  end
  
  def status_label
    return '定稿' if final_content.present?
    return '初稿' if draft.present?
    return '脑爆' if has_brainstorm?
    '未开始'
  end
  
  # Return badge color class for status
  # 红色(danger) = 脑爆, 黄色(warning) = 初稿, 绿色(success) = 定稿
  def status_badge_class
    return 'badge-success' if final_content.present?  # 绿色 - 定稿
    return 'badge-warning' if draft.present?          # 黄色 - 初稿
    return 'badge-danger' if has_brainstorm?          # 红色 - 脑爆
    'badge-secondary'                                  # 灰色 - 未开始
  end
  
  def has_brainstorm?
    brainstorm_grok.present? || 
    brainstorm_qwen.present? || 
    brainstorm_deepseek.present? || 
    brainstorm_gemini.present? || 
    brainstorm_zhipu.present?
  end
  
  def can_archive?
    final_content.present? && !archived
  end
  
  def archive_to(chapter)
    return false unless can_archive?
    
    self.chapter = chapter
    self.archived = true
    self.archived_at = Time.current
    self.position = chapter.articles.count
    save
  end
  
  def archive_info
    return nil unless archived?
    return nil unless chapter&.book  # 确保章节和书籍都存在
    
    { 
      book_title: chapter.book.title, 
      chapter_title: chapter.full_title 
    }
  rescue => e
    # 如果查询失败（如外键约束问题），返回nil
    Rails.logger.error "Failed to get archive_info for Article ##{id}: #{e.message}"
    nil
  end
end
