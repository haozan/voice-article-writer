# Stripe Webhook 配置指南

## 问题说明

如果 Stripe 提示 webhook 端点失败,可能是以下原因:

1. ❌ 生产环境的 webhook URL 配置错误
2. ❌ Webhook signing secret 未正确配置
3. ❌ 端点无法访问(网络/防火墙问题)

## 解决方案

### 1. 确认 Webhook 端点配置

✅ **本地测试验证**:
```bash
# 测试端点是否响应
curl -X POST http://localhost:3000/webhooks/stripe \
  -H 'Content-Type: application/json' \
  -d '{"test": true}'

# 预期结果: HTTP 400 (没有有效签名是正常的)
# 如果返回 404,说明路由有问题
```

✅ **代码验证**:
- 路由: `POST /webhooks/stripe` → `payments#webhook` ✅
- CSRF 保护: 已禁用 `skip_before_action :verify_authenticity_token` ✅
- Webhook Secret: 已配置 ✅

### 2. 生产环境配置

#### Step 1: 确认生产域名

您的应用生产环境域名: **https://haozan.ai**

Webhook 端点 URL: **https://haozan.ai/webhooks/stripe**

#### Step 2: 在 Stripe Dashboard 配置 Webhook

1. **登录 Stripe Dashboard**
   - 测试模式: https://dashboard.stripe.com/test/webhooks
   - 生产模式: https://dashboard.stripe.com/webhooks

2. **添加 Endpoint**
   - 点击 "Add endpoint" 或 "Add an endpoint"
   - Endpoint URL: `https://haozan.ai/webhooks/stripe`
   - Description: "最小阻力写作 - 支付通知"

3. **选择监听的事件** (Select events to listen to)
   
   必选事件:
   - ✅ `checkout.session.completed` - 支付成功
   - ✅ `checkout.session.expired` - 支付链接过期
   - ✅ `payment_intent.succeeded` - 支付意图成功
   - ✅ `payment_intent.payment_failed` - 支付失败
   - ✅ `payment_intent.canceled` - 支付取消

   如果使用订阅模式,还需要:
   - ✅ `invoice.payment_succeeded` - 订阅账单支付成功
   - ✅ `customer.subscription.created` - 订阅创建
   - ✅ `customer.subscription.updated` - 订阅更新
   - ✅ `customer.subscription.deleted` - 订阅取消

4. **保存并获取 Signing Secret**
   - 点击 "Add endpoint" 保存
   - 进入新创建的 endpoint 详情页
   - 找到 "Signing secret" 部分
   - 点击 "Reveal" 显示密钥
   - 复制密钥(格式: `whsec_xxxxxxxxxxxxx`)

#### Step 3: 配置环境变量

在生产环境设置以下环境变量:

```bash
# Stripe Publishable Key (前端使用,可以公开)
CLACKY_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx

# Stripe Secret Key (后端使用,必须保密)
CLACKY_STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxxx

# Webhook Signing Secret (验证 webhook 真实性,必须保密)
CLACKY_STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# 应用公开域名(用于生成 webhook 回调 URL)
CLACKY_PUBLIC_HOST=haozan.ai
```

**重要**:
- 测试环境使用 `pk_test_xxx` 和 `sk_test_xxx`
- 生产环境使用 `pk_live_xxx` 和 `sk_live_xxx`
- 测试和生产的 webhook secret 是不同的

#### Step 4: 验证配置

在生产环境运行:

```bash
# 检查配置是否正确加载
rails runner '
puts "Stripe Configuration:"
puts "Publishable Key: #{Rails.application.config.stripe[:publishable_key].present? ? "✅" : "❌"}"
puts "Secret Key: #{Rails.application.config.stripe[:secret_key].present? ? "✅" : "❌"}"
puts "Webhook Secret: #{Rails.application.config.stripe[:webhook_secret].present? ? "✅" : "❌"}"
'
```

### 3. 测试 Webhook

#### 方法 1: Stripe Dashboard 测试

1. 进入 webhook endpoint 详情页
2. 点击 "Send test webhook" 标签
3. 选择事件类型(如 `checkout.session.completed`)
4. 点击 "Send test webhook"
5. 查看响应状态(应该是 200)

#### 方法 2: 实际支付测试

使用 Stripe 测试卡进行完整支付流程测试:

```
卡号: 4242 4242 4242 4242
过期日期: 任何未来日期(如 12/34)
CVC: 任何3位数字(如 123)
邮编: 任何5位数字(如 12345)
```

**测试流程**:
1. 创建一个支付订单
2. 完成 Stripe 支付
3. 检查日志确认 webhook 被调用
4. 验证订单状态更新为 "paid"
5. 验证用户积分/商品已添加

### 4. 常见问题排查

#### 问题 1: Webhook 返回 403 Forbidden

**原因**: CSRF token 验证失败

**解决方案**: 确认 `skip_before_action :verify_authenticity_token` 已添加
```ruby
# app/controllers/payments_controller.rb
class PaymentsController < ApplicationController
  skip_before_action :verify_authenticity_token, only: [:webhook], raise: false
end
```

#### 问题 2: Webhook 返回 400 Bad Request

**原因**: Signing secret 验证失败

**解决方案**:
1. 确认 `CLACKY_STRIPE_WEBHOOK_SECRET` 环境变量正确设置
2. 确认使用的是对应环境的 secret(测试/生产)
3. 检查 secret 没有多余空格或换行符

```bash
# 验证 secret 格式
echo $CLACKY_STRIPE_WEBHOOK_SECRET | cat -A
# 应该只显示: whsec_xxxxxxxxxxxxx$
# 如果有 ^M 或其他字符,说明有问题
```

#### 问题 3: Webhook 返回 404 Not Found

**原因**: 路由配置错误或 URL 拼写错误

**解决方案**:
1. 确认路由存在: `rails routes | grep webhooks/stripe`
2. 确认 Stripe dashboard 中的 URL 拼写正确
3. 确认没有多余的斜杠: ✅ `/webhooks/stripe` ❌ `/webhooks/stripe/`

#### 问题 4: Webhook 被调用但业务逻辑未执行

**原因**: `StripePaymentService.process_payment_paid` 未正确实现

**解决方案**: 检查日志,确认业务逻辑正确实现

```ruby
# app/services/stripe_payment_service.rb
def self.process_payment_paid(payment)
  case payment.payable_type
  when 'Package'
    # 确保这里的逻辑正确执行
    package = payment.payable
    user = payment.user
    
    user.increment!(:article_credits, package.article_quantity)
    Rails.logger.info "✅ Added #{package.article_quantity} credits to user #{user.id}"
  end
end
```

### 5. 开发环境 Webhook 测试

开发环境无法直接接收 Stripe webhook(localhost 无法被 Stripe 访问)。

#### 方法 1: 使用 ngrok (推荐)

```bash
# 1. 安装 ngrok
brew install ngrok  # macOS
# 或从 https://ngrok.com/download 下载

# 2. 启动 Rails 服务器
bin/dev

# 3. 在另一个终端启动 ngrok
ngrok http 3000

# 4. 复制 ngrok 提供的 HTTPS URL
# 例如: https://abc123.ngrok.io

# 5. 在 Stripe Dashboard 添加 webhook endpoint
# URL: https://abc123.ngrok.io/webhooks/stripe

# 6. 进行支付测试,ngrok 会转发 webhook 到本地
```

#### 方法 2: 使用 Stripe CLI (推荐)

```bash
# 1. 安装 Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS

# 2. 登录 Stripe
stripe login

# 3. 转发 webhook 到本地
stripe listen --forward-to localhost:3000/webhooks/stripe

# 4. CLI 会显示 webhook signing secret
# 复制它并设置为环境变量:
export CLACKY_STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx

# 5. 进行支付测试,Stripe CLI 会自动转发 webhook
```

#### 方法 3: 手动同步(不推荐)

开发环境已实现自动同步功能:

```ruby
# app/controllers/payments_controller.rb
def success
  # 在开发环境自动同步支付状态
  if @payment.processing?
    StripePaymentService.sync_payment_status(@payment)
  end
end
```

用户完成支付后会自动从 Stripe 同步状态,但这不适用于生产环境。

### 6. 监控和日志

#### 查看 Webhook 日志

**Stripe Dashboard**:
1. 进入 webhook endpoint 详情页
2. 查看 "Recent deliveries" 部分
3. 点击具体的请求查看详情
4. 检查响应状态和响应体

**Rails 日志**:
```bash
# 生产环境
tail -f log/production.log | grep -i stripe

# 开发环境
tail -f log/development.log | grep -i stripe
```

**关键日志**:
```
✅ Checkout session completed for payment 123
✅ Payment succeeded for payment 123
✅ Added 80 credits to user 456
```

### 7. 安全最佳实践

1. ✅ **验证 Webhook 签名** - 已实现
   ```ruby
   event = Stripe::Webhook.construct_event(payload, sig_header, endpoint_secret)
   ```

2. ✅ **禁用 CSRF 保护** - 已实现
   ```ruby
   skip_before_action :verify_authenticity_token, only: [:webhook]
   ```

3. ✅ **使用 HTTPS** - 生产环境必须使用 HTTPS

4. ✅ **保密 Webhook Secret** - 不要提交到代码仓库

5. ✅ **幂等性处理** - webhook 可能重复发送,确保多次处理不会造成问题
   ```ruby
   # Payment model 的 status 确保幂等性
   def mark_as_paid!
     return if paid?  # 已支付则跳过
     update!(status: 'paid')
   end
   ```

### 8. 快速检查清单

- [ ] Stripe Dashboard 已添加 webhook endpoint
- [ ] Endpoint URL 正确: `https://haozan.ai/webhooks/stripe`
- [ ] 监听事件已选择(至少包含 `checkout.session.completed`)
- [ ] `CLACKY_STRIPE_WEBHOOK_SECRET` 环境变量已设置
- [ ] `CLACKY_PUBLIC_HOST` 环境变量已设置为 `haozan.ai`
- [ ] Webhook endpoint 测试成功(发送测试 webhook)
- [ ] 实际支付测试成功(完整流程)
- [ ] 日志中可以看到 webhook 被调用
- [ ] 用户积分/商品正确添加

---

## 总结

您的 webhook 端点代码是正确的,问题可能出在:

1. **Stripe Dashboard 配置**
   - 确认 endpoint URL: `https://haozan.ai/webhooks/stripe`
   - 确认监听事件已选择
   - 确认 webhook secret 正确配置

2. **环境变量配置**
   - 确认 `CLACKY_STRIPE_WEBHOOK_SECRET` 已设置
   - 确认使用正确环境的密钥(测试/生产)

3. **网络访问**
   - 确认 `https://haozan.ai/webhooks/stripe` 可以从外网访问
   - 确认没有防火墙阻止 Stripe 的请求

如果按照以上步骤配置后仍有问题,请检查:
- Stripe Dashboard 的 webhook 详情页中的 "Recent deliveries"
- 应用的生产日志 `log/production.log`

这些日志会显示具体的错误原因。
