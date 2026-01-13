# OpenRouter 集成指南

## 概述

本应用已集成 [OpenRouter](https://openrouter.ai/)，这是一个统一的 AI 模型 API 服务，提供对 100+ 个 AI 模型的访问，包括：

- **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
- **OpenAI**: GPT-4 Turbo, GPT-4o, GPT-3.5 Turbo
- **Google**: Gemini 2.0 Flash, Gemini Pro 1.5
- **xAI**: Grok Beta
- **Meta**: Llama 3.1 (405B, 70B)
- **Mistral**: Mistral Large, Mixtral 8x7B
- 以及更多...

## 优势

1. **统一接口**: 所有模型使用相同的 OpenAI 兼容 API 格式
2. **无需格式转换**: 不需要为每个提供商编写特定的转换逻辑
3. **简化维护**: 添加新模型只需修改配置，无需改代码
4. **灵活选择**: 用户可以在前端自由切换不同的 AI 模型
5. **成本优化**: OpenRouter 支持自动路由到最便宜的模型

## 配置

### 1. 环境变量配置

在 `config/application.yml` 中：

```yaml
# OpenRouter Configuration (unified multi-model API)
LLM_BASE_URL: '<%= ENV.fetch("CLACKY_LLM_BASE_URL", 'https://openrouter.ai/api/v1') %>'
LLM_API_KEY: '<%= ENV.fetch("CLACKY_LLM_API_KEY", 'your-openrouter-api-key') %>'
OPENROUTER_SITE_URL: '<%= ENV.fetch("CLACKY_OPENROUTER_SITE_URL", '') %>'
OPENROUTER_APP_NAME: '<%= ENV.fetch("CLACKY_OPENROUTER_APP_NAME", 'AI Article Generator') %>'

# Default model
LLM_MODEL: '<%= ENV.fetch("CLACKY_LLM_MODEL", 'anthropic/claude-3.5-sonnet') %>'
```

### 2. 获取 API Key

1. 访问 [OpenRouter 官网](https://openrouter.ai/)
2. 注册账号并登录
3. 在 Dashboard 中生成 API Key
4. 将 API Key 配置到 `LLM_API_KEY`

### 3. 可选配置

- `OPENROUTER_SITE_URL`: 你的网站 URL，OpenRouter 会在其网站上展示你的应用
- `OPENROUTER_APP_NAME`: 你的应用名称

## 使用方法

### 1. 后端使用 LlmService

```ruby
# 基本使用（使用默认模型）
content = LlmService.call_blocking(
  prompt: "写一篇关于 AI 的文章",
  system: "你是一个专业的技术写作助手"
)

# 指定模型
content = LlmService.call_blocking(
  prompt: "写一篇关于 AI 的文章",
  system: "你是一个专业的技术写作助手",
  model: "anthropic/claude-3.5-sonnet"
)

# 流式响应
LlmService.call_stream(
  prompt: "写一篇关于 AI 的文章",
  model: "openai/gpt-4o"
) do |chunk|
  print chunk
end
```

### 2. 前端模型选择

在 `app/controllers/articles_controller.rb` 中配置可用模型：

```ruby
@available_models = [
  # Anthropic Models
  { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', provider: 'anthropic' },
  
  # OpenAI Models
  { value: 'openai/gpt-4o', label: 'GPT-4o', provider: 'openai' },
  
  # Google Models
  { value: 'google/gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash', provider: 'google' },
  
  # 添加更多模型...
]
```

### 3. ActionCable 流式传输

通过 WebSocket 实时传输 AI 响应：

```ruby
# 在 Channel 中
def generate_content(data)
  LlmStreamJob.perform_later(
    stream_name: @stream_name,
    step: 'thinking',
    prompt: data['prompt'],
    model: data['model'],      # 'anthropic/claude-3.5-sonnet'
    provider: data['provider']  # 'anthropic'
  )
end
```

## 支持的模型格式

OpenRouter 使用命名空间格式：`provider/model-name`

示例：
- `anthropic/claude-3.5-sonnet`
- `openai/gpt-4o`
- `google/gemini-2.0-flash-exp`
- `x-ai/grok-beta`
- `meta-llama/llama-3.1-405b-instruct`
- `mistralai/mistral-large`

完整模型列表：https://openrouter.ai/models

## AI 名称自动识别

系统会根据 provider 或 model 名称自动识别 AI 助手名称：

```ruby
# 在 LlmStreamJob 中
def determine_ai_name(model, provider)
  case provider.to_s.downcase
  when 'anthropic' then 'Claude'
  when 'openai' then 'GPT'
  when 'google' then 'Gemini'
  when 'xai' then 'Grok'
  when 'meta' then 'Llama'
  when 'mistral' then 'Mistral'
  else 'AI'
  end
end
```

这个名称会在文章生成系统提示中使用，例如："你是 Claude..."

## 添加新模型

只需在 `ArticlesController` 中添加配置：

```ruby
@available_models << {
  value: 'provider/model-name',
  label: 'Display Name',
  provider: 'provider'
}
```

无需修改任何其他代码！

## 成本管理

OpenRouter 提供透明的定价：

1. 访问 [OpenRouter Models](https://openrouter.ai/models) 查看各模型价格
2. 在 Dashboard 中设置预算限制
3. 使用 `credits` 参数控制单次调用成本
4. 监控使用统计

## 故障排查

### 1. API Key 错误

```
Error: API error: 401 - Unauthorized
```

**解决方案**: 检查 `LLM_API_KEY` 是否正确配置

### 2. 模型不存在

```
Error: API error: 404 - Model not found
```

**解决方案**: 
- 检查模型名称是否正确（区分大小写）
- 访问 https://openrouter.ai/models 确认模型可用性

### 3. 速率限制

```
Error: Rate limit exceeded
```

**解决方案**: 
- 在 OpenRouter Dashboard 中充值
- 或等待一段时间后重试

### 4. 超时错误

```
Error: Request timed out after 30s
```

**解决方案**: 
- 增加 `timeout` 参数：`model: 'xxx', timeout: 60`
- 或使用更快的模型

## 架构优势

### 重构前（多提供商特定代码）

```ruby
# 需要为每个提供商编写特定逻辑
case @provider
when :google
  convert_to_google_format(body)
when :xai
  convert_to_xai_format(body)
# ... 更多提供商
end
```

### 重构后（OpenRouter 统一接口）

```ruby
# 所有模型使用相同的 OpenAI 格式
body = {
  model: @model,
  messages: @messages,
  temperature: @temperature,
  max_tokens: @max_tokens,
  stream: stream
}
```

**代码减少 60%+，维护成本大幅降低！**

## 参考资源

- [OpenRouter 官网](https://openrouter.ai/)
- [OpenRouter 文档](https://openrouter.ai/docs)
- [模型列表](https://openrouter.ai/models)
- [定价说明](https://openrouter.ai/docs#models)
- [API 参考](https://openrouter.ai/docs#api-keys)
