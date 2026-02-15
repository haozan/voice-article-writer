# Rails 邮件验证和密码重置问题修复指南

## 问题总结

在 Rails 7.2 自定义认证系统中，遇到了以下三个核心问题：

### 问题 1：密码重置链接立即失效
**现象**：用户收到密码重置邮件后，点击链接立即显示"该密码重置链接已失效"

### 问题 2：邮箱验证后未自动登录
**现象**：用户点击邮箱验证链接后，被重定向到登录页面，未显示"验证成功"消息

### 问题 3：HTML 邮件中的 URL 被破坏
**现象**：HTML 邮件中的 token 参数被 Quoted-Printable 编码破坏（`=` 变成 `=3D`）

---

## 根本原因分析

### 原因 1：表单参数名称不匹配（最关键）

**问题代码**：
```erb
<!-- app/views/identity/password_resets/edit.html.erb -->
<%= form_with model: @user, url: identity_password_reset_path(token: params[:token]), method: :patch do |form| %>
```

**问题分析**：
- GET 请求使用的参数是 `sid`：`/identity/password_reset/edit?sid=xxx`
- 但表单提交时使用的是 `token`：`/identity/password_reset?token=xxx`
- Controller 的 `set_user` 方法读取 `params[:sid]`
- 结果：PATCH 请求时 `params[:sid]` 为 `nil`，验证失败

**修复方案**：
```erb
<!-- 修复后 -->
<%= form_with model: @user, url: identity_password_reset_path(sid: params[:sid]), method: :patch do |form| %>
```

### 原因 2：邮箱验证后 Session 未正确创建

**问题代码**：
```ruby
# app/controllers/identity/email_verifications_controller.rb
def show
  @user.update! verified: true
  # 错误：尝试设置 session[:user_id]
  session[:user_id] = @user.id
  redirect_to profile_path, notice: "感谢你验证邮箱地址"
end
```

**问题分析**：
- 该项目使用数据库支持的 `Session` 模型，不是 Rails 的 session hash
- 认证系统通过 `cookies.signed[:session_token]` 查找 `Session` 记录
- 仅设置 `session[:user_id]` 不会创建 `Session` 记录
- 下次请求时用户仍未登录

**修复方案**：
```ruby
def show
  @user.update! verified: true
  
  # 验证成功后自动登录用户（如果未登录）
  unless Current.user
    # 创建 Session 记录（关键）
    session = @user.sessions.create!
    # 设置 session cookie（关键）
    cookies.signed.permanent[:session_token] = { value: session.id, httponly: true }
  end
  
  redirect_to profile_path, notice: "感谢你验证邮箱地址"
end
```

**参考实现**（SessionsController）：
```ruby
# app/controllers/sessions_controller.rb
def create
  if user = User.authenticate_by(email: params[:user][:email], password: params[:user][:password])
    @session = user.sessions.create!  # 创建 Session 记录
    cookies.signed.permanent[:session_token] = { value: @session.id, httponly: true }  # 设置 cookie
    redirect_to root_path, notice: "登录成功"
  end
end
```

### 原因 3：Quoted-Printable 编码破坏 URL

**问题分析**：
- HTML 邮件默认使用 `Content-Transfer-Encoding: quoted-printable`
- QP 编码会将 `=` 编码为 `=3D`
- 长行会被拆分，添加 `=` 续行符
- Token 如 `sid=eyJfcmFpbHMi...==--abc` 变成 `sid=3DeyJfcmFpbHMi...=3D=3D--abc=`

**修复方案 1**：创建纯文本邮件版本（推荐）

```erb
<!-- app/views/user_mailer/password_reset.text.erb -->
你好，

忘记 <%= @user.email %> 的密码了吗？没关系，这种情况很常见。只需点击下方链接设置新密码即可。

重置我的密码：
<%= edit_identity_password_reset_url(sid: @signed_id) %>

如果你没有请求重置密码，可以安全地忽略此邮件，该链接将在20分钟后过期。
```

**原理**：纯文本邮件使用 `Content-Transfer-Encoding: base64`，不会破坏 URL

**修复方案 2**：在 HTML 邮件中显示完整 URL

```erb
<!-- app/views/user_mailer/password_reset.html.erb -->
<div class="email-button-container">
  <%= link_to "重置我的密码", edit_identity_password_reset_url(sid: @signed_id), class: "email-button" %>
</div>

<p class="email-text" style="font-size: 12px; color: #666; margin-top: 16px;">或复制以下链接到浏览器：</p>
<p style="font-size: 12px; color: #0066cc; word-break: break-all; background: #f5f5f5; padding: 8px; border-radius: 4px;">
  <%= edit_identity_password_reset_url(sid: @signed_id) %>
</p>
```

**修复方案 3**：添加防御性 trim 处理

```ruby
# app/controllers/identity/password_resets_controller.rb
def set_user
  # 防御性处理：移除可能由邮件客户端添加的空白字符
  raw_sid = params[:sid]
  trimmed_sid = raw_sid&.strip
  
  @user = User.find_by_token_for!(:password_reset, trimmed_sid)
rescue StandardError => e
  redirect_to new_identity_password_reset_path, alert: "该密码重置链接已失效"
end
```

---

## 完整修复清单

### 1. 修复密码重置表单参数

**文件**：`app/views/identity/password_resets/edit.html.erb`

```erb
<!-- 将 token 改为 sid -->
<%= form_with model: @user, url: identity_password_reset_path(sid: params[:sid]), method: :patch do |form| %>
  <!-- 表单内容 -->
<% end %>
```

### 2. 修复邮箱验证自动登录

**文件**：`app/controllers/identity/email_verifications_controller.rb`

```ruby
def show
  @user.update! verified: true
  
  # 验证成功后自动登录用户（如果未登录）
  unless Current.user
    # 创建 Session 记录
    session = @user.sessions.create!
    # 设置 session cookie
    cookies.signed.permanent[:session_token] = { value: session.id, httponly: true }
  end
  
  redirect_to profile_path, notice: "感谢你验证邮箱地址"
end
```

### 3. 创建纯文本邮件模板

**文件**：`app/views/user_mailer/password_reset.text.erb`（新建）

```erb
你好，

忘记 <%= @user.email %> 的密码了吗？没关系，这种情况很常见。只需点击下方链接设置新密码即可。

重置我的密码：
<%= edit_identity_password_reset_url(sid: @signed_id) %>

如果你没有请求重置密码，可以安全地忽略此邮件，该链接将在20分钟后过期。只有能访问此邮箱的人才能重置你的密码。

---
<%= Rails.application.config.x.appname %>
```

**文件**：`app/views/user_mailer/email_verification.text.erb`（新建）

```erb
你好，

请确认 <%= @user.email %> 是你要在账户中使用的邮箱地址。如果你忘记密码，我们将向该邮箱发送重置链接。

确认，使用此邮箱：
<%= identity_email_verification_url(sid: @signed_id) %>

---
<%= Rails.application.config.x.appname %>
```

### 4. 在 HTML 邮件中添加可复制的完整 URL

**文件**：`app/views/user_mailer/password_reset.html.erb`

在按钮下方添加：

```erb
<p class="email-text" style="font-size: 12px; color: #666; margin-top: 16px;">或复制以下链接到浏览器：</p>
<p style="font-size: 12px; color: #0066cc; word-break: break-all; background: #f5f5f5; padding: 8px; border-radius: 4px;">
  <%= edit_identity_password_reset_url(sid: @signed_id) %>
</p>
```

### 5. 添加 Token 防御性处理

**文件**：`app/controllers/identity/password_resets_controller.rb`

```ruby
def set_user
  # 防御性处理：移除可能由邮件客户端添加的空白字符
  raw_sid = params[:sid]
  trimmed_sid = raw_sid&.strip
  
  @user = User.find_by_token_for!(:password_reset, trimmed_sid)
rescue StandardError => e
  redirect_to new_identity_password_reset_path, alert: "该密码重置链接已失效"
end
```

**文件**：`app/controllers/identity/email_verifications_controller.rb`

```ruby
def set_user
  # 防御性处理：移除可能由邮件客户端添加的空白字符
  raw_sid = params[:sid]
  trimmed_sid = raw_sid&.strip
  
  @user = User.find_by_token_for!(:email_verification, trimmed_sid)
rescue StandardError => e
  redirect_to edit_identity_email_path, alert: "该邮箱验证链接无效"
end
```

---

## 测试验证

### 测试密码重置流程

```bash
# 1. 生成测试 URL
rails runner '
user = User.first
token = user.generate_token_for(:password_reset)
puts "Test URL: http://localhost:3000/identity/password_reset/edit?sid=#{token}"
'

# 2. 测试 GET 请求（查看表单）
curl -i "http://localhost:3000/identity/password_reset/edit?sid=YOUR_TOKEN"

# 3. 测试 PATCH 请求（提交表单）
curl -i -X PATCH \
  -d "user[password]=newpassword123" \
  -d "user[password_confirmation]=newpassword123" \
  "http://localhost:3000/identity/password_reset?sid=YOUR_TOKEN"
```

### 测试邮箱验证流程

```bash
# 1. 取消用户验证状态
rails runner '
user = User.find_by(email: "test@example.com")
user.update(verified: false)
puts "User verification status: #{user.verified}"
'

# 2. 生成验证链接
rails runner '
user = User.find_by(email: "test@example.com")
token = user.generate_token_for(:email_verification)
puts "Verification URL: http://localhost:3000/identity/email_verification?sid=#{token}"
'

# 3. 测试验证请求（检查是否设置 session_token cookie）
curl -i -c /tmp/cookies.txt -b /tmp/cookies.txt -L "YOUR_VERIFICATION_URL" | grep -E "(HTTP|Location|session_token)"
```

**预期结果**：
```
HTTP/1.1 302 Found
set-cookie: session_token=...; path=/; expires=...; httponly; samesite=lax
HTTP/1.1 200 OK
```

---

## 关键知识点

### 1. Rails 数据库 Session 系统

该项目使用的是数据库支持的 Session 模型，而不是传统的 Rails session hash：

```ruby
# app/models/session.rb
class Session < ApplicationRecord
  belongs_to :user
end

# app/controllers/application_controller.rb
def find_session_record
  if cookies.signed[:session_token].present?
    return Session.find_by_id(cookies.signed[:session_token])
  end
  nil
end

def authenticate_user!
  if session_record = find_session_record
    Current.session = session_record
  else
    redirect_to sign_in_path, alert: '请先登录后继续'
  end
end
```

**关键点**：
- 不能使用 `session[:user_id] = user.id`
- 必须创建 `Session` 记录
- 必须设置 `cookies.signed[:session_token]`

### 2. Current 类的委托机制

```ruby
# app/models/current.rb
class Current < ActiveSupport::CurrentAttributes
  attribute :session
  delegate :user, to: :session, allow_nil: true
end
```

**关键点**：
- `Current.user` 不是直接属性，而是通过 `Current.session` 委托的
- 不能直接设置 `Current.user = @user`（会报 NoMethodError）
- 必须先设置 `Current.session`

### 3. Quoted-Printable 编码

HTML 邮件使用 QP 编码会破坏 URL：

```
原始: sid=eyJfcmFpbHMi...==--abc123
编码: sid=3DeyJfcmFpbHMi...=3D=3D--abc123=
```

**解决方案**：
- 创建 `.text.erb` 纯文本模板（使用 base64 编码）
- 在 HTML 中显示完整 URL 供手动复制
- 添加 `strip()` 防御性处理

---

## 适用场景

本指南适用于以下 Rails 项目：

1. ✅ 使用 Rails 7+ 的 `generates_token_for` 功能
2. ✅ 使用数据库支持的 Session 模型（非 Rails session hash）
3. ✅ 自定义认证系统（非 Devise）
4. ✅ 邮件验证或密码重置功能失效
5. ✅ 需要邮箱验证后自动登录功能

---

## 常见错误检查清单

- [ ] 表单 URL 参数名称与 controller 读取的参数名称是否一致？
- [ ] 是否正确创建了 `Session` 记录？
- [ ] 是否正确设置了 `session_token` cookie？
- [ ] 是否创建了纯文本邮件模板（`.text.erb`）？
- [ ] HTML 邮件中是否显示了完整的可复制 URL？
- [ ] Token 验证前是否添加了 `strip()` 处理？
- [ ] 认证系统使用的是 Session 模型还是 session hash？

---

## 附录：完整文件对比

### password_resets_controller.rb 关键部分

```ruby
class Identity::PasswordResetsController < ApplicationController
  before_action :set_user, only: %i[ edit update ]

  def update
    if @user.update(user_params)
      redirect_to sign_in_path, notice: "你的密码已成功重置，请登录"
    else
      render :edit, status: :unprocessable_entity
    end
  end

  private

  def set_user
    # 防御性处理：移除空白字符
    raw_sid = params[:sid]
    trimmed_sid = raw_sid&.strip
    
    @user = User.find_by_token_for!(:password_reset, trimmed_sid)
  rescue StandardError => e
    redirect_to new_identity_password_reset_path, alert: "该密码重置链接已失效"
  end

  def user_params
    params.require(:user).permit(:password, :password_confirmation)
  end
end
```

### email_verifications_controller.rb 关键部分

```ruby
class Identity::EmailVerificationsController < ApplicationController
  before_action :set_user, only: :show

  def show
    @user.update! verified: true
    
    # 验证成功后自动登录用户（如果未登录）
    unless Current.user
      # 创建 Session 记录
      session = @user.sessions.create!
      # 设置 session cookie
      cookies.signed.permanent[:session_token] = { value: session.id, httponly: true }
    end
    
    redirect_to profile_path, notice: "感谢你验证邮箱地址"
  end

  private

  def set_user
    # 防御性处理：移除空白字符
    raw_sid = params[:sid]
    trimmed_sid = raw_sid&.strip
    
    @user = User.find_by_token_for!(:email_verification, trimmed_sid)
  rescue StandardError => e
    redirect_to edit_identity_email_path, alert: "该邮箱验证链接无效"
  end
end
```

### password_resets/edit.html.erb 关键部分

```erb
<%= form_with model: @user, 
              url: identity_password_reset_path(sid: params[:sid]),  <!-- 关键：使用 sid -->
              method: :patch do |form| %>
  <%= form.password_field :password, required: true %>
  <%= form.password_field :password_confirmation, required: true %>
  <%= form.submit "保存更改" %>
<% end %>
```

---

**总结**：这三个问题看似独立，实际上都源于对系统架构的理解偏差。修复的关键是：

1. **参数一致性**：确保 URL 参数在整个请求周期中名称一致
2. **Session 机制**：理解项目使用的是数据库 Session 而非 Rails session hash
3. **邮件编码**：理解 QP 编码对 URL 的影响，提供多种解决方案

这份指南可以直接应用到其他使用类似架构的 Rails 项目中。
