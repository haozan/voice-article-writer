# 阿里云千问模型集成说明

## 概述

本应用已成功集成阿里云千问（Qwen3-Max）模型，用户现在可以在 Grok AI 和阿里云千问之间自由选择。

## 配置信息

### 环境变量配置 (`config/application.yml`)

```yaml
# Qwen (Alibaba Cloud) Configuration
QWEN_BASE_URL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
QWEN_API_KEY: 'sk-432c950dfafe4824a011eeda98bcd377'
QWEN_MODEL: 'qwen3-max'
# Qwen Configuration end
```

### 数据库变更

添加了 `llm_provider` 字段到 `personas` 表：

```ruby
# Migration: 20260113061248_add_llm_provider_to_personas.rb
add_column :personas, :llm_provider, :string, default: "grok"
```

支持的值：
- `grok` - Grok AI (xAI)
- `qwen` - 阿里云千问

## 架构设计

### 1. Persona 模型 (`app/models/persona.rb`)

```ruby
class Persona < ApplicationRecord
  validates :llm_provider, inclusion: { in: %w[grok qwen] }
  
  # 获取 LLM 配置
  def llm_config
    case llm_provider
    when 'qwen'
      { base_url: ENV.fetch('QWEN_BASE_URL'), ... }
    when 'grok'
      { base_url: ENV.fetch('LLM_BASE_URL'), ... }
    end
  end
  
  # 获取提供商显示名称
  def llm_provider_name
    case llm_provider
    when 'qwen' then '阿里云千问'
    when 'grok' then 'Grok AI'
    end
  end
end
```

### 2. LLM Stream Job (`app/jobs/llm_stream_job.rb`)

支持动态配置 LLM provider：

```ruby
def perform(stream_name:, prompt:, llm_config: nil, **options)
  provider_name = llm_config ? detect_provider(llm_config) : 'Grok'
  system_prompt = build_system_prompt(provider_name)
  options = options.merge(llm_config) if llm_config
  generate_and_stream(stream_name, prompt, system_prompt, **options)
end
```

### 3. Articles Channel (`app/channels/articles_channel.rb`)

接收前端传来的 `llm_provider` 参数并获取相应配置：

```ruby
def generate_response(data)
  llm_provider = data['llm_provider'] || 'grok'
  llm_config = get_llm_config(llm_provider)
  
  LlmStreamJob.perform_later(
    stream_name: @stream_name,
    prompt: transcript,
    llm_config: llm_config
  )
end
```

### 4. 前端 UI (`app/views/articles/index.html.erb`)

提供 radio 按钮供用户选择：

```erb
<label>
  <input type="radio" name="llm_provider" value="grok" checked 
         data-articles-target="providerRadio">
  Grok AI
</label>

<label>
  <input type="radio" name="llm_provider" value="qwen"
         data-articles-target="providerRadio">
  阿里云千问
</label>
```

### 5. Stimulus Controller (`app/javascript/controllers/articles_controller.ts`)

读取用户选择并传递给后端：

```typescript
const selectedProvider = this.providerRadioTargets
  .find((radio) => radio.checked)?.value || 'grok'
  
this.perform("generate_response", {
  transcript: this.originalTranscript,
  llm_provider: selectedProvider
})
```

## 使用流程

1. 用户访问 `/articles` 页面
2. 选择 AI 模型（Grok AI 或阿里云千问）
3. 输入内容并点击"开始对话"
4. 系统根据选择的模型调用对应的 API
5. 实时流式显示 AI 响应

## API 兼容性

阿里云千问使用 OpenAI 兼容模式 API：
- Endpoint: `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`
- 完全兼容 OpenAI 的 Chat Completions API
- 支持流式响应 (streaming)

## 系统提示词差异

### Grok AI
```
你是 Grok，来自 xAI。用户会分享他的想法、观点或内容。
保持 Grok 的风格：直接、深刻、有洞见、不废话
```

### 阿里云千问
```
你是千问，来自阿里云。用户会分享他的想法、观点或内容。
保持专业、友好、有洞见的风格
```

## 测试

运行测试确保功能正常：

```bash
bundle exec rspec spec/requests/articles_spec.rb
```

## 未来扩展

如需添加更多 LLM 提供商：

1. 在 `config/application.yml` 添加配置
2. 更新 `Persona` 模型的 `llm_config` 方法
3. 更新 `LlmStreamJob` 的 `build_system_prompt` 方法
4. 在前端添加新的 radio 选项
5. 更新数据库验证规则

## 注意事项

- API Key 应该存储在环境变量中，不要硬编码
- 生产环境建议使用 `CLACKY_*` 前缀的环境变量
- 千问国际版和国内版的 endpoint 不同，请注意区分
