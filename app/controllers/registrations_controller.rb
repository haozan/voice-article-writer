class RegistrationsController < ApplicationController
  before_action :redirect_if_signed_in, only: [:new, :create, :verify, :confirm]
  before_action :check_session_cookie_availability, only: [:new]

  # 第一步：显示注册表单
  def new
    @user = User.new
  end

  # 第一步提交：创建用户（未验证），发验证码，跳转验证页
  def create
    @user = User.new(user_params)
    @user.verified = false

    if @user.save
      code = @user.generate_email_verification_code!
      UserMailer.with(user: @user, code: code).email_verification_code.deliver_later
      # 开发环境把验证码打印到日志，方便调试
      Rails.logger.info "[注册验证码] #{@user.email} → #{code}"
      session[:pending_user_id] = @user.id
      redirect_to verify_sign_up_path, notice: "验证码已发送到 #{@user.email}，请查收（15分钟内有效）"
    else
      flash.now[:alert] = handle_password_errors(@user) || @user.errors.full_messages.first
      render :new, status: :unprocessable_entity
    end
  end

  # 第二步：显示验证码输入页
  def verify
    @pending_user = User.find_by(id: session[:pending_user_id])
    redirect_to sign_up_path, alert: "请先完成注册" unless @pending_user
  end

  # 第二步提交：校验验证码，通过则自动登录
  def confirm
    @pending_user = User.find_by(id: session[:pending_user_id])

    unless @pending_user
      redirect_to sign_up_path, alert: "请先完成注册" and return
    end

    if @pending_user.verify_email_code!(params[:code])
      session.delete(:pending_user_id)
      session_record = @pending_user.sessions.create!
      cookies.signed.permanent[:session_token] = { value: session_record.id, httponly: true }
      redirect_to root_path, notice: "欢迎！注册成功，邮箱已验证 🎉"
    else
      flash.now[:alert] = "验证码错误或已过期，请重新输入"
      @pending_user_id = session[:pending_user_id]
      render :verify, status: :unprocessable_entity
    end
  end

  # 重新发送验证码
  def resend_code
    @pending_user = User.find_by(id: session[:pending_user_id])

    unless @pending_user
      redirect_to sign_up_path, alert: "请先完成注册" and return
    end

    code = @pending_user.generate_email_verification_code!
    UserMailer.with(user: @pending_user, code: code).email_verification_code.deliver_later
    Rails.logger.info "[重新发送验证码] #{@pending_user.email} → #{code}"
    redirect_to verify_sign_up_path, notice: "验证码已重新发送到 #{@pending_user.email}"
  end

  private

  def redirect_if_signed_in
    redirect_to root_path, notice: "您已经登录" if user_signed_in?
  end

  def user_params
    params.require(:user).permit(:name, :email, :password, :password_confirmation)
  end
end
