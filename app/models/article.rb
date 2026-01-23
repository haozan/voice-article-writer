class Article < ApplicationRecord
  belongs_to :user, optional: true
  belongs_to :chapter, optional: true
  
  before_save :calculate_word_count
  
  # Initialize brainstorm_status if it's nil
  after_initialize :initialize_brainstorm_status
  
  scope :archived, -> { where(archived: true) }
  scope :unarchived, -> { where(archived: false) }
  scope :ordered_in_chapter, -> { order(:position) }
  
  # Providers for brainstorm
  BRAINSTORM_PROVIDERS = %w[grok qwen deepseek gemini zhipu doubao].freeze
  
  def initialize_brainstorm_status
    self.brainstorm_status ||= {}
  end
  
  # Set brainstorm status for a provider
  # status: 'pending', 'success', 'error'
  # message: error message (optional)
  def set_brainstorm_status(provider, status, message = nil)
    self.brainstorm_status ||= {}
    self.brainstorm_status[provider.to_s] = {
      'status' => status.to_s,
      'message' => message,
      'updated_at' => Time.current.iso8601
    }
    save!
  end
  
  # Get brainstorm status for a provider
  def get_brainstorm_status(provider)
    (brainstorm_status || {})[provider.to_s] || {}
  end
  
  # Check if a provider has error
  def brainstorm_error?(provider)
    get_brainstorm_status(provider)['status'] == 'error'
  end
  
  # Check if a provider is pending
  def brainstorm_pending?(provider)
    status = get_brainstorm_status(provider)['status']
    status.nil? || status == 'pending'
  end
  
  # Check if a provider is success
  def brainstorm_success?(provider)
    get_brainstorm_status(provider)['status'] == 'success'
  end
  
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
    brainstorm_zhipu.present? ||
    brainstorm_doubao.present?
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
