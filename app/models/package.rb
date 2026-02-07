class Package < ApplicationRecord
  has_one :payment, as: :payable, dependent: :destroy

  validates :name, presence: true
  validates :price, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :articles_count, presence: true, numericality: { greater_than: 0 }
  validates :position, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

  scope :ordered, -> { order(position: :asc, id: :asc) }
  scope :active, -> { where(recommended: [true, false]) } # 所有套餐都是可用的

  def price_in_yuan
    price / 100.0
  end

  def unit_price
    (price / 100.0 / articles_count).round(2)
  end

  # Stripe Payment Interface - REQUIRED methods
  def customer_name
    "Guest" # Package不关联用户，支付时由Payment关联user
  end

  def customer_email
    "customer@example.com" # 占位，实际由用户提供
  end

  def payment_description
    "#{name} - #{articles_count}篇文章"
  end

  def stripe_mode
    'payment' # 一次性支付
  end

  def stripe_line_items
    [{
      price_data: {
        currency: 'cny', # 人民币
        product_data: { 
          name: name,
          description: description
        },
        unit_amount: price # 价格已经是分为单位
      },
      quantity: 1
    }]
  end
end
