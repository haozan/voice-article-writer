class Identity::PasswordResetsController < ApplicationController
  before_action :set_user, only: %i[ edit update ]

  def new
    @user = User.new
  end

  def edit
  end

  def create
    @user = User.find_by(email: params[:user][:email])
    
    if @user.nil?
      redirect_to new_identity_password_reset_path, alert: "此邮箱没有注册账户"
    elsif !@user.verified?
      # 未验证的用户，发送验证邮件而不是密码重置邮件
      send_verification_email
      redirect_to new_identity_password_reset_path, notice: "你的邮箱还未验证。我们已向你发送验证邮件，请先验证邮箱后再重置密码。"
    else
      send_password_reset_email
      redirect_to sign_in_path, notice: "请检查你的邮箱，我们已发送重置密码指引"
    end
  end

  def update
    if @user.update(user_params)
      redirect_to sign_in_path, notice: "你的密码已成功重置，请登录"
    else
      flash.now[:alert] = handle_password_errors(@user)
      render :edit, status: :unprocessable_entity
    end
  end

  private

  def set_user
    Rails.logger.info "=== Password Reset Token Debug ==="
    
    # 防御性处理：移除可能由邮件客户端添加的空白字符
    raw_sid = params[:sid]
    trimmed_sid = raw_sid&.strip
    
    Rails.logger.info "Raw sid: #{raw_sid.inspect}"
    Rails.logger.info "Raw sid length: #{raw_sid&.length}"
    Rails.logger.info "Trimmed sid: #{trimmed_sid.inspect}"
    Rails.logger.info "Trimmed sid length: #{trimmed_sid&.length}"
    Rails.logger.info "Has whitespace difference: #{raw_sid != trimmed_sid}"
    
    @user = User.find_by_token_for!(:password_reset, trimmed_sid)
    Rails.logger.info "✅ Token validated successfully for user: #{@user.email}"
  rescue StandardError => e
    Rails.logger.error "❌ Token validation failed!"
    Rails.logger.error "Error class: #{e.class}"
    Rails.logger.error "Error message: #{e.message}"
    Rails.logger.error "Backtrace: #{e.backtrace.first(5).join("\n")}"
    redirect_to new_identity_password_reset_path, alert: "该密码重置链接已失效"
  end

  def user_params
    params.require(:user).permit(:password, :password_confirmation)
  end

  def send_password_reset_email
    UserMailer.with(user: @user).password_reset.deliver_later
  end

  def send_verification_email
    UserMailer.with(user: @user).email_verification.deliver_later
  end
end
