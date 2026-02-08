class WritingTip < ApplicationRecord
  validates :content, presence: true, length: { maximum: 500 }
  
  scope :active, -> { where(active: true) }
  scope :ordered, -> { order(position: :asc, id: :asc) }
  
  # Get a random tip from active tips
  def self.random_tip
    active.order("RANDOM()").first
  end
  
  # Get next tip in sequence
  def next_tip
    self.class.active.ordered.where("position > ? OR (position = ? AND id > ?)", position, position, id).first ||
    self.class.active.ordered.first
  end
  
  # Get previous tip in sequence
  def prev_tip
    self.class.active.ordered.where("position < ? OR (position = ? AND id < ?)", position, position, id).last ||
    self.class.active.ordered.last
  end
end
