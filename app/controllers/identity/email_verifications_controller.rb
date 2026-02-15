class Identity::EmailVerificationsController < ApplicationController
  before_action :authenticate_user!, only: :create

  before_action :set_user, only: :show

  def show
    @user.update! verified: true
    
    # 验证成功后自动登录用户（如果未登录）
    unless Current.user
      # 创建 Session 记录
      session = @user.sessions.create!
      # 设置 session cookie
      cookies.signed.permanent[:session_token] = { value: session.id, httponly: true }
      Rails.logger.info "✅ Email verified and user auto-logged in: #{@user.email}"
    end
    
    redirect_to profile_path, notice: "感谢你验证邮箱地址"
  end

  def create
    if current_user.email_was_generated?
      redirect_to profile_path, alert: "你的邮箱是系统生成的，无法验证。请更新为有效的邮箱地址。"; return
    end
    send_email_verification
    redirect_to profile_path, notice: "我们已向你的邮箱发送验证邮件"
  end

  private

  def set_user
    Rails.logger.info "=== Email Verification Token Debug ==="
    
    # 防御性处理：移除可能由邮件客户端添加的空白字符
    raw_sid = params[:sid]
    trimmed_sid = raw_sid&.strip
    
    Rails.logger.info "Raw sid: #{raw_sid.inspect}"
    Rails.logger.info "Trimmed sid: #{trimmed_sid.inspect}"
    Rails.logger.info "Has whitespace difference: #{raw_sid != trimmed_sid}"
    
    @user = User.find_by_token_for!(:email_verification, trimmed_sid)
    Rails.logger.info "✅ Token validated successfully for user: #{@user.email}"
  rescue StandardError => e
    Rails.logger.error "❌ Email verification token validation failed!"
    Rails.logger.error "Error class: #{e.class}"
    Rails.logger.error "Error message: #{e.message}"
    redirect_to edit_identity_email_path, alert: "该邮箱验证链接无效"
  end

  def send_email_verification
    UserMailer.with(user: Current.user).email_verification.deliver_later
  end
end
