class Book < ApplicationRecord
  extend FriendlyId
  friendly_id :title, use: :slugged
  
  COVER_STYLES = {
    'minimal' => '简约',
    'gradient' => '渐变',
    'literary' => '文艺',
    'modern' => '现代',
    'academic' => '学术'
  }.freeze
  
  has_many :chapters, dependent: :destroy
  has_many :articles, through: :chapters
  
  validates :title, presence: true
  validates :status, inclusion: { in: %w[draft published] }
  validates :cover_style, inclusion: { in: %w[minimal gradient literary modern academic] }
  
  scope :pinned, -> { where(pinned: true) }
  scope :published, -> { where(status: 'published') }
  scope :ordered, -> { order(pinned: :desc, updated_at: :desc) }
  
  def root_chapters
    chapters.where(parent_id: nil).order(:position)
  end
  
  def articles_count
    articles.count
  end
  
  def total_word_count
    articles.sum(:word_count)
  end
end
