# API Key 泄露根本原因 - 完整总结

## 🎯 核心结论

**你的问题："为什么旧提交会出现这个情况？"**

**答案：真实的 API key 是通过文档文件中的示例代码泄露的，而不是 `config/application.yml` 被提交了。**

---

## 📊 问题对比

### ❌ 很多人的误解

```
误解：config/application.yml 被提交到 Git 了
       ↓
     因此 API keys 泄露了
```

**这是错的！** `config/application.yml` 一直被 `.gitignore` 保护，从未被提交过。

### ✅ 真实情况

```
真实情况：文档文件 docs/qwen_integration.md 中的示例代码
         包含了真实的 API key
           ↓
         这个文档文件被提交到 Git
           ↓
         API keys 通过文档泄露了
```

---

## 🔍 完整的泄露路径

### 时间线

**2026-01-13 01:17** - 提交 `6949870`

```
开发过程：
1. 开发者在本地 config/application.yml 配置真实 API key
   QWEN_API_KEY: 'sk-432c950dfafe4824a011eeda98bcd377'

2. 功能开发完成，测试通过 ✅

3. 准备提交，创建文档 docs/qwen_integration.md
   └─ 为了方便，直接从 config/application.yml 复制配置作为示例
   └─ ⚠️ 忘记替换为占位符！

4. Git 提交：
   ├─ config/application.yml ← 被 .gitignore 阻止 ✅
   └─ docs/qwen_integration.md ← 提交成功，包含真实 key ❌

5. 推送到 GitHub
   └─ docs/qwen_integration.md 公开可见
       └─ 🚨 API key 泄露！
```

### 泄露的证据

**提交内容：**
```bash
$ git show 6949870 --stat
 docs/qwen_integration.md | 173 +++++++++++++++++++++
```

**文档中的代码：**
```yaml
### 环境变量配置 (`config/application.yml`)

```yaml
QWEN_API_KEY: 'sk-432c950dfafe4824a011eeda98bcd377'  ← 真实 key！
```
```

---

## 🤔 为什么会犯这个错误？

### 1. 写文档时的心理

```
开发者想法：
"我需要给用户展示如何配置"
  ↓
"直接复制我的配置文件，最准确"
  ↓
Ctrl+C, Ctrl+V
  ↓
"完成！提交吧"
  ↓
❌ 忘记替换成占位符
```

### 2. 配置文件的"安全假象"

```
开发者认为：
"config/application.yml 在 .gitignore 里"
  ↓
"所以配置很安全"
  ↓
❌ 但忽略了：文档中的示例代码会被提交！
```

### 3. 缺少自动检查

```
提交流程：
git add docs/qwen_integration.md
  ↓
git commit -m "Add Qwen integration docs"
  ↓
git push
  ↓
❌ 没有任何工具检测到 API key
```

---

## 📋 其他可能的泄露途径

除了文档文件，API keys 还可能在这些地方泄露：

### 1. 文档和 README
```
✅ docs/*.md - 示例配置
✅ README.md - 快速开始指南
✅ DEPLOYMENT.md - 部署说明
✅ CHANGELOG.md - 变更记录中的配置示例
```

### 2. 示例和模板文件
```
⚠️ config/*.yml.example - 如果从真实配置复制
⚠️ docker-compose.yml - 环境变量示例
⚠️ .env.example - 示例环境变量
```

### 3. 测试文件
```
⚠️ spec/fixtures/*.yml - 测试数据
⚠️ test/support/*.rb - 测试辅助代码
⚠️ spec/**/*_spec.rb - 测试中的真实 API 调用
```

### 4. 代码注释
```ruby
# TODO: 测试时使用 sk-432c950dfafe4824a011eeda98bcd377
# FIXME: API key 暂时硬编码
# DEBUG: curl -H "Authorization: Bearer sk-xxx..."
```

### 5. Commit 消息和 PR
```
git commit -m "Fix API config: QWEN_API_KEY=sk-xxx..."
PR 描述：使用 sk-xxx 测试后通过
Issue 评论：贴上了完整的配置文件截图
```

### 6. CI/CD 配置
```
⚠️ .github/workflows/*.yml - 工作流中的 secrets
⚠️ .gitlab-ci.yml - CI 变量
⚠️ Dockerfile - 构建参数
```

---

## 🛡️ 防止泄露的完整方案

### 1. 文档中使用占位符（已修复 ✅）

**❌ 之前（泄露）：**
```yaml
QWEN_API_KEY: 'sk-432c950dfafe4824a011eeda98bcd377'
```

**✅ 现在（安全）：**
```yaml
QWEN_API_KEY: 'sk-...'
# 或
QWEN_API_KEY: 'sk-YOUR_QWEN_API_KEY_HERE'
# 或
QWEN_API_KEY: '<your-actual-qwen-api-key>'
```

### 2. 安装 git-secrets

```bash
# macOS
brew install git-secrets

# Ubuntu/Debian
sudo apt-get install git-secrets

# 配置项目
cd your-repo
git secrets --install
git secrets --register-aws

# 添加自定义模式
git secrets --add 'sk-[a-zA-Z0-9]{30,}'
git secrets --add 'AIzaSy[a-zA-Z0-9_-]{33}'
git secrets --add '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'

# 扫描现有历史
git secrets --scan-history
```

### 3. Pre-commit Hook

创建 `.git/hooks/pre-commit`：

```bash
#!/bin/bash
echo "🔍 Scanning for API keys..."

# 定义危险模式
PATTERNS=(
    'sk-[a-zA-Z0-9]{30,}'
    'AIzaSy[a-zA-Z0-9_-]{33}'
    '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
)

# 检查暂存的文件
for pattern in "${PATTERNS[@]}"; do
    if git diff --cached | grep -qE "$pattern"; then
        echo "⚠️  ERROR: Found potential API key pattern: $pattern"
        echo "Please remove sensitive data before committing."
        exit 1
    fi
done

echo "✅ No API keys detected"
```

```bash
chmod +x .git/hooks/pre-commit
```

### 4. 提交前检查清单

在提交前运行：

```bash
# 1. 查看将要提交的内容
git diff --cached

# 2. 搜索潜在的 API key 模式
git diff --cached | grep -E '(sk-|AIzaSy|key.*:.*[a-zA-Z0-9]{30,})'

# 3. 特别检查文档文件
git diff --cached -- docs/ README.md

# 4. 检查环境变量赋值
git diff --cached | grep -E '(API_KEY|SECRET|PASSWORD).*=.*[^"]'
```

### 5. GitHub Secret Scanning（自动）

GitHub 会自动扫描推送的代码：
- 检测到常见的 API key 模式
- 发送邮件通知仓库所有者
- 某些服务商（如 GitHub tokens）会自动撤销

**但是：**
- ⚠️ 不是实时的，有延迟
- ⚠️ 不覆盖所有 API 格式
- ⚠️ 依然需要手动处理

---

## 🔍 检查你的仓库

### 快速扫描

```bash
# 1. 检查所有跟踪的文件
git ls-files | xargs grep -E '(sk-[a-zA-Z0-9]{30,}|AIzaSy)' 2>/dev/null

# 2. 检查文档目录
grep -r "sk-[a-zA-Z0-9]\{30,\}" docs/

# 3. 检查最近 20 次提交
git log -20 -p | grep -E "sk-[a-zA-Z0-9]{30,}"

# 4. 检查特定文件的历史
git log -p -- docs/qwen_integration.md | grep -E "sk-[a-zA-Z0-9]{30,}"

# 5. 检查所有分支
git log --all -p | grep -E "sk-[a-zA-Z0-9]{30,}" | head -20
```

### 深度扫描（使用 truffleHog）

```bash
# 安装
pip install trufflehog

# 扫描整个仓库历史
trufflehog git file://. --only-verified

# 扫描特定目录
trufflehog git file://. --include-paths docs/
```

---

## 📚 最佳实践总结

### ✅ 应该做

1. **文档中永远使用占位符**
   ```yaml
   API_KEY: 'xxx-...'
   API_KEY: '<your-key-here>'
   API_KEY: 'YOUR_ACTUAL_KEY'
   ```

2. **配置文件使用环境变量**
   ```yaml
   API_KEY: '<%= ENV.fetch("API_KEY", "") %>'
   ```

3. **提交前检查**
   ```bash
   git diff --cached
   git secrets --scan
   ```

4. **使用自动化工具**
   - git-secrets
   - pre-commit hooks
   - truffleHog
   - GitHub Secret Scanning

5. **Code Review 审查文档**
   - 特别注意 docs/, README.md
   - 检查代码块中的配置示例
   - 确认所有 keys 都是占位符

### ❌ 不应该做

1. **不要从真实配置复制到文档**
   ```
   ❌ 复制 config/application.yml 到文档
   ✅ 手动输入占位符
   ```

2. **不要在 commit 消息中包含敏感信息**
   ```
   ❌ git commit -m "Fix: API_KEY=sk-xxx"
   ✅ git commit -m "Fix: Update API configuration"
   ```

3. **不要依赖人工审查**
   ```
   ❌ "我会记得检查的"
   ✅ 使用自动化工具
   ```

4. **不要在注释中留下真实 keys**
   ```ruby
   ❌ # TODO: Use sk-xxx for testing
   ✅ # TODO: Configure API key via ENV
   ```

---

## 🎯 你的情况总结

### 问题根源

1. ✅ `config/application.yml` **设计是安全的**
   - 被 `.gitignore` 保护
   - 使用 `ENV.fetch()` 读取环境变量
   - 默认值都是空字符串

2. ❌ **文档文件是问题所在**
   - `docs/qwen_integration.md` 在提交 `6949870` 中包含真实 key
   - 文档文件不在 `.gitignore` 中
   - 开发者写文档时直接复制了真实配置

3. ⚠️ **命名规范（LLM_* vs QWEN_*）与泄露无关**
   - 这只是架构设计选择
   - 无论叫什么名字，都是从环境变量读取
   - 不影响安全性

### 当前状态

- ✅ 代码已修复（默认值改为空字符串）
- ✅ 文档已修复（使用占位符 `sk-...`）
- ⚠️ Git 历史仍有泄露（需要手动处理）
- ⚠️ 旧的 API keys 需要撤销

### 下一步行动

1. **立即撤销所有泄露的 API keys**（最优先）
2. **生成新的 API keys**
3. **清理 Git 历史或删除仓库重建**
4. **安装 git-secrets 防止未来泄露**

---

**记住：配置文件的设计没问题，问题出在文档中的示例代码！这是一个常见但容易被忽视的安全陷阱。**
