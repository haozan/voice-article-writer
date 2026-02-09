# LLM 日志优化说明

## 问题描述

原始错误日志输出不够明朗，无法快速定位问题：

```
E, [2026-02-09T07:42:51.837890 #1] ERROR -- : [ActiveJob] [LlmStreamJob] [589ffc1e-cf55-4511-9b1a-083201dc476f] LLM Error: LlmService::ApiError - API error: 403 - <!doctype html>
```

**具体问题：**
1. 不知道是哪个LLM服务商（Grok/Qwen/DeepSeek/Gemini/Doubao）导致的错误
2. 403错误信息不详细，不清楚是API密钥问题、配额耗尽还是权限问题
3. 无法看到请求细节（URL、headers、参数等）
4. 临时性错误（503、429）也显示在前端，让用户误以为失败了

## 优化内容

### 1. LlmService 增强日志

#### 请求日志（每次API调用前）
```ruby
Rails.logger.info "[LLM REQUEST] Provider: Gemini, URL: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent, Model: gemini-2.0-flash, Stream: false"
Rails.logger.debug "[LLM REQUEST BODY] {\"contents\":[{\"role\":\"user\",\"parts\":[{\"text\":\"你好...\"}]}]}"
```

#### 响应日志（每次API响应后）
```ruby
# 成功响应
Rails.logger.info "[LLM RESPONSE] Provider: Gemini, Status: 200 OK"

# 错误响应（包含完整响应体）
Rails.logger.error "[LLM RESPONSE] Provider: Gemini, Status: 503 Server Error, Body: {\"error\":{\"code\":503,\"message\":\"The service is currently overloaded...\"}}"
```

### 2. LlmStreamJob 增强日志

#### 任务启动日志
```ruby
Rails.logger.info "[LLM STREAM JOB START] Provider: gemini, Article ID: 123, Stream: article_stream_gemini, Framework: original, Streaming: false"
Rails.logger.info "[LLM STREAM JOB CONFIG] Detected Provider: Gemini, Base URL: https://generativelanguage.googleapis.com/v1beta, Model: gemini-2.0-flash"
```

#### 错误详细日志
```ruby
Rails.logger.error "[LLM STREAM JOB ERROR] Provider: gemini, Article ID: 123"
Rails.logger.error "[LLM STREAM JOB ERROR] Error Type: LlmService::ApiError, Message: Server error: 503"
Rails.logger.error "[LLM STREAM JOB ERROR] Backtrace: /home/runner/app/app/services/llm_service.rb:338:in `handle_blocking_response'..."
Rails.logger.error "[LLM API ERROR SUMMARY] Provider: Gemini, Status: 503, Message: Server error: 503"
```

### 3. Provider 自动识别

通过 `detect_provider_from_url` 方法自动识别服务商：

```ruby
def detect_provider_from_url(base_url)
  return 'Qwen' if base_url.include?('dashscope')
  return 'DeepSeek' if base_url.include?('deepseek')
  return 'Gemini' if base_url.include?('generativelanguage')
  return 'Doubao' if base_url.include?('volcengine') || base_url.include?('doubao')
  return 'ChatGPT' if base_url.include?('openai')
  return 'Grok' if base_url.include?('x.ai') || base_url.include?('xai')
  'Unknown'
end
```

### 4. 请求体脱敏

`sanitize_body_for_log` 方法自动截断过长的提示词（保留前200字符），避免日志过大：

```ruby
if msg[:content].length > 200
  msg.merge(content: msg[:content][0..200] + "... (truncated)")
end
```

### 5. 智能错误处理

**关键改进：区分可重试和不可重试错误**

#### 不可重试错误（立即失败，通知前端）
- **401 Unauthorized** - API密钥无效
- **403 Forbidden** - 权限不足
- **400 Bad Request** - 请求格式错误
- **错误消息**：立即显示给用户，保存到数据库

#### 可重试错误（静默重试，不通知前端）
- **503 Service Unavailable** - 服务繁忙
- **429 Too Many Requests** - 速率限制
- **网络超时** - 临时网络问题
- **处理方式**：
  - ✅ 自动重试最多3次（retry_on配置）
  - ✅ 前端保持等待状态（不显示错误）
  - ✅ 后端日志记录重试信息
  - ❌ 不广播错误到ActionCable
  - ❌ 不保存错误状态到数据库

**日志示例（503错误）：**
```ruby
Rails.logger.error "[LLM API ERROR SUMMARY] Provider: Gemini, Status: 503, Message: Server error: 503"
Rails.logger.info "Transient error detected, will retry automatically (up to 3 times): Server error: 503"
Rails.logger.info "Not broadcasting error to frontend - letting retry_on handle it silently"
# 重新抛出异常，由 retry_on 处理重试
```

## 对比效果

### 优化前
```
E, [2026-02-09T07:42:51.837890 #1] ERROR -- : [ActiveJob] [LlmStreamJob] [589ffc1e-cf55-4511-9b1a-083201dc476f] LLM Error: LlmService::ApiError - API error: 403 - <!doctype html>
```

**问题：**
- ❌ 不知道是哪个服务商
- ❌ 不知道请求的URL和参数
- ❌ 403错误信息不完整
- ❌ 看不到完整的响应体
- ❌ 临时错误（503）也显示给用户

### 优化后
```
I, [2026-02-09T16:01:13] INFO -- : [LLM STREAM JOB START] Provider: gemini, Article ID: 123, Stream: article_stream_gemini, Framework: original, Streaming: false
I, [2026-02-09T16:01:13] INFO -- : [LLM STREAM JOB CONFIG] Detected Provider: Gemini, Base URL: https://generativelanguage.googleapis.com/v1beta, Model: gemini-2.0-flash
I, [2026-02-09T16:01:13] INFO -- : [LLM REQUEST] Provider: Gemini, URL: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent, Model: gemini-2.0-flash, Stream: false
D, [2026-02-09T16:01:13] DEBUG -- : [LLM REQUEST BODY] {"contents":[{"role":"user","parts":[{"text":"你好，请帮我..."}]}],"generationConfig":{"temperature":0.7,"maxOutputTokens":8000}}
E, [2026-02-09T16:01:13] ERROR -- : [LLM RESPONSE] Provider: Gemini, Status: 503 Server Error, Body: {"error":{"code":503,"message":"The service is currently overloaded. Please try again later.","status":"UNAVAILABLE"}}
E, [2026-02-09T16:01:13] ERROR -- : [LLM STREAM JOB ERROR] Provider: gemini, Article ID: 123
E, [2026-02-09T16:01:13] ERROR -- : [LLM STREAM JOB ERROR] Error Type: LlmService::ApiError, Message: Server error: 503
E, [2026-02-09T16:01:13] ERROR -- : [LLM STREAM JOB ERROR] Backtrace: /home/runner/app/app/services/llm_service.rb:338:in `handle_blocking_response'
E, [2026-02-09T16:01:13] ERROR -- : [LLM API ERROR SUMMARY] Provider: Gemini, Status: 503, Message: Server error: 503
I, [2026-02-09T16:01:13] INFO -- : Transient error detected, will retry automatically (up to 3 times): Server error: 503
I, [2026-02-09T16:01:13] INFO -- : Not broadcasting error to frontend - letting retry_on handle it silently
```

**优势：**
- ✅ 清楚显示服务商：Gemini
- ✅ 显示完整的请求URL和配置
- ✅ 显示完整的错误响应体（包含详细错误信息）
- ✅ 显示Article ID、Stream名称、Framework等上下文
- ✅ 区分临时错误（503）和永久错误（403），临时错误静默重试
- ✅ 显示完整的堆栈跟踪，便于定位问题
- ✅ 使用统一的日志前缀，便于搜索和过滤

## 日志级别说明

- **INFO**: 正常流程日志（任务启动、请求发送、成功响应）
- **DEBUG**: 详细信息（请求体内容，包含敏感数据，生产环境可关闭）
- **ERROR**: 错误日志（API错误、异常堆栈）

## 相关文件

- `app/services/llm_service.rb` - LLM服务核心逻辑
- `app/jobs/llm_stream_job.rb` - LLM流式任务处理
- `docs/llm_logging_improvements.md` - 本文档
