# 多模型 LLM 集成文档

## 概述

本应用已集成三个 LLM 提供商：

1. **Grok AI** (xAI) - 默认模型
2. **阿里云千问 (Qwen)** - 专业友好的中文模型
3. **DeepSeek** - 专注深度思考的推理模型

用户可以在文章生成页面自由选择使用哪个模型。

## 配置文件

### config/application.yml

所有 LLM 提供商的配置都集中在此文件中：

```yaml
# Grok AI (默认)
LLM_BASE_URL: 'https://api.x.ai/v1'
LLM_API_KEY: 'xai-...'
LLM_MODEL: 'grok-4-1-fast-reasoning'

# 阿里云千问
QWEN_BASE_URL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
QWEN_API_KEY: 'sk-...'
QWEN_MODEL: 'qwen3-max'

# DeepSeek
DEEPSEEK_BASE_URL: 'https://api.deepseek.com/v1'
DEEPSEEK_API_KEY: 'sk-...'
DEEPSEEK_MODEL: 'deepseek-reasoner'
```

## 架构设计

### 1. 数据模型层 (Persona)

```ruby
# app/models/persona.rb
validates :llm_provider, inclusion: { in: %w[grok qwen deepseek] }

def llm_config
  case llm_provider
  when 'qwen' then { base_url: ENV['QWEN_BASE_URL'], ... }
  when 'deepseek' then { base_url: ENV['DEEPSEEK_BASE_URL'], ... }
  when 'grok' then { base_url: ENV['LLM_BASE_URL'], ... }
  end
end
```

### 2. WebSocket 通道层 (ArticlesChannel)

```ruby
# app/channels/articles_channel.rb
def generate_response(data)
  llm_provider = data['llm_provider'] || 'grok'
  llm_config = get_llm_config(llm_provider)
  LlmStreamJob.perform_later(...)
end

def get_llm_config(provider)
  case provider.to_s
  when 'qwen' then { base_url: ENV['QWEN_BASE_URL'], ... }
  when 'deepseek' then { base_url: ENV['DEEPSEEK_BASE_URL'], ... }
  when 'grok' then { base_url: ENV['LLM_BASE_URL'], ... }
  end
end
```

### 3. 后台任务层 (LlmStreamJob)

```ruby
# app/jobs/llm_stream_job.rb
def perform(stream_name:, prompt:, llm_config: nil, **options)
  provider_name = llm_config ? detect_provider(llm_config) : 'Grok'
  system_prompt = build_system_prompt(provider_name)
  options = options.merge(llm_config) if llm_config
  generate_and_stream(...)
end

def detect_provider(llm_config)
  base_url = llm_config[:base_url]
  return 'Qwen' if base_url&.include?('dashscope')
  return 'DeepSeek' if base_url&.include?('deepseek')
  'Grok'
end

def build_system_prompt(provider_name)
  case provider_name
  when 'Qwen' then "你是千问，来自阿里云..."
  when 'DeepSeek' then "你是 DeepSeek，专注深度思考..."
  when 'Grok' then "你是 Grok，来自 xAI..."
  end
end
```

### 4. 前端层

**视图 (app/views/articles/index.html.erb)**:
```erb
<input type="radio" name="llm_provider" value="grok" checked>
<input type="radio" name="llm_provider" value="qwen">
<input type="radio" name="llm_provider" value="deepseek">
```

**控制器 (app/javascript/controllers/articles_controller.ts)**:
```typescript
const selectedProvider = this.providerRadioTargets
  .find(radio => radio.checked)?.value || 'grok'

const providerName = selectedProvider === 'qwen' ? '千问' : 
                     selectedProvider === 'deepseek' ? 'DeepSeek' : 
                     'Grok'

this.perform("generate_response", {
  transcript: this.originalTranscript,
  llm_provider: selectedProvider
})
```

## 数据流

```
用户选择 LLM Provider (前端)
    ↓
ArticlesController 读取选择 (Stimulus)
    ↓
发送到 ArticlesChannel via WebSocket
    ↓
ArticlesChannel.generate_response 获取 llm_config
    ↓
LlmStreamJob.perform_later 后台任务
    ↓
detect_provider 识别提供商
    ↓
build_system_prompt 构建系统提示词
    ↓
LlmService.call 调用对应 API
    ↓
实时流式返回到前端 (ActionCable broadcast)
```

## 系统提示词差异

### Grok AI
- 风格：直接、深刻、有洞见、不废话
- 来源：xAI

### 阿里云千问
- 风格：专业、友好、有洞见
- 来源：阿里云

### DeepSeek
- 风格：深刻、理性、有洞见
- 特点：专注深度思考

## 添加新 LLM 提供商

遵循以下步骤可轻松添加新提供商：

### 1. 添加配置 (config/application.yml)
```yaml
NEW_PROVIDER_BASE_URL: 'https://api.example.com/v1'
NEW_PROVIDER_API_KEY: 'your-key'
NEW_PROVIDER_MODEL: 'model-name'
```

### 2. 更新 Persona 模型
```ruby
validates :llm_provider, inclusion: { in: %w[grok qwen deepseek newprovider] }

def llm_config
  case llm_provider
  when 'newprovider'
    { base_url: ENV['NEW_PROVIDER_BASE_URL'], ... }
  end
end
```

### 3. 更新 ArticlesChannel
```ruby
def get_llm_config(provider)
  when 'newprovider'
    { base_url: ENV['NEW_PROVIDER_BASE_URL'], ... }
end
```

### 4. 更新 LlmStreamJob
```ruby
def detect_provider(llm_config)
  return 'NewProvider' if base_url&.include?('example')
end

def build_system_prompt(provider_name)
  when 'NewProvider'
    "你是 NewProvider..."
end
```

### 5. 更新前端视图和控制器
- 在 `app/views/articles/index.html.erb` 添加 radio 按钮
- 在 `app/javascript/controllers/articles_controller.ts` 添加显示名称映射

## 测试

```bash
# 运行单元测试
bundle exec rspec spec/requests/articles_spec.rb

# 验证页面渲染
curl -s http://localhost:3000/ | grep -c 'name="llm_provider"'  # 应返回 3
```

## 注意事项

1. **OpenAI 兼容性**: 所有提供商都必须兼容 OpenAI API 格式
2. **流式响应**: 所有提供商都支持 SSE 流式响应
3. **系统提示词**: 每个提供商应有独特的系统提示词以体现其特色
4. **错误处理**: LlmService 统一处理所有提供商的错误
5. **默认值**: 当用户未选择时，默认使用 Grok AI

## 配置管理

- **开发环境**: 直接在 `config/application.yml` 配置
- **生产环境**: 通过环境变量 `CLACKY_*` 注入配置
- **API 密钥安全**: 生产环境中不要将密钥提交到代码库

## 维护

### 更换 API 密钥
1. 更新 `config/application.yml`
2. 重启应用 (使用 `bin/dev`)

### 监控使用情况
- 查看 GoodJob 后台任务队列
- 检查 LlmService 调用日志

### 调试
```ruby
# Rails console
rails runner "puts ArticlesChannel.new.send(:get_llm_config, 'deepseek')"
```
