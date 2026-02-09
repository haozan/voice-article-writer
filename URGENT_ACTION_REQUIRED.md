# 🚨 紧急行动清单 - API Keys 已泄露到 GitHub 公开仓库

## ⚠️ 严重性：极高

你的 API keys 已经在 GitHub 公开仓库中暴露：
- **仓库**: https://github.com/haozan/voice-article-writer
- **暴露时间**: 2026-01-13（已经 1+ 天）
- **受影响的提交**: 
  - `6949870` (2026-01-13 01:17)
  - `d5c44c0` (2026-01-13 03:14)

## 📋 立即执行（按优先级）

### 步骤 1: 立即撤销所有 API Keys（5 分钟内完成）⚡

#### 1.1 Qwen (阿里云千问) - 最紧急！
```
URL: https://dashscope.console.aliyun.com/apiKey
泄露的 Key: sk-432c950dfafe4824a011eeda98bcd377
操作: 删除 → 生成新 key → 保存到安全位置
```

#### 1.2 DeepSeek
```
URL: https://platform.deepseek.com/api_keys
泄露的 Key: sk-69cfec2befca46ed80d5305ccab6c59d
操作: Revoke → Create new key
```

#### 1.3 Google Gemini
```
URL: https://aistudio.google.com/apikey
泄露的 Key: AIzaSyBSJ_bAQaegXG-V4NGyljLk6zlDwE6BMNc
操作: Delete key → Create new key
```

#### 1.4 Zhipu (智谱 AI)
```
URL: https://open.bigmodel.cn/usercenter/apikeys
泄露的 Key: 53afb275a7ef46139b5a7142b970f6df.FQmIwIa0bsKbzYXm
操作: 删除 → 新建 API Key
```

#### 1.5 Doubao (豆包/字节跳动)
```
URL: https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey
泄露的 Key: f1cbd905-e1a5-41d7-b062-7b81641fccf8
操作: 删除 → 创建新密钥
```

### 步骤 2: 检查账单和异常使用（10 分钟内）

对每个平台执行：
1. 查看最近 24-48 小时的 API 调用记录
2. 检查是否有异常流量或来源
3. 查看账单是否有意外费用
4. 截图保存证据

**可能的异常迹象：**
- 调用量突然激增
- 来自陌生 IP 的请求
- 非正常时间段的大量请求
- 账单金额异常

### 步骤 3: 更新本地环境变量（5 分钟内）

在你的本地开发环境和生产服务器上：

```bash
# 方法 1: 直接设置环境变量（Linux/Mac）
export QWEN_API_KEY="你的新-qwen-key"
export DEEPSEEK_API_KEY="你的新-deepseek-key"
export GEMINI_API_KEY="你的新-gemini-key"
export ZHIPU_API_KEY="你的新-zhipu-key"
export DOUBAO_API_KEY="你的新-doubao-key"

# 方法 2: 或者在 .bashrc / .zshrc 中永久设置
echo 'export QWEN_API_KEY="你的新key"' >> ~/.bashrc
source ~/.bashrc
```

**Clacky 平台部署：**
在环境变量设置页面添加：
```
CLACKY_LLM_BASE_URL=...
CLACKY_LLM_API_KEY=新的key
```

### 步骤 4: 处理 GitHub 仓库（30 分钟内）

你有两个选择：

#### 选项 A: 删除并重建仓库（最安全，推荐）

1. **备份代码**
```bash
cd /path/to/voice-article-writer
cp -r . ../voice-article-writer-backup
```

2. **在 GitHub 上删除旧仓库**
   - 访问：https://github.com/haozan/voice-article-writer/settings
   - 滚动到底部 → "Delete this repository"
   - 按提示操作

3. **创建干净的新仓库**
```bash
cd /path/to/voice-article-writer
rm -rf .git
git init
git add .
git commit -m "Initial commit (cleaned)"
# 在 GitHub 创建新仓库后
git remote add origin https://github.com/haozan/voice-article-writer.git
git push -u origin master
```

#### 选项 B: 清理 Git 历史（复杂，不保证完全安全）

使用 BFG Repo-Cleaner：
```bash
# 1. 下载 BFG
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar

# 2. 创建替换文件
cat > secrets.txt << EOF
sk-432c950dfafe4824a011eeda98bcd377
sk-69cfec2befca46ed80d5305ccab6c59d
AIzaSyBSJ_bAQaegXG-V4NGyljLk6zlDwE6BMNc
53afb275a7ef46139b5a7142b970f6df.FQmIwIa0bsKbzYXm
f1cbd905-e1a5-41d7-b062-7b81641fccf8
EOF

# 3. 运行清理
java -jar bfg-1.14.0.jar --replace-text secrets.txt .git

# 4. 清理和推送
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force --all
git push --force --tags
```

⚠️ **警告**: 即使清理了历史，GitHub 和爬虫可能已经缓存了这些 keys

### 步骤 5: 设置安全防护（15 分钟内）

防止未来泄露：

```bash
# 1. 安装 git-secrets
brew install git-secrets  # Mac
# 或
sudo apt-get install git-secrets  # Ubuntu

# 2. 配置当前仓库
cd /path/to/voice-article-writer
git secrets --install
git secrets --register-aws

# 3. 添加自定义模式
git secrets --add 'sk-[a-zA-Z0-9]{30,}'
git secrets --add 'AIzaSy[a-zA-Z0-9_-]{33}'
git secrets --add '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

# 4. 扫描现有历史
git secrets --scan-history
```

## 📊 检查清单

完成后勾选：

- [ ] ✅ 已撤销 Qwen API key
- [ ] ✅ 已撤销 DeepSeek API key
- [ ] ✅ 已撤销 Gemini API key
- [ ] ✅ 已撤销 Zhipu API key
- [ ] ✅ 已撤销 Doubao API key
- [ ] ✅ 已生成所有新 keys
- [ ] ✅ 已检查所有平台的账单
- [ ] ✅ 已更新本地环境变量
- [ ] ✅ 已更新生产环境变量
- [ ] ✅ 已处理 GitHub 仓库（删除或清理）
- [ ] ✅ 已安装 git-secrets
- [ ] ✅ 已通知团队成员（如有）

## 🔍 验证

完成所有步骤后，验证：

```bash
# 1. 确认旧 keys 无法使用
curl -H "Authorization: Bearer sk-432c950dfafe4824a011eeda98bcd377" \
  https://dashscope.aliyuncs.com/compatible-mode/v1/models
# 应该返回 401 或类似错误

# 2. 确认新 keys 可以工作
curl -H "Authorization: Bearer 你的新key" \
  https://dashscope.aliyuncs.com/compatible-mode/v1/models
# 应该返回 200 和模型列表

# 3. 确认代码中无硬编码 keys
grep -r "sk-" . --exclude-dir=.git --exclude-dir=node_modules
# 应该只看到文档中的示例
```

## 📞 获取帮助

如果发现未授权使用或费用异常：

1. **Qwen/阿里云**: 
   - 工单：https://help.aliyun.com/
   - 电话：95187

2. **DeepSeek**: 
   - Email: support@deepseek.com
   - Discord: https://discord.gg/deepseek

3. **Google Gemini**: 
   - Support: https://support.google.com/ai-studio/

4. **Zhipu**: 
   - 工单：https://open.bigmodel.cn/
   - 客服咨询

5. **Doubao/字节**: 
   - 文档：https://www.volcengine.com/docs/6459/105806
   - 工单系统

## 📝 事后总结

完成后记录：
- 发现时间：
- 撤销时间：
- 是否发现异常使用：
- 造成的损失（如有）：
- 采取的措施：
- 经验教训：

---
**创建时间**: $(date +"%Y-%m-%d %H:%M:%S")
**状态**: 🔴 需要立即执行
**预计耗时**: 30-60 分钟
