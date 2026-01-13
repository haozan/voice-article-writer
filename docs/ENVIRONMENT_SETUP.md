# 环境配置指南

## 🔐 API Keys 配置

本项目需要配置多个 LLM 服务提供商的 API keys。为了安全起见，**所有 API keys 都不应该提交到代码仓库**。

### 1. 复制配置模板

```bash
# 复制 .env 模板
cp .env.example .env

# 复制 application.yml 模板（如果不存在）
cp config/application.yml.example config/application.yml
```

### 2. 配置 API Keys

编辑 `.env` 文件，填入你的真实 API keys：

```bash
# Grok (X AI) - Default LLM provider
CLACKY_LLM_BASE_URL=https://api.x.ai/v1
CLACKY_LLM_API_KEY=your_actual_grok_api_key_here
CLACKY_LLM_MODEL=grok-4-1-fast-reasoning

# Qwen (Alibaba Cloud) - 千问
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
QWEN_API_KEY=your_actual_qwen_api_key_here
QWEN_MODEL=qwen3-max

# DeepSeek - 深度推理模型
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_KEY=your_actual_deepseek_api_key_here
DEEPSEEK_MODEL=deepseek-reasoner

# Gemini (Google) - Google AI
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_MODEL=models/gemini-3-flash-preview

# Zhipu (智谱 AI) - GLM 模型
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/paas/v4
ZHIPU_API_KEY=your_actual_zhipu_api_key_here
ZHIPU_MODEL=glm-4-flash
```

### 3. 支持的 LLM 提供商

| 提供商 | 模型 | 特点 |
|--------|------|------|
| **Grok** | grok-4-1-fast-reasoning | 直接、深刻、有洞见、不废话 |
| **千问** | qwen3-max | 专业、友好、有洞见 |
| **DeepSeek** | deepseek-reasoner | 深刻、理性、有洞见、支持推理 |
| **Gemini** | gemini-3-flash-preview | 智能、准确、富有创造力 |
| **智谱** | glm-4-flash | 精准、高效、实用 |

### 4. 获取 API Keys

- **Grok**: https://x.ai/api
- **千问**: https://dashscope.aliyuncs.com/ (国内站点)
- **DeepSeek**: https://platform.deepseek.com/
- **Gemini**: https://ai.google.dev/
- **智谱**: https://open.bigmodel.cn/

### 5. 安全注意事项

⚠️ **重要提醒**：

1. **永远不要**将 `.env` 或 `config/application.yml` 提交到 Git 仓库
2. 这些文件已经在 `.gitignore` 中被忽略
3. 如果不小心提交了 API keys，请立即：
   - 撤销提交
   - 在对应平台重新生成新的 API keys
   - 删除旧的 API keys
4. 在生产环境，通过环境变量注入 API keys（不使用配置文件）

### 6. 验证配置

启动项目后，所有 5 个 LLM 提供商应该都能正常工作：

```bash
bin/dev
```

访问前端页面，测试每个 AI 模型是否能正常回复。

## 📝 配置文件说明

### `.env` 文件
- 用于本地开发环境
- 被 `.gitignore` 忽略，不会提交到 Git
- 直接设置环境变量

### `config/application.yml`
- Figaro gem 使用的配置文件
- 被 `.gitignore` 忽略，不会提交到 Git
- 使用 ERB 语法从环境变量读取值
- 生产环境会从 Clacky 平台自动注入环境变量

### 示例文件
- `.env.example` - 环境变量模板
- `config/application.yml.example` - 应用配置模板
- 这两个文件可以提交到 Git，但不包含真实的 API keys
