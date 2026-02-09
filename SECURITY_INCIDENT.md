# 🚨 API Key 泄露事件报告

## 泄露的 API Keys

以下 API keys 已经被提交到 Git 历史中：

1. **Qwen (阿里云)**: `sk-432c950dfafe4824a011eeda98bcd377` ⚠️ **已在 Git 历史中**
2. **DeepSeek**: `sk-69cfec2befca46ed80d5305ccab6c59d`
3. **Google Gemini**: `AIzaSyBSJ_bAQaegXG-V4NGyljLk6zlDwE6BMNc`
4. **Zhipu (智谱)**: `53afb275a7ef46139b5a7142b970f6df.FQmIwIa0bsKbzYXm`
5. **Doubao (豆包/字节)**: `f1cbd905-e1a5-41d7-b062-7b81641fccf8`

## 泄露位置

- **提交记录**: 
  - `d5c44c0` - "feat: add DeepSeek LLM provider support"
  - `6949870` - "feat: add multi-LLM provider support (Grok AI & Alibaba Qwen)"
- **文件**: `config/application.yml` (虽然已被 .gitignore，但之前的提交可能包含)

## ⚠️ 立即行动清单

### 1. 立即撤销所有 API Keys（最高优先级）

#### Qwen (阿里云)
- 登录：https://dashscope.console.aliyun.com/
- 找到 API Key 管理
- **立即删除或禁用** key: `sk-432c950dfafe4824a011eeda98bcd377`
- 生成新的 API key

#### DeepSeek
- 登录：https://platform.deepseek.com/
- API Keys 管理
- **立即撤销** key: `sk-69cfec2befca46ed80d5305ccab6c59d`
- 生成新 key

#### Google Gemini
- 登录：https://aistudio.google.com/apikey
- **立即删除** key: `AIzaSyBSJ_bAQaegXG-V4NGyljLk6zlDwE6BMNc`
- 创建新 key

#### Zhipu (智谱 GLM)
- 登录：https://open.bigmodel.cn/usercenter/apikeys
- **立即删除** key: `53afb275a7ef46139b5a7142b970f6df.FQmIwIa0bsKbzYXm`
- 生成新 key

#### Doubao (豆包/字节跳动)
- 登录：https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey
- **立即删除** key: `f1cbd905-e1a5-41d7-b062-7b81641fccf8`
- 生成新 key

### 2. 检查账单和使用记录

对每个平台：
- 检查最近的 API 调用记录
- 查看是否有异常流量
- 检查账单是否有未授权的费用
- 如果发现异常，立即联系客服

### 3. 清理 Git 历史（如果已推送到 GitHub）

⚠️ **警告：这会改写 Git 历史，需要强制推送**

```bash
# 方法 1: 使用 BFG Repo-Cleaner (推荐)
# 下载 BFG: https://rtyley.github.io/bfg-repo-cleaner/
java -jar bfg.jar --replace-text passwords.txt
git reflog expire --expire=now --all && git gc --prune=now --aggressive
git push --force

# 方法 2: 使用 git filter-repo (更彻底)
pip install git-filter-repo
git filter-repo --replace-text <(echo 'sk-432c950dfafe4824a011eeda98bcd377==>***REMOVED***')
git push --force --all
git push --force --tags

# 方法 3: 使用 git filter-branch (最后选择)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch config/application.yml" \
  --prune-empty --tag-name-filter cat -- --all
```

**⚠️ 注意事项：**
- 如果是公开仓库，即使清理历史，API keys 可能已被爬虫抓取
- 强制推送会影响所有协作者，需要通知他们重新 clone
- 最安全的做法：撤销所有 keys，然后创建新仓库

### 4. 更新生产环境配置

在你的部署环境中设置新的环境变量：

```bash
# 在服务器或部署平台设置
export QWEN_API_KEY="新的-qwen-key"
export DEEPSEEK_API_KEY="新的-deepseek-key"
export GEMINI_API_KEY="新的-gemini-key"
export ZHIPU_API_KEY="新的-zhipu-key"
export DOUBAO_API_KEY="新的-doubao-key"
```

### 5. 防止未来泄露

已完成的措施：
- ✅ `config/application.yml` 已在 `.gitignore` 中
- ✅ 已移除所有硬编码的 API keys
- ✅ 所有 keys 现在使用环境变量

建议添加的措施：
```bash
# 安装 git-secrets 防止意外提交
git clone https://github.com/awslabs/git-secrets
cd git-secrets
make install

# 在项目中设置
cd /path/to/your/repo
git secrets --install
git secrets --register-aws
git secrets --add 'sk-[a-zA-Z0-9]{32,}'
git secrets --add 'AIzaSy[a-zA-Z0-9_-]{33}'
```

## 时间线

1. **检测时间**: 刚才
2. **泄露时间**: 提交 `d5c44c0` 和 `6949870`
3. **修复时间**: 已完成代码修复
4. **待办**: 撤销 API keys 和清理 Git 历史

## 后续行动

- [ ] 立即撤销所有 5 个 API keys
- [ ] 生成新的 API keys
- [ ] 检查所有平台的使用记录和账单
- [ ] 决定是否需要清理 Git 历史
- [ ] 如果是公开仓库，考虑创建新仓库
- [ ] 设置 git-secrets 防止未来泄露
- [ ] 通知团队成员此事件

## 联系人

如果发现未授权使用，立即联系：
- Qwen: https://help.aliyun.com/
- DeepSeek: support@deepseek.com
- Google: https://support.google.com/cloud/
- Zhipu: https://open.bigmodel.cn/
- Doubao: https://www.volcengine.com/docs/6459/105806

---
**创建时间**: $(date)
**严重程度**: 🔴 高危
**状态**: 代码已修复，等待撤销 keys
