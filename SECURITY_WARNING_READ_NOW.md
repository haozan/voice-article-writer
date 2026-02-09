# ⚠️ 安全警告 - 请立即阅读

**日期**: 2026-01-14
**严重性**: 🔴 极高

## 发现的问题

你的仓库 `https://github.com/haozan/voice-article-writer` 中有多个 API keys 被暴露在 Git 历史中。

## 立即行动

1. **阅读**: `URGENT_ACTION_REQUIRED.md` - 包含详细的步骤清单
2. **执行**: 立即撤销所有泄露的 API keys（5-10分钟）
3. **检查**: 查看账单和使用记录
4. **修复**: 选择删除仓库或清理 Git 历史

## 受影响的服务

- ✅ Qwen (阿里云千问) - 在 Git 历史中
- ⚠️ DeepSeek
- ⚠️ Google Gemini
- ⚠️ Zhipu (智谱)
- ⚠️ Doubao (豆包)

## 已完成的修复

- ✅ 移除了 `config/application.yml` 中的所有硬编码 keys
- ✅ 确认 `config/application.yml` 在 `.gitignore` 中
- ✅ 修复了 S3 region 配置问题
- ✅ 创建了安全事件报告和行动清单

## 下一步

**不要提交新代码**，直到你：
1. 撤销了所有旧 API keys
2. 生成了新的 API keys
3. 处理了 GitHub 仓库（删除或清理历史）

## 文档

- `URGENT_ACTION_REQUIRED.md` - 紧急行动清单（按这个操作）
- `SECURITY_INCIDENT.md` - 详细的事件报告

## 时间线

- **泄露时间**: 2026-01-13 01:17 (提交 6949870)
- **发现时间**: 2026-01-14 (现在)
- **暴露时长**: ~1 天

---

**⏰ 越快越好！每多一分钟，被滥用的风险就越高。**
