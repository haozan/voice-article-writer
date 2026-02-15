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
end
