class UserMailer < ApplicationMailer
  def password_reset
    @user = params[:user]
    @signed_id = @user.generate_token_for(:password_reset)

    mail to: @user.email, subject: "[#{Rails.application.config.x.appname}] 重置你的密码"
  end

  def email_verification
    @user = params[:user]
    @signed_id = @user.generate_token_for(:email_verification)

    mail to: @user.email, subject: "[#{Rails.application.config.x.appname}] 验证你的邮箱"
  end

  def invitation_instructions
    @user = params[:user]
    @signed_id = @user.generate_token_for(:password_reset)

    mail to: @user.email, subject: "[#{Rails.application.config.x.appname}] Invitation instructions"
  end

  # 发送 6 位数字验证码
  def email_verification_code
    @user = params[:user]
    @code = params[:code]

    # 开发环境无 SMTP 时，验证码打印到日志方便调试
    Rails.logger.info "[UserMailer] 验证码 → #{@user.email} : #{@code}"

    mail to: @user.email,
         subject: "[#{Rails.application.config.x.appname}] 您的注册验证码：#{@code}"
  end
end
