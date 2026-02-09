# 配置设计安全分析报告

## 问题：这个设计会导致 API 暴露吗？

**答案：✅ 不会，设计是安全的！**

## 安全机制分析

### 1. 文件保护机制

#### ✅ `config/application.yml` - 被 .gitignore 保护
```bash
# 验证结果
$ git check-ignore -v config/application.yml
.gitignore:47:/config/application.yml    config/application.yml
```

**状态：**
- ✅ 在 `.gitignore` 第 47 行
- ✅ 永远不会被提交到 Git
- ✅ 不会出现在 GitHub 上

#### ✅ `config/application.yml.example` - 公开的示例文件
```bash
$ git ls-files | grep application.yml
config/application.yml.example
```

**内容对比：**

| 文件 | API Key 默认值 | 是否在 Git 中 | 安全性 |
|------|---------------|--------------|--------|
| `application.yml` | `""` (空字符串) | ❌ 不在 | ✅ 安全 |
| `application.yml.example` | `""` (空字符串) | ✅ 在 | ✅ 安全 |

**关键对比：**

```yaml
# application.yml (本地文件，不在 Git)
LLM_API_KEY: '<%= ENV.fetch("CLACKY_LLM_API_KEY", "") %>'
QWEN_API_KEY_OPTIONAL: '<%= ENV.fetch("QWEN_API_KEY", "") %>'

# application.yml.example (Git 中的示例，公开)
LLM_API_KEY: '<%= ENV.fetch("CLACKY_LLM_API_KEY", "") %>'
QWEN_API_KEY_OPTIONAL: '<%= ENV.fetch("QWEN_API_KEY", "") %>'
```

两者都是空字符串 `""`，没有硬编码的 API keys！

### 2. 配置层级设计

```
环境变量（最高优先级，运行时注入）
    ↓
ENV.fetch("CLACKY_LLM_API_KEY", "")  ← 从环境变量读取
    ↓
config/application.yml  ← 模板文件，使用 ERB 语法
    ↓
Rails.application.config  ← 运行时配置
    ↓
应用代码  ← ENV.fetch('LLM_API_KEY')
```

**安全点：**
1. ✅ 真实 API keys 只存在于环境变量中
2. ✅ `application.yml` 只是模板，使用 `ENV.fetch()` 读取
3. ✅ 代码中使用 `ENV.fetch()` 而不是硬编码
4. ✅ 默认值都是空字符串 `""`

### 3. 命名规范的安全含义

#### 设计模式

```yaml
# 模式 1: CLACKY_* 前缀（平台管理）
LLM_API_KEY: '<%= ENV.fetch("CLACKY_LLM_API_KEY", "") %>'
# ↑ CLACKY_ 前缀表示由 Clacky 平台自动注入
# ↑ 用户不需要手动配置

# 模式 2: 直接环境变量名 + _OPTIONAL 后缀（用户自行配置）
QWEN_API_KEY_OPTIONAL: '<%= ENV.fetch("QWEN_API_KEY", "") %>'
# ↑ 用户需要手动设置环境变量 QWEN_API_KEY
# ↑ _OPTIONAL 表示可选，生产环境不强制检查
```

#### 为什么 Grok 用 `LLM_*` 而不是 `GROK_*`？

**原因：**
1. **平台集成**：Clacky 平台统一管理 `CLACKY_LLM_*` 变量
2. **默认模型**：Grok 是主力模型，使用通用名称
3. **向后兼容**：老代码不需要改动
4. **简化配置**：用户只需配置一套 `LLM_*` 即可运行

**安全性：**
- ✅ 无论叫 `LLM_*` 还是 `GROK_*`，都不会暴露
- ✅ 因为都是通过 `ENV.fetch()` 读取环境变量
- ✅ `application.yml` 本身不包含真实 keys

### 4. 代码中的使用方式

```ruby
# app/channels/articles_channel.rb:813-817
when 'grok'
  {
    base_url: ENV.fetch('LLM_BASE_URL'),     # ← 从环境变量读取
    api_key: ENV.fetch('LLM_API_KEY'),       # ← 从环境变量读取
    model: ENV.fetch('LLM_MODEL')            # ← 从环境变量读取
  }
```

**安全点：**
- ✅ 代码中使用 `ENV.fetch()`，不是硬编码
- ✅ 运行时从环境变量读取
- ✅ 环境变量由部署平台注入，不在代码中

### 5. 之前的泄露原因分析

**❌ 之前为什么泄露？**

```yaml
# 错误的配置（已修复）
QWEN_API_KEY_OPTIONAL: '<%= ENV.fetch("QWEN_API_KEY", "sk-432c950dfafe4824a011eeda98bcd377") %>'
#                                                      ↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑↑
#                                                      这里硬编码了真实的 API key 作为默认值！
```

**✅ 现在的配置（安全）**

```yaml
# 正确的配置（当前）
QWEN_API_KEY_OPTIONAL: '<%= ENV.fetch("QWEN_API_KEY", "") %>'
#                                                      ↑↑
#                                                      空字符串，安全！
```

### 6. 安全检查清单

| 检查项 | 状态 | 说明 |
|--------|------|------|
| `application.yml` 在 `.gitignore` | ✅ | 第 47 行 |
| `application.yml` 不在 Git 历史 | ⚠️ | 曾经被提交过（已修复） |
| 默认值都是空字符串 | ✅ | 所有 `_API_KEY` 的默认值都是 `""` |
| 使用 `ENV.fetch()` 读取 | ✅ | 所有配置都从环境变量读取 |
| 代码中无硬编码 keys | ✅ | 所有代码使用 `ENV.fetch()` |
| `.example` 文件无真实 keys | ✅ | 示例文件都是空字符串 |

## 结论

### ✅ 当前设计是安全的

**原因：**
1. **文件保护**：`application.yml` 被 `.gitignore` 排除
2. **模板化**：使用 ERB `<%= ENV.fetch() %>` 语法
3. **无硬编码**：所有默认值都是空字符串 `""`
4. **运行时注入**：真实 keys 通过环境变量注入
5. **公开文件安全**：`.example` 文件不含真实 keys

### ⚠️ 之前的问题

**已修复的漏洞：**
- Git 历史中有硬编码的 API keys（需要清理历史或删除仓库）
- `application.yml` 中的默认值曾经是真实 keys

**当前状态：**
- ✅ 代码已修复
- ⚠️ Git 历史仍有泄露（需要手动处理）

## 建议

### 立即行动（如果还没做）

1. **撤销所有泄露的 API keys**（最优先）
2. **清理 Git 历史或删除仓库**
3. **生成新的 API keys**
4. **通过环境变量配置新 keys**

### 长期最佳实践

1. **永远不要在代码中硬编码敏感信息**
2. **默认值使用空字符串或占位符**
3. **使用 `ENV.fetch()` 强制要求环境变量**
4. **定期使用 `git secrets` 扫描**
5. **Code Review 时检查敏感信息**

## 验证命令

```bash
# 1. 确认 application.yml 被忽略
git check-ignore -v config/application.yml

# 2. 确认没有硬编码的 keys
grep -r "sk-[a-zA-Z0-9]\{30,\}" config/ --exclude-dir=.git
grep -r "AIzaSy[a-zA-Z0-9_-]\{33\}" config/ --exclude-dir=.git

# 3. 确认只有示例文件在 Git 中
git ls-files | grep application.yml

# 4. 扫描整个项目（排除 node_modules）
grep -r "sk-[a-zA-Z0-9]\{30,\}" . --exclude-dir=node_modules --exclude-dir=.git
```

---

**总结：设计本身是安全的，之前的泄露是因为在默认值中硬编码了真实 keys，现在已经修复。命名规范（LLM_* vs QWEN_*）与安全性无关，只是架构设计的选择。**
