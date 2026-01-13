# 语音文章写作达人 (Voice Article Writer)

一个基于 AI 的语音文章生成工具，帮助用户通过语音快速创作高质量文章。

## 产品特点

- **极简语音输入**: 长按麦克风，像聊天一样说出你的想法
- **AI 深度思考**: Grok AI 先提供专业分析和建议，激发创作灵感
- **有人味的文章**: 自动融合用户原意和 AI 建议，生成自然流畅的完整文章
- **实时流式生成**: 两步生成过程全程可见，体验流畅
- **隐私保护**: 语音在浏览器本地识别，无需上传音频，不保存任何内容

## 技术栈

- **后端**: Ruby on Rails 7.2
- **前端**: Stimulus JS + Turbo + TailwindCSS
- **语音识别**: Web Speech API (浏览器原生)
- **AI 服务**: LLM Service (支持 Grok 等兼容 OpenAI API 的服务)
- **实时通信**: ActionCable (WebSocket)
- **后台任务**: GoodJob (PostgreSQL-based)

## 工作流程

1. **语音输入**: 用户长按麦克风说话，Web Speech API 实时识别并显示文字
2. **第一步 - AI 思考**: 
   - 用户语音文字发送给 Grok
   - Grok 提供深度思考、分析和建议
   - 实时流式显示在"Grok 的思考"区域
3. **第二步 - 生成文章**:
   - 自动将用户原意 + Grok 思考发送给 Grok
   - Grok 深度融合两部分，生成完整文章
   - 实时流式显示在"最终文章"区域
4. **一键复制**: 用户可以直接复制文章，发布到任何平台

## 核心组件

### 后端

- `LlmStreamJob`: 处理两步 AI 生成的后台任务
  - `step: 'thinking'` - 生成 Grok 的思考
  - `step: 'article'` - 生成最终文章
- `ArticlesChannel`: WebSocket 频道，处理实时消息传递
- `LlmService`: LLM 服务封装，支持流式响应

### 前端

- `VoiceRecorderController`: 处理语音录制
  - 使用 Web Speech API
  - 支持长时间连续录音
  - 自动处理识别错误
- `ArticlesController`: 处理文章生成流程
  - 管理两步生成的状态
  - 接收和显示流式内容
  - 提供复制和重置功能

## 环境配置

### 必需的环境变量

在 `config/application.yml` 中配置以下变量：

```yaml
# LLM Service Configuration
LLM_BASE_URL: 'https://api.openai.com/v1'  # 或 Grok API endpoint
LLM_API_KEY: 'your-api-key-here'
LLM_MODEL: 'gpt-4'  # 或其他兼容模型
```

对于 Clacky 部署环境，这些会自动从 `CLACKY_*` 环境变量导入。

## 安装与运行

### 开发环境

```bash
# 安装依赖
bundle install
npm install

# 设置数据库
rails db:create db:migrate

# 配置环境变量（复制示例文件并填写）
cp config/application.yml.example config/application.yml

# 启动开发服务器
bin/dev
```

访问 http://localhost:3000

### 生产环境

```bash
# 编译资源
npm run build:css
npm run build:js

# 运行迁移
rails db:migrate

# 启动服务
rails s -e production
```

## 浏览器兼容性

语音识别功能需要支持 Web Speech API 的浏览器：

- ✅ Chrome / Edge (推荐)
- ✅ Safari (iOS 和 macOS)
- ⚠️ Firefox (部分支持)
- ❌ Internet Explorer (不支持)

建议使用 Chrome 或 Edge 以获得最佳体验。

## 架构设计

### 双步生成流程

```
用户语音 → Grok 思考 → 最终文章
          ↓            ↓
      流式显示      流式显示
```

### WebSocket 通信

```
Frontend (Stimulus)
    ↓ perform('generate_thinking', data)
ArticlesChannel
    ↓ LlmStreamJob.perform_later
Backend Job
    ↓ ActionCable.server.broadcast
Frontend Handler (handleChunk, handleComplete)
```

## 测试

```bash
# 运行所有测试
rake test

# 运行单个测试文件
bundle exec rspec spec/requests/articles_spec.rb
```

## 部署

应用已针对 Clacky 平台优化，支持一键部署。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
