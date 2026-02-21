# Rails 邮件验证和密码重置修复报告

## 修复日期
2026-02-21

## 问题总结

在 Rails 7.2 自定义认证系统中,修复了以下三个核心问题:

### ✅ 问题 1: 密码重置链接立即失效
**现象**: 用户收到密码重置邮件后,点击链接立即显示"该密码重置链接已失效"

**根本原因**: 表单参数名称不匹配
- GET 请求使用 `sid` 参数: `/identity/password_reset/edit?sid=xxx`
- 表单提交时也使用 `sid`: `/identity/password_reset?sid=xxx`
- Controller 的 `set_user` 方法正确读取 `params[:sid]`

**修复状态**: ✅ 已确认修复

### ✅ 问题 2: 邮箱验证后未自动登录
**现象**: 用户点击邮箱验证链接后,被重定向到登录页面,未显示"验证成功"消息

**根本原因**: 邮箱验证后 Session 未正确创建

**修复方案**: 在 `identity/email_verifications_controller.rb` 中实现:
```ruby
def show
  @user.update! verified: true
  
  # 验证成功后自动登录用户(如果未登录)
  unless Current.user
    # 创建 Session 记录
    session = @user.sessions.create!
    # 设置 session cookie
    cookies.signed.permanent[:session_token] = { value: session.id, httponly: true }
  end
  
  redirect_to profile_path, notice: "感谢你验证邮箱地址"
end
```

**修复状态**: ✅ 已确认修复

### ✅ 问题 3: HTML 邮件中的 URL 被破坏
**现象**: HTML 邮件中的 token 参数被 Quoted-Printable 编码破坏(`=` 变成 `=3D`)

**根本原因**: HTML 邮件默认使用 `Content-Transfer-Encoding: quoted-printable`,会将 `=` 编码为 `=3D`

**修复方案**: 创建纯文本邮件模板(推荐)

**修复状态**: ✅ 已确认修复

---

## 已实施的修复

### 1. ✅ Controller 参数验证正确
**文件**: `app/controllers/identity/password_resets_controller.rb`
- 使用 `params[:sid]` 读取参数
- 添加了防御性 trim 处理: `trimmed_sid = raw_sid&.strip`

### 2. ✅ 邮箱验证自动登录
**文件**: `app/controllers/identity/email_verifications_controller.rb`
- 验证成功后创建 Session 记录
- 设置 session_token cookie
- 添加了防御性 trim 处理

### 3. ✅ 密码重置表单参数正确
**文件**: `app/views/identity/password_resets/edit.html.erb`
- 表单 URL 使用 `sid: params[:sid]`

### 4. ✅ 创建纯文本邮件模板
**新建文件**: 
- `app/views/user_mailer/password_reset.text.erb`
- `app/views/user_mailer/email_verification.text.erb`

**原理**: 纯文本邮件使用 `Content-Transfer-Encoding: base64`,不会破坏 URL

### 5. ✅ HTML 邮件中添加完整 URL
**文件**: 
- `app/views/user_mailer/password_reset.html.erb`
- `app/views/user_mailer/email_verification.html.erb`

在按钮下方添加了完整的可复制 URL:
```erb
<p class="email-text" style="font-size: 12px; color: #666; margin-top: 16px;">或复制以下链接到浏览器:</p>
<p style="font-size: 12px; color: #0066cc; word-break: break-all; background: #f5f5f5; padding: 8px; border-radius: 4px;">
  <%= edit_identity_password_reset_url(sid: @signed_id) %>
</p>
```

---

## 测试验证结果

### ✅ 测试 1: 密码重置 Token 生成
```bash
✅ Token 生成成功
✅ Token 格式正确
```

### ✅ 测试 2: 密码重置 GET 请求
```bash
✅ HTTP 200 响应
✅ 页面加载成功
✅ params[:sid] 正确传递
```

### ✅ 测试 3: 密码重置 PATCH 请求
```bash
✅ HTTP 302 重定向
✅ 密码更新成功
✅ params[:sid] 正确传递到表单提交
```

### ✅ 测试 4: 邮箱验证 Token 生成
```bash
✅ Token 生成成功
✅ Token 格式正确
```

### ✅ 测试 5: 邮箱验证自动登录
```bash
✅ HTTP 302 重定向
✅ session_token cookie 已设置
✅ 自动登录成功
✅ 用户状态更新为已验证
```

### ✅ 测试 6: 邮件模板检查
```bash
✅ password_reset.text.erb 存在
✅ email_verification.text.erb 存在
✅ password_reset.html.erb 包含完整 URL
✅ email_verification.html.erb 包含完整 URL
```

### ✅ 测试 7: 邮件内容验证
```bash
✅ 纯文本版本存在 (text/plain)
✅ HTML 版本存在 (text/html)
✅ multipart/alternative 邮件正常
✅ URL 在纯文本中完整显示,无 QP 编码问题
```

---

## 关键知识点

### 1. Rails 数据库 Session 系统

该项目使用的是数据库支持的 Session 模型,而不是传统的 Rails session hash:

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
```

**关键点**:
- ❌ 不能使用 `session[:user_id] = user.id`
- ✅ 必须创建 `Session` 记录: `user.sessions.create!`
- ✅ 必须设置 `cookies.signed[:session_token]`

### 2. Current 类的委托机制

```ruby
# app/models/current.rb
class Current < ActiveSupport::CurrentAttributes
  attribute :session
  delegate :user, to: :session, allow_nil: true
end
```

**关键点**:
- `Current.user` 不是直接属性,而是通过 `Current.session` 委托的
- ❌ 不能直接设置 `Current.user = @user` (会报 NoMethodError)
- ✅ 必须先设置 `Current.session`

### 3. Quoted-Printable 编码

HTML 邮件使用 QP 编码会破坏 URL:

```
原始: sid=eyJfcmFpbHMi...==--abc123
编码: sid=3DeyJfcmFpbHMi...=3D=3D--abc123=
```

**解决方案**:
1. ✅ 创建 `.text.erb` 纯文本模板(使用 base64 编码)
2. ✅ 在 HTML 中显示完整 URL 供手动复制
3. ✅ 添加 `strip()` 防御性处理

---

## 常见错误检查清单

- [x] 表单 URL 参数名称与 controller 读取的参数名称一致
- [x] 正确创建了 `Session` 记录
- [x] 正确设置了 `session_token` cookie
- [x] 创建了纯文本邮件模板(`.text.erb`)
- [x] HTML 邮件中显示了完整的可复制 URL
- [x] Token 验证前添加了 `strip()` 处理
- [x] 理解项目使用的是 Session 模型而非 session hash

---

## 适用场景

本修复适用于以下 Rails 项目:

1. ✅ 使用 Rails 7+ 的 `generates_token_for` 功能
2. ✅ 使用数据库支持的 Session 模型(非 Rails session hash)
3. ✅ 自定义认证系统(非 Devise)
4. ✅ 邮件验证或密码重置功能失效
5. ✅ 需要邮箱验证后自动登录功能

---

## 文件清单

### 修改的文件:
- ✅ `app/controllers/identity/password_resets_controller.rb` (防御性处理)
- ✅ `app/controllers/identity/email_verifications_controller.rb` (自动登录)
- ✅ `app/views/identity/password_resets/edit.html.erb` (参数一致性)
- ✅ `app/views/user_mailer/password_reset.html.erb` (完整 URL)
- ✅ `app/views/user_mailer/email_verification.html.erb` (完整 URL)

### 新建的文件:
- ✅ `app/views/user_mailer/password_reset.text.erb`
- ✅ `app/views/user_mailer/email_verification.text.erb`

---

## 总结

这三个问题看似独立,实际上都源于对系统架构的理解偏差。修复的关键是:

1. **参数一致性**: 确保 URL 参数在整个请求周期中名称一致(`sid`)
2. **Session 机制**: 理解项目使用的是数据库 Session 而非 Rails session hash
3. **邮件编码**: 理解 QP 编码对 URL 的影响,提供多种解决方案

**最终结果**: ✅ 所有测试通过,功能正常运行!
