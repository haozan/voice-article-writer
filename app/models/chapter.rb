class Chapter < ApplicationRecord
  belongs_to :book
  belongs_to :parent, class_name: 'Chapter', optional: true
  
  has_many :sub_chapters, class_name: 'Chapter', foreign_key: 'parent_id', dependent: :destroy
  has_many :articles, dependent: :nullify
  
  validates :title, presence: true
  validates :level, numericality: { only_integer: true, greater_than: 0 }
  
  scope :root_level, -> { where(parent_id: nil) }
  scope :ordered, -> { order(:position) }
  
  before_validation :set_level
  
  def full_title
    ancestors = []
    current = self
    while current.parent
      ancestors.unshift(current.parent.title)
      current = current.parent
    end
    ancestors << title
    ancestors.join(' > ')
  end
  
  private
  
  def set_level
    self.level = parent ? parent.level + 1 : 1
  end
end
