# LLM 日志输出改进说明

## 问题描述

之前的日志输出不够详细，无法快速定位LLM API错误的具体原因：
```
E, [2026-02-09T07:42:51.837890 #1] ERROR -- : [ActiveJob] [LlmStreamJob] [589ffc1e-cf55-4511-9b1a-083201dc476f] LLM Error: LlmService::ApiError - API error: 403 - <!doctype html>
```

**存在的问题：**
1. 看不出是哪个LLM服务商（Grok/Qwen/DeepSeek/Gemini/Doubao）导致的403
2. 403错误信息不详细，不知道具体原因（API key无效？配额用完？权限问题？）
3. 看不到请求的详细信息（URL、模型、参数等）

## 改进方案

### 1. LlmService 日志增强

#### 请求前日志
```ruby
[LLM REQUEST] Provider: Qwen, URL: https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions, Model: qwen-max, Stream: true
[LLM REQUEST BODY] {"model":"qwen-max","messages":[{"role":"user","content":"..."}],"temperature":0.7,"max_tokens":4000,"stream":true}
```

#### 成功响应日志
```ruby
[LLM RESPONSE] Provider: Qwen, Status: 200 OK
[LLM STREAM RESPONSE] Provider: Gemini, Status: 200 OK, Streaming...
```

#### 错误响应日志
```ruby
# 403错误
[LLM RESPONSE] Provider: Doubao, Status: 403 Error, Body: {"error":{"message":"Invalid API key","type":"invalid_request_error"}}

# 429限流错误
[LLM RESPONSE] Provider: DeepSeek, Status: 429 Rate Limit, Body: {"error":"Rate limit exceeded, please try again later"}

# 500服务器错误
[LLM RESPONSE] Provider: Grok, Status: 502 Server Error, Body: {"error":"Bad Gateway"}
```

### 2. LlmStreamJob 日志增强

#### 任务启动日志
```ruby
[LLM STREAM JOB START] Provider: qwen, Article ID: 127, Stream: article_abc123_qwen, Framework: original, Streaming: true
[LLM STREAM JOB CONFIG] Detected Provider: Qwen, Base URL: https://dashscope.aliyuncs.com/compatible-mode/v1, Model: qwen-max
```

或使用默认配置时：
```ruby
[LLM STREAM JOB START] Provider: default, Article ID: nil, Stream: chat_456, Framework: original, Streaming: true
[LLM STREAM JOB CONFIG] Using default ENV config - Base URL: https://api.x.ai/v1, Model: grok-2-latest
```

#### 错误详情日志
```ruby
[LLM STREAM JOB ERROR] Provider: gemini, Article ID: 127
[LLM STREAM JOB ERROR] Error Type: LlmService::ApiError, Message: API error: 403 - {"error":{"code":403,"message":"API key not valid. Please pass a valid API key.","status":"PERMISSION_DENIED"}}
[LLM STREAM JOB ERROR] Backtrace: 
app/services/llm_service.rb:340:in `handle_stream_response'
app/services/llm_service.rb:266:in `make_http_request'
app/services/llm_service.rb:149:in `call_stream_simple'
app/services/llm_service.rb:141:in `call_stream'
app/jobs/llm_stream_job.rb:391:in `generate_and_stream'
```

#### 错误摘要日志
```ruby
[LLM API ERROR SUMMARY] Provider: Gemini, Status: 403, Message: API error: 403 - {"error":{"code":403,"message":"API key not valid. Please pass a valid API key.","status":"PERMISSION_DENIED"}}
```

## 新增功能

### 1. 服务商自动检测
根据 base_url 自动识别服务商：
- `dashscope` → Qwen
- `deepseek` → DeepSeek
- `generativelanguage` → Gemini
- `volcengine` / `doubao` → Doubao
- `openai` → ChatGPT
- `x.ai` / `xai` → Grok

### 2. 请求体敏感信息处理
自动截断过长的prompt（超过200字符），避免日志过于冗长：
```ruby
# 原始
{"messages":[{"role":"user","content":"这是一段非常非常非常长的prompt内容...（省略1000字）"}]}

# 日志中显示
{"messages":[{"role":"user","content":"这是一段非常非常非常长的prompt内容...（省略1000字）... (truncated)"}]}
```

### 3. HTTP状态码提取
从错误消息中自动提取状态码，便于分类统计：
```ruby
# 从 "API error: 403 - ..." 提取 → "403"
# 从 "Rate limit exceeded" + "429" 提取 → "429"
```

## 使用效果对比

### 改进前
```
ERROR -- : [ActiveJob] [LlmStreamJob] LLM Error: LlmService::ApiError - API error: 403 - <!doctype html>
```
**问题：** 无法判断是哪个服务商，也看不到详细错误信息。

### 改进后
```
INFO  -- : [LLM REQUEST] Provider: Gemini, URL: https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:streamGenerateContent, Model: gemini-pro, Stream: true
DEBUG -- : [LLM REQUEST BODY] {"contents":[{"role":"user","parts":[{"text":"你好... (truncated)"}]}],"generationConfig":{"temperature":0.7,"maxOutputTokens":4000}}
ERROR -- : [LLM STREAM RESPONSE] Provider: Gemini, Status: 403 Error, Body: {"error":{"code":403,"message":"API key not valid. Please pass a valid API key.","status":"PERMISSION_DENIED","details":[...]}}
ERROR -- : [LLM STREAM JOB ERROR] Provider: gemini, Article ID: 127
ERROR -- : [LLM STREAM JOB ERROR] Error Type: LlmService::ApiError, Message: API error: 403 - {"error":{"code":403,"message":"API key not valid. Please pass a valid API key.","status":"PERMISSION_DENIED"}}
ERROR -- : [LLM API ERROR SUMMARY] Provider: Gemini, Status: 403, Message: API error: 403 - {"error":{"code":403,"message":"API key not valid. Please pass a valid API key."...
```

**优势：**
1. 一眼看出是 **Gemini** 服务商的问题
2. 明确知道是 **403** 错误
3. 看到完整的错误详情：**"API key not valid"**
4. 知道请求的URL、模型、配置等完整上下文

## 日志级别说明

- `INFO`: 正常请求、响应、任务启动
- `DEBUG`: 请求体详情（仅在开发环境或调试时启用）
- `ERROR`: API错误、超时、异常等

## 相关文件

- `app/services/llm_service.rb`: LLM服务基础层，负责HTTP请求和响应处理
- `app/jobs/llm_stream_job.rb`: LLM流式任务层，负责异步任务调度和错误处理
