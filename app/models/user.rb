class User < ApplicationRecord
  MIN_PASSWORD = 4
  GENERATED_EMAIL_SUFFIX = "@generated-mail.clacky.ai"

  has_secure_password validations: false

  generates_token_for :email_verification, expires_in: 2.days do
    email
  end
  generates_token_for :password_reset, expires_in: 20.minutes

  has_many :sessions, dependent: :destroy
  has_many :payments, dependent: :destroy
  has_many :articles, dependent: :nullify
  has_many :books, dependent: :nullify

  validates :email, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }

  validates :password, allow_nil: true, length: { minimum: MIN_PASSWORD }, if: :password_required?
  validates :password, confirmation: true, if: :password_required?

  normalizes :email, with: -> { _1.strip.downcase }

  before_validation if: :email_changed?, on: :update do
    self.verified = false
  end

  after_update if: :password_digest_previously_changed? do
    sessions.where.not(id: Current.session).delete_all
  end

  # OAuth methods
  def self.from_omniauth(auth)
    name = auth.info.name.presence || "#{SecureRandom.hex(10)}_user"
    email = auth.info.email.presence || User.generate_email(name)

    user = find_by(email: email)
    if user
      user.update(provider: auth.provider, uid: auth.uid)
      return user
    end

    user = find_by(provider: auth.provider, uid: auth.uid)
    return user if user

    verified = !email.end_with?(GENERATED_EMAIL_SUFFIX)
    create(
      name: name,
      email: email,
      provider: auth.provider,
      uid: auth.uid,
      verified: verified,
    )
  end

  def self.generate_email(name)
    if name.present?
      name.downcase.gsub(' ', '_') + GENERATED_EMAIL_SUFFIX
    else
      SecureRandom.hex(10) + GENERATED_EMAIL_SUFFIX
    end
  end

  def oauth_user?
    provider.present? && uid.present?
  end

  def email_was_generated?
    email.end_with?(GENERATED_EMAIL_SUFFIX)
  end

  def password_required?
    return false if oauth_user?
    password_digest.blank? || password.present?
  end

  # ========== 邮箱验证码 ==========

  # 生成 6 位数字验证码，有效期 15 分钟
  def generate_email_verification_code!
    code = rand(100000..999999).to_s
    update_columns(
      email_verification_code: code,
      email_verification_code_expires_at: 15.minutes.from_now
    )
    code
  end

  # 校验验证码：正确且未过期返回 true，同时清空验证码
  def verify_email_code!(code)
    return false if email_verification_code.blank?
    return false if email_verification_code_expires_at.blank? ||
                    email_verification_code_expires_at < Time.current
    return false if email_verification_code != code.to_s.strip

    update_columns(
      verified: true,
      email_verification_code: nil,
      email_verification_code_expires_at: nil
    )
    true
  end

end
