# 为什么旧提交会出现 API Key 泄露？完整分析

## 🔍 问题发现

在提交 `6949870` (2026-01-13 01:17) 中，Qwen API key `sk-432c950dfafe4824a011eeda98bcd377` 被泄露了。

## 🎯 根本原因

### 不是 `config/application.yml` 被提交了！

很多人会误以为是 `config/application.yml` 被提交到 Git，但**实际上不是**：

```bash
# 验证：config/application.yml 从未被提交过
$ git log --all --oneline --follow -- config/application.yml
# （没有输出，说明这个文件从未被提交）

# config/application.yml 一直被 .gitignore 保护
$ git check-ignore -v config/application.yml
.gitignore:47:/config/application.yml	config/application.yml
```

### ✅ 真正的原因：文档文件中的示例代码

API key 是在**文档文件**中被提交的！

## 📝 泄露路径分析

### 提交 6949870 的完整故事

**提交信息：**
```
commit 6949870d6347658a93d404aa12eacde0a44effde
Date: Tue Jan 13 01:17:49 2026 -0500

feat: add multi-LLM provider support (Grok AI & Alibaba Qwen)

- Add llm_provider field to Persona model with validation
- Implement dynamic LLM configuration in ArticlesChannel
- Add provider selection UI in articles index view
- Update LlmStreamJob to support multiple providers
- Add Qwen integration documentation  ← 关键：添加了文档
- Update demo page to reflect multi-provider support
```

**修改的文件：**
```
9 files changed, 348 insertions(+), 8 deletions(-)

 app/channels/articles_channel.rb
 app/javascript/controllers/articles_controller.ts
 app/jobs/llm_stream_job.rb
 app/models/persona.rb
 app/views/articles/index.html.erb
 app/views/shared/demo.html.erb
 db/migrate/20260113061248_add_llm_provider_to_personas.rb
 db/schema.rb
 docs/qwen_integration.md  ← 关键：新增的文档文件
```

### 🚨 泄露位置：`docs/qwen_integration.md`

这个文档文件中包含了配置示例：

```markdown
### 环境变量配置 (`config/application.yml`)

```yaml
# Qwen (Alibaba Cloud) Configuration
QWEN_BASE_URL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'
QWEN_API_KEY: 'sk-432c950dfafe4824a011eeda98bcd377'  ← 真实的 API key！
QWEN_MODEL: 'qwen3-max'
# Qwen Configuration end
```
```

**问题：**
- ✅ `config/application.yml` 本身被 `.gitignore` 保护，没有被提交
- ❌ 但是文档中的**示例代码**使用了真实的 API key
- ❌ 文档文件 `docs/qwen_integration.md` 没有被 `.gitignore` 忽略
- ❌ 所以真实的 API key 通过文档被提交到 Git

## 🔄 完整的泄露流程

```
1. 开发者在本地配置 config/application.yml
   ↓
   QWEN_API_KEY: 'sk-432c950dfafe4824a011eeda98bcd377'
   
2. 开发功能，测试通过 ✅

3. 准备提交代码，创建文档 docs/qwen_integration.md
   ↓
   写文档时，从 config/application.yml 复制配置作为示例
   ↓
   ⚠️ 忘记替换为占位符！直接复制了真实的 API key

4. Git 提交
   ↓
   config/application.yml ← 被 .gitignore 阻止 ✅
   docs/qwen_integration.md ← 没有被阻止，包含真实 key ❌
   
5. 推送到 GitHub
   ↓
   docs/qwen_integration.md 上传成功
   ↓
   🚨 API key 公开暴露！
```

## 📊 证据链

### 1. 提交记录显示文档被添加

```bash
$ git show 6949870 --stat
 docs/qwen_integration.md | 173 +++++++++++++++++++++
```

### 2. 文档中包含真实 API key

```bash
$ git show 6949870:docs/qwen_integration.md | grep -A3 'QWEN_API_KEY'
QWEN_API_KEY: 'sk-432c950dfafe4824a011eeda98bcd377'
QWEN_MODEL: 'qwen3-max'
```

### 3. config/application.yml 本身从未被提交

```bash
$ git log --all --follow -- config/application.yml
# （无输出）
```

## 🤔 为什么会犯这个错误？

### 常见的开发场景

1. **写文档时图方便**
   ```
   开发者想："我直接从配置文件复制粘贴，省得再打一遍"
   → 复制了 config/application.yml 的内容
   → 忘记替换成占位符
   ```

2. **测试环境和文档混淆**
   ```
   本地测试用的是真实 API key
   → 文档示例也用了相同的内容
   → 没有意识到文档会被提交到 Git
   ```

3. **缺少审查流程**
   ```
   提交前没有运行 git diff
   → 没有检查敏感信息
   → 直接 git add . && git commit && git push
   ```

## 🛡️ 如何避免？

### 1. 文档中永远使用占位符

**❌ 错误：**
```yaml
QWEN_API_KEY: 'sk-432c950dfafe4824a011eeda98bcd377'
```

**✅ 正确：**
```yaml
QWEN_API_KEY: 'sk-YOUR_QWEN_API_KEY_HERE'
# 或
QWEN_API_KEY: 'sk-...'
# 或
QWEN_API_KEY: '<your-actual-api-key>'
```

### 2. 提交前检查

```bash
# 提交前运行
git diff --cached

# 搜索可能的 API key 模式
git diff --cached | grep -E '(sk-[a-zA-Z0-9]{30,}|AIzaSy)'
```

### 3. 使用 git-secrets

```bash
# 安装
brew install git-secrets  # Mac
sudo apt-get install git-secrets  # Ubuntu

# 配置
cd your-repo
git secrets --install
git secrets --add 'sk-[a-zA-Z0-9]{30,}'
git secrets --add 'AIzaSy[a-zA-Z0-9_-]{33}'

# 扫描
git secrets --scan
git secrets --scan-history
```

### 4. Pre-commit hooks

创建 `.git/hooks/pre-commit`：

```bash
#!/bin/bash

# 检查暂存的文件中是否有 API key 模式
if git diff --cached --name-only | xargs grep -E '(sk-[a-zA-Z0-9]{30,}|AIzaSy[a-zA-Z0-9_-]{33})' 2>/dev/null; then
    echo "⚠️  Error: Found potential API keys in staged files!"
    echo "Please remove them before committing."
    exit 1
fi
```

### 5. 敏感文件清单

应该被 `.gitignore` 的文件：
- `config/application.yml` ✅ 已保护
- `config/database.yml` ✅ 已保护
- `config/master.key` ✅ 已保护
- `.env` ✅ 已保护
- `.env.local` ✅ 已保护

**但是**文档文件通常不在 `.gitignore` 中，所以要手动检查！

## 📋 其他可能的泄露点

### 1. 文档文件
- ✅ `docs/*.md` - 示例代码中的 API keys
- ✅ `README.md` - 快速开始中的示例
- ✅ `DEPLOYMENT.md` - 部署说明中的配置

### 2. 测试文件
- ⚠️ `spec/**/*_spec.rb` - 测试数据中的真实 keys
- ⚠️ `test/fixtures/*.yml` - Fixture 中的真实数据

### 3. 示例文件
- ⚠️ `*.example` 文件 - 可能从真实配置复制而来

### 4. 注释和 TODO
- ⚠️ 代码注释中的真实 API keys
- ⚠️ `# TODO: 使用真实 key sk-xxxxx 测试`

### 5. Git commit messages
- ⚠️ Commit 消息中粘贴了配置
- ⚠️ PR 描述中包含调试信息

## 🔍 检查你的仓库

运行这些命令检查是否有泄露：

```bash
# 1. 检查所有文档文件
grep -r "sk-[a-zA-Z0-9]\{30,\}" docs/
grep -r "AIzaSy[a-zA-Z0-9_-]\{33\}" docs/

# 2. 检查 README
grep -E "(sk-|AIzaSy)" README.md

# 3. 检查整个 Git 历史
git log --all -p | grep -E "(sk-[a-zA-Z0-9]{30,}|AIzaSy)" | head -20

# 4. 检查所有跟踪的文件
git ls-files | xargs grep -E "(sk-[a-zA-Z0-9]{30,}|AIzaSy)"

# 5. 检查最近 10 次提交
git log -10 --all -p | grep -E "sk-[a-zA-Z0-9]{30,}"
```

## 📚 经验教训

### 1. `.gitignore` 只保护配置文件本身

```
✅ config/application.yml (被保护)
❌ docs/qwen_integration.md (不被保护)
   └── 内容：QWEN_API_KEY: 'sk-...'  ← 泄露！
```

### 2. 文档是高风险区域

**为什么文档容易泄露：**
- 开发者写文档时图方便，直接复制配置
- 文档需要展示"真实"的示例
- 审查时容易忽略文档中的代码块
- 文档通常在提交的最后才写，容易匆忙

### 3. 人工审查不可靠

**依赖工具，不依赖人：**
- ✅ 使用 `git-secrets` 自动扫描
- ✅ 使用 pre-commit hooks 拦截
- ✅ CI/CD 中添加安全扫描
- ❌ 不要依赖开发者"记得检查"

## 🎯 总结

### 问题的本质

**不是配置文件被提交了，而是文档中的示例代码使用了真实的 API key。**

### 泄露的真实路径

```
真实 API key
  ↓
写在 config/application.yml（被 .gitignore 保护）✅
  ↓
复制到 docs/qwen_integration.md（文档文件）❌
  ↓
提交到 Git → 推送到 GitHub
  ↓
公开暴露 🚨
```

### 核心教训

1. **文档中永远使用占位符**
2. **提交前检查 `git diff`**
3. **使用自动化工具（git-secrets）**
4. **Code Review 时审查文档文件**
5. **定期扫描整个仓库和历史**

---

**再次强调：`config/application.yml` 本身的设计是安全的，问题出在文档文件中的示例代码！**
