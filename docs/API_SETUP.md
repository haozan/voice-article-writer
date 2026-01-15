# API 配置指南

## 问题说明

如果您看到 Grok 或豆包提示 API 错误，这是因为系统需要配置有效的 API keys。

## 配置步骤

### 方法一：使用 .env.local 文件（推荐）

1. **复制示例文件**
   ```bash
   cp .env.example .env.local
   ```

2. **编辑 .env.local 文件**
   ```bash
   # 使用任意编辑器打开
   nano .env.local
   # 或
   vim .env.local
   ```

3. **填入您的 API keys**
   
   **Grok (xAI):**
   ```bash
   CLACKY_LLM_API_KEY=xai-YOUR_ACTUAL_KEY_HERE
   ```
   - 获取地址: https://console.x.ai/
   - 登录后在 API Keys 页面创建新 key

   **豆包 (字节跳动):**
   ```bash
   DOUBAO_API_KEY=YOUR_ACTUAL_DOUBAO_KEY_HERE
   ```
   - 获取地址: https://console.volcengine.com/ark
   - 需要开通火山引擎豆包大模型服务

4. **重启服务**
   ```bash
   # 停止当前运行的服务 (Ctrl+C)
   # 然后重新启动
   bin/dev
   ```

### 方法二：直接修改 config/application.yml

如果不想使用 .env.local 文件，也可以直接修改 `config/application.yml`：

```yaml
# Grok 配置
LLM_API_KEY: '<%= ENV.fetch("CLACKY_LLM_API_KEY", "xai-YOUR_KEY") %>'

# 豆包配置
DOUBAO_API_KEY_OPTIONAL: '<%= ENV.fetch("DOUBAO_API_KEY", "YOUR_DOUBAO_KEY") %>'
```

⚠️ **注意**: 这种方法会将 API key 提交到 git，不够安全。建议使用方法一。

## 验证配置

配置完成后，在写作页面点击"开始对话"，应该能看到：
- ✅ Grok 和豆包正常输出回应
- ❌ 不再显示 API 错误提示

## 可选：配置其他模型

如果您也想使用千问、DeepSeek、Gemini、智谱等模型，可以在 `.env.local` 中添加相应的配置：

```bash
# 千问
QWEN_API_KEY=sk-YOUR_QWEN_KEY

# DeepSeek  
DEEPSEEK_API_KEY=sk-YOUR_DEEPSEEK_KEY

# Gemini
GEMINI_API_KEY=YOUR_GEMINI_KEY

# 智谱
ZHIPU_API_KEY=YOUR_ZHIPU_KEY
```

## 常见问题

### Q: 我配置了 API key 但还是报错？
A: 请确保：
1. `.env.local` 文件在项目根目录
2. 文件名正确（注意是 `.env.local` 不是 `env.local`）
3. 已经重启服务（停止后重新 `bin/dev`）
4. API key 没有多余的空格或引号

### Q: 哪些模型是必须配置的？
A: 目前系统使用 6 个模型：
- **必须配置**: Grok (主模型)、豆包
- **可选**: 千问、DeepSeek、Gemini、智谱（如果不配置这些，它们会显示错误，但不影响 Grok 和豆包使用）

### Q: API key 会被泄露吗？
A: 不会。`.env.local` 文件已经在 `.gitignore` 中，不会被提交到 git 仓库。

## 获取 API Keys

| 模型 | 官网 | 说明 |
|------|------|------|
| Grok | https://console.x.ai/ | xAI 官方控制台，需要信用卡 |
| 豆包 | https://console.volcengine.com/ark | 字节跳动火山引擎，需要实名认证 |
| 千问 | https://dashscope.console.aliyun.com/ | 阿里云灵积平台 |
| DeepSeek | https://platform.deepseek.com/ | DeepSeek 开放平台 |
| Gemini | https://aistudio.google.com/app/apikey | Google AI Studio |
| 智谱 | https://open.bigmodel.cn/ | 智谱 AI 开放平台 |
