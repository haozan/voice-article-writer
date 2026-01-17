# Markdown 格式规范强制要求

## 问题背景

部分 AI 模型（特别是 Grok）在输出 Markdown 时不遵守标准语法，导致渲染失败：

### 常见问题示例

1. **标题缺少空格**：`###3.3 AI编程` → 无法渲染为标题
2. **列表缺少空格**：`-项目` → 无法渲染为列表
3. **表格行不完整**：`|列1|列2` → 缺少结尾的 `|`，表格显示异常
4. **字符错位**：`202行动6` → 应为 `2026行动`（流式传输中 UTF-8 字符边界问题）

## 解决方案

采用**双重防御策略**：

### 1. 前端预处理（防御层）✅

**位置**：`app/javascript/controllers/articles_controller.ts`

**实现**：`preprocessMarkdown()` 函数，在所有 `marked.parse()` 调用前执行

**修复规则**：
```typescript
function preprocessMarkdown(markdown: string): string {
  let processed = markdown
    // 标题修复：###Text → ### Text
    .replace(/^(#{1,6})([^#\s])/gm, '$1 $2')
    // 列表修复：-Text → - Text
    .replace(/^([*+-])([^\s])/gm, '$1 $2')
    // 数字列表修复：1.Text → 1. Text
    .replace(/^(\d+\.)([^\s])/gm, '$1 $2')
  
  // 表格修复：|col1|col2 → |col1|col2|
  processed = processed.replace(/^(\|[^\n]*[^|\s])$/gm, '$1|')
  
  return processed
}
```

**应用位置**（9处）：
- AI 脑爆流式输出 + 编辑保存（Grok、Qwen、DeepSeek、Gemini、智谱）
- 初稿流式输出 + 编辑保存
- 定稿流式输出 + 编辑保存
- 历史恢复（脑爆/初稿/定稿各1处）

### 2. 后端 Prompt 强制要求（源头控制）✅

**位置**：
- `app/jobs/llm_stream_job.rb` - 所有模型的 system prompt
- `app/channels/articles_channel.rb` - draft/final/variant prompts

**要求内容**：
```
⚠️ 【Markdown 格式规范 - 必须严格遵守】
1. 标题：# 和 ## 之后必须有空格（正确：`### 标题`，错误：`###标题`）
2. 列表：- 和 * 之后必须有空格（正确：`- 项目`，错误：`-项目`）
3. 数字列表：数字和点之后必须有空格（正确：`1. 项目`，错误：`1.项目`）
4. 表格：每行必须以 | 开头和结尾（正确：`|列1|列2|`，错误：`|列1|列2`）
5. 表格分隔符：必须使用 |---| 格式（正确：`|---|---|`）
6. 加粗：**文字** 前后不要紧贴其他字符（正确：`这是 **加粗** 文字`）

✅ 输出前自查：
- 所有标题、列表、表格都符合标准 Markdown 语法
- 特别注意中英文混排时的空格问题
- 确保表格每行都完整闭合
```

**应用模型**：
- **AI 脑爆阶段**：Grok、Qwen、DeepSeek、Gemini、智谱、豆包、ChatGPT（7个模型）
- **初稿生成**：使用选中模型的配置
- **定稿润色**：Pinker、罗振宇、王小波风格（3种风格）
- **内容变体**：小绿书、小红书风格（2种风格）

## 修改的文件

### 1. `app/javascript/controllers/articles_controller.ts`

**变更**：+36 行，-10 行

**内容**：
- 新增 `preprocessMarkdown()` 函数（line 21-37）
- 更新 9 处 `marked.parse()` 调用

### 2. `app/jobs/llm_stream_job.rb`

**变更**：+24 行

**内容**：
- 在 `build_system_prompt()` 方法中添加 `markdown_requirements` 变量
- 将其插入到所有 7 个模型的 system prompt 中

### 3. `app/channels/articles_channel.rb`

**变更**：+47 行

**内容**：
- `generate_draft()` 方法的 `draft_prompt` 中添加 markdown 规范
- `generate_variant()` 方法的 `variant_prompt` 中添加 markdown 规范
- `get_style_prompt()` 方法为 3 种风格（Pinker、罗振宇、王小波）添加 markdown 规范

## 技术细节

### 正则表达式说明

| 规则 | 正则表达式 | 说明 |
|------|-----------|------|
| 标题修复 | `/^(#{1,6})([^#\s])/gm` | 匹配行首1-6个#，后面紧跟非#和非空格字符 |
| 列表修复 | `/^([*+-])([^\s])/gm` | 匹配行首的 `-`、`*`、`+`，后面紧跟非空格字符 |
| 数字列表 | `/^(\d+\.)([^\s])/gm` | 匹配行首的数字+点，后面紧跟非空格字符 |
| 表格修复 | `/^(\|[^\n]*[^|\s])$/gm` | 匹配以 `|` 开头但不以 `|` 结尾的行 |

**修饰符说明**：
- `g` = global，全局匹配
- `m` = multiline，`^` 和 `$` 匹配每行的开始和结束

### UTF-8 字符边界问题

**后端处理**（已有）：`app/services/llm_service.rb`

```ruby
buffer = "".force_encoding('UTF-8')
response.read_body do |chunk|
  chunk = chunk.force_encoding('UTF-8')
  buffer << chunk
  
  # 只在 buffer 是有效 UTF-8 时才处理
  unless buffer.valid_encoding?
    next  # 等待更多数据完成 UTF-8 序列
  end
  # ... 处理完整的数据
end
```

这确保了多字节字符（如中文）不会在边界被切断。

## 测试验证

### 测试页面

创建了 `tmp/test_markdown_preprocessing.html` 用于验证预处理效果：

1. 在浏览器中打开该文件
2. 输入问题 markdown（如 `###标题`、`|列1|列2`）
3. 查看预处理后的结果和最终渲染效果

### 实际测试步骤

1. 启动项目：`bin/dev`
2. 访问 `/write` 页面
3. 输入文本并选择 Grok 进行 AI 脑爆
4. 观察输出的 markdown 是否正确渲染：
   - 标题是否正确显示
   - 表格是否完整
   - 列表是否正确排版

### 预期效果

**之前**：
```
###3.3 AI编程  → 不渲染为标题，显示为普通文本
|列1|列2       → 表格显示异常
-项目          → 不渲染为列表
```

**现在**：
```
### 3.3 AI编程 → ✅ 正确渲染为 H3 标题
|列1|列2|      → ✅ 正确渲染为表格
- 项目         → ✅ 正确渲染为列表
```

## 性能影响

- **前端预处理**：3-5 个正则表达式替换，O(n) 时间复杂度，性能影响可忽略
- **后端 Prompt**：增加约 200 字符的 system prompt，对 API 调用成本影响极小
- **实时流式输出**：无性能影响，预处理在渲染前执行

## 未来改进

如果问题仍然出现，可以考虑：

1. **更严格的表格验证**：检查表格行的列数是否一致
2. **自动修复表格分隔符**：`|---|--` → `|---|---|`
3. **后处理 hook**：在 ActionCable 广播前验证 markdown 语法
4. **模型微调**：收集错误案例，对特定模型进行 fine-tuning

## 相关文档

- [UTF-8 流式响应修复](./utf8_streaming_fix.md) - 字符边界问题的后端修复
- [Markdown 流式渲染修复](./markdown_streaming_fix.md) - 不完整 markdown 的前端处理

## 总结

通过**前端防御 + 后端源头控制**的双重策略，从根本上解决了 AI 模型输出 markdown 格式不规范的问题：

1. ✅ 后端 prompt 明确要求所有模型遵守标准 markdown 语法
2. ✅ 前端预处理自动修复常见格式错误
3. ✅ 覆盖所有生成环节（AI脑爆、初稿、定稿、变体）
4. ✅ 所有 7 个 AI 模型统一规范
5. ✅ 编译成功，无语法错误

---

**最后更新**：2025-01-17  
**影响范围**：所有 AI 生成内容的 markdown 渲染  
**状态**：✅ 已部署生产环境
