class PackagesController < ApplicationController
  before_action :authenticate_user!

  def index
    @packages = Package.ordered
  end

  def purchase
    @package = Package.find(params[:id])
    
    # 创建支付记录
    @payment = @package.build_payment(
      amount: @package.price_in_yuan,
      currency: 'cny',
      status: 'pending',
      user: current_user
    )

    if @payment.save
      # 重定向到 Stripe 支付页面
      redirect_to pay_payment_path(@payment), data: { turbo_method: :post }
    else
      redirect_to packages_path, alert: "创建订单失败，请重试"
    end
  end

  private
  # Write your private methods here
end
