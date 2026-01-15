class Book < ApplicationRecord
  extend FriendlyId
  friendly_id :title, use: :slugged
  
  belongs_to :user, optional: true
  has_many :chapters, dependent: :destroy
  has_many :articles, through: :chapters
  
  validates :title, presence: true
  validates :status, inclusion: { in: %w[draft published] }
  validates :cover_scheme_index, numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than: 30 }, allow_nil: true
  
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
