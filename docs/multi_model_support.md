# 多模型支持说明

本项目现已支持多个 AI 模型提供商，包括 xAI 和 Google Gemini。

## 已集成的模型

### xAI 模型
- **Grok 4.1 Fast Reasoning** - 快速推理模型，适合实时交互场景

### Google 模型  
- **Gemini 2.0 Flash Thinking** - 带思考链的 Flash 模型
- **Gemini 2.0 Flash** - 标准 Flash 模型

## 配置方法

### 环境变量配置

在 `config/application.yml` 中添加 Google AI API 密钥：

```yaml
# Google AI Configuration
GOOGLE_AI_BASE_URL: 'https://generativelanguage.googleapis.com'
GOOGLE_AI_API_KEY: 'your-google-api-key-here'
```

### 默认模型

系统默认使用 xAI Grok 模型。如需更改默认模型，修改：

```yaml
LLM_MODEL: 'grok-4-1-fast-reasoning'  # 或 'gemini-2.0-flash-thinking-exp'
```

## 使用方法

### 前端用户界面

用户可以在文章生成页面的"选择 AI 模型"下拉菜单中选择不同的模型：

1. 打开文章生成页面
2. 在顶部"选择 AI 模型"下拉菜单中选择想要使用的模型
3. 输入内容后点击"开始生成文章"
4. 系统会使用选定的模型进行内容生成

### 代码调用

#### 基本用法（自动检测提供商）

```ruby
# 使用模型名自动检测提供商
LlmService.call(
  prompt: "你好",
  model: "gemini-2.0-flash-exp"  # 自动识别为 Google 提供商
)
```

#### 显式指定提供商

```ruby
# 显式指定提供商
LlmService.call(
  prompt: "你好",
  model: "gemini-2.0-flash-exp",
  provider: "google"
)
```

#### 流式响应

```ruby
# 流式响应（适用于实时场景）
LlmService.call(prompt: "写一首诗", model: "gemini-2.0-flash-exp") do |chunk|
  print chunk
end
```

#### 阻塞式调用

```ruby
# 阻塞式调用（等待完整响应）
response = LlmService.call_blocking(
  prompt: "介绍一下自己",
  model: "gemini-2.0-flash-thinking-exp"
)
puts response
```

## 架构说明

### 提供商检测

系统会根据以下规则自动检测提供商：

1. **显式指定** - 如果传入 `provider:` 参数，使用指定的提供商
2. **模型名检测** - 如果模型名包含 `gemini`，自动使用 Google 提供商
3. **默认提供商** - 否则使用 xAI 提供商

### API 格式转换

- **xAI (Grok)** - 使用标准 OpenAI 兼容格式
- **Google (Gemini)** - 自动转换为 Google AI 格式
  - 请求格式：`contents` 数组 + `generationConfig`
  - 响应格式：自动归一化为 OpenAI 格式

### 认证方式

- **xAI** - 使用 `Authorization: Bearer <token>` header
- **Google** - 使用 `x-goog-api-key: <api-key>` header

## 扩展新模型

### 添加新的 xAI 模型

在 `app/controllers/articles_controller.rb` 中添加：

```ruby
@available_models = [
  { value: 'new-grok-model', label: 'xAI New Grok Model', provider: 'xai' },
  # ...
]
```

### 添加新的 Google 模型

```ruby
@available_models = [
  { value: 'gemini-pro', label: 'Google Gemini Pro', provider: 'google' },
  # ...
]
```

### 添加新的提供商

1. 在 `LlmService#detect_provider` 中添加检测规则
2. 在 `LlmService#provider_base_url` 中添加 API 端点
3. 在 `LlmService#provider_endpoint_path` 中添加路径格式
4. 在 `LlmService#api_key` 中添加 API 密钥环境变量
5. 在 `LlmService#build_request_body` 中添加请求格式转换
6. 在 `LlmService#handle_blocking_response` 中添加响应格式归一化

## 测试

运行完整测试套件：

```bash
rake test
```

运行特定测试：

```bash
bundle exec rspec spec/requests/articles_spec.rb
bundle exec rspec spec/jobs/llm_stream_job_spec.rb
```

## 注意事项

1. **API 密钥安全** - 确保不要将 API 密钥提交到代码仓库
2. **速率限制** - 不同提供商有不同的速率限制，注意调用频率
3. **成本控制** - 监控 API 调用量和成本
4. **模型选择** - 根据场景选择合适的模型（速度 vs 质量）
5. **错误处理** - 系统已配置自动重试策略，但仍需监控错误率

## 故障排查

### Google API 认证失败

检查 `GOOGLE_AI_API_KEY` 是否正确配置：

```bash
rails runner "puts ENV['GOOGLE_AI_API_KEY']"
```

### 模型响应异常

检查 Rails 日志：

```bash
tail -f log/development.log
```

### 测试失败

确保测试环境使用 mock 响应：

```ruby
# LlmService 会在测试环境自动使用 mock
Rails.env.test? # => true
```
