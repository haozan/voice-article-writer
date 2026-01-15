# ⚠️ 重要：API 配置已修复

## 修改说明

已移除代码中硬编码的示例 API keys。现在您需要配置自己的有效 API keys。

## 快速开始

1. **创建配置文件**
   ```bash
   cp .env.example .env.local
   ```

2. **编辑并填入您的 API keys**
   ```bash
   nano .env.local
   ```
   
   至少需要配置：
   ```bash
   # Grok API (必需)
   CLACKY_LLM_API_KEY=xai-YOUR_REAL_KEY_HERE
   
   # 豆包 API (必需)
   DOUBAO_API_KEY=YOUR_REAL_DOUBAO_KEY_HERE
   ```

3. **重启服务**
   ```bash
   # 停止当前服务 (Ctrl+C)
   # 然后重新启动
   bin/dev
   ```

## 详细说明

完整的配置指南请查看: [docs/API_SETUP.md](docs/API_SETUP.md)

## 获取 API Keys

- **Grok**: https://console.x.ai/
- **豆包**: https://console.volcengine.com/ark

---

**注意**: 如果不配置 API keys，Grok 和豆包将无法正常工作，会显示 API 错误。
