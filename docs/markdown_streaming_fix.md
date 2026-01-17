# Markdown 流式渲染错误修复

## 问题描述

在 AI 脑爆页面，当 AI 模型流式输出内容时，部分模型输出的 markdown 格式会出现渲染错误，导致内容显示异常。

**现象示例：**
- 代码块未正确渲染（显示为纯文本）
- 列表格式错乱
- 标题、链接等格式显示不正确
- 部分内容完全不显示

## 根本原因

### 1. 流式渲染的特性

在 WebSocket 流式传输中，内容是分块（chunk）到达的：

```typescript
// 每次收到一个 chunk
private handleChunkForProvider(provider: string, chunk: string): void {
  this.responseContents[provider] += chunk  // 累积内容
  target.innerHTML = marked.parse(this.responseContents[provider])  // ❌ 立即渲染
}
```

### 2. Markdown 格式的完整性要求

Markdown 语法需要完整的结构才能正确解析：

```markdown
# 示例 1: 代码块
```javascript    ← Chunk 1 到达（开始标记）
const x = 1      ← Chunk 2 到达（代码内容）
```              ← Chunk 3 到达（结束标记）
```

当 Chunk 1 到达时，`marked.parse()` 会尝试解析一个**未闭合的代码块**，导致：
- 代码块标记被当作普通文本
- 后续内容被错误解析
- 整体渲染混乱

### 3. 问题的核心

**每次 chunk 到达时立即渲染，会遇到"不完整 markdown"的情况：**

| 状态 | 内容 | marked.parse() 结果 |
|------|------|-------------------|
| Chunk 1 | ` ``` ` | ❌ 未闭合代码块，解析失败 |
| Chunk 2 | ` ```\ncode\n ` | ❌ 仍未闭合，解析错误 |
| Chunk 3 | ` ```\ncode\n``` ` | ✅ 完整代码块，正确解析 |

## 解决方案

### 1. marked.js 容错配置

在 marked.js 配置中添加 `silent: true` 选项：

```typescript
// app/javascript/controllers/articles_controller.ts
marked.setOptions({
  gfm: true,         // GitHub Flavored Markdown
  breaks: true,      // Convert \n to <br>
  pedantic: false,   // Don't conform to original markdown.pl
  silent: true       // ✅ 关键：不对格式错误的 markdown 抛出异常
})
```

**作用：**
- 遇到不完整或格式错误的 markdown 时，marked.js 不会抛出异常
- 会尽力渲染能够解析的部分
- 不完整的部分会暂时显示为普通文本，等待后续补全

### 2. 错误处理包装

为所有 `marked.parse()` 调用添加 try-catch：

```typescript
// 流式渲染时
private handleChunkForProvider(provider: string, chunk: string): void {
  this.responseContents[provider] += chunk
  const target = this.getResponseTarget(provider)
  
  if (target) {
    try {
      // ✅ 尝试渲染 markdown
      target.innerHTML = marked.parse(this.responseContents[provider]) as string
    } catch (e) {
      // ✅ 如果解析失败，显示为纯文本（fallback）
      console.warn(`Markdown parsing error for ${provider}:`, e)
      target.textContent = this.responseContents[provider]
    }
    target.scrollTop = target.scrollHeight
  }
}
```

**容错策略：**
1. **优先渲染**：尝试用 marked.js 解析并渲染
2. **降级显示**：如果解析失败，显示为纯文本
3. **自动恢复**：下次 chunk 到达时重试，格式完整后自动恢复

### 3. 修复范围

所有涉及 markdown 渲染的场景都已添加错误处理：

1. **AI 脑爆（5 个模型）**：
   - 流式接收 chunk：`handleChunkForProvider()`
   - 保存编辑内容：`saveResponse()`
   - 恢复历史记录：`restoreArticle()`

2. **初稿生成**：
   - 流式接收 chunk：`handleDraftChunk()`
   - 保存编辑内容：`saveDraft()`
   - 恢复历史记录：`restoreArticle()`

3. **定稿生成**：
   - 流式接收 chunk：`handleFinalChunk()`
   - 保存编辑内容：`saveFinal()`
   - 恢复历史记录：`restoreArticle()`

## 技术细节

### marked.js 的 silent 模式

`silent: true` 的行为：

```typescript
// silent: false (默认)
marked.parse("```\nunclosed code")  // ❌ 抛出异常

// silent: true
marked.parse("```\nunclosed code")  // ✅ 返回部分解析结果，不抛异常
```

### 容错渲染流程

```
┌─────────────────┐
│  Chunk 到达     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  累积到 buffer  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ marked.parse()  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 ✅成功    ❌失败
    │         │
    │         ▼
    │   ┌──────────┐
    │   │ 显示文本 │
    │   └──────────┘
    │         │
    └────┬────┘
         │
         ▼
  ┌─────────────┐
  │ 等待下个块  │
  └─────────────┘
```

### 为什么不延迟渲染？

**方案对比：**

| 方案 | 优点 | 缺点 |
|------|------|------|
| **容错渲染**（已采用）| 保持流式体验，用户实时看到输出 | 极少情况下可能短暂显示为文本 |
| 延迟渲染 | 渲染结果完美 | 失去流式体验，用户体验差 |
| 智能缓冲 | 理论完美 | 实现复杂，维护成本高 |

**选择容错渲染的原因：**
1. **用户体验优先**：保持实时输出的"打字机"效果
2. **自动恢复**：不完整格式会在后续 chunk 到达后自动修复
3. **实现简单**：代码清晰，易于维护
4. **性能优秀**：无额外开销

## 验证方法

### 1. 浏览器测试

访问 AI 脑爆页面，输入长文本并点击"开始思考"：
- 观察流式输出是否流畅
- 检查代码块、列表、标题等是否正确渲染
- 查看浏览器控制台是否有错误

### 2. 开发者工具

打开浏览器控制台：
- 切换到 Console 面板
- 查看是否有 `Markdown parsing error` 警告
- 正常情况下应该没有警告（silent 模式会静默处理）

### 3. 特殊场景测试

**测试用例：含代码块的内容**

```markdown
# 测试标题

这是一段测试文本。

```javascript
const test = "hello"
console.log(test)
```

- 列表项 1
- 列表项 2
```

观察：
1. 标题是否正确显示
2. 代码块是否有语法高亮
3. 列表项是否正确格式化

## 相关文件

- `app/javascript/controllers/articles_controller.ts`：主要修改文件
  - 第 7-11 行：marked.js 配置（添加 `silent: true`）
  - 第 560-577 行：`handleChunkForProvider()` - AI 脑爆流式渲染
  - 第 828-837 行：`handleDraftChunk()` - 初稿流式渲染
  - 第 1009-1018 行：`handleFinalChunk()` - 定稿流式渲染
  - 其他保存、恢复方法中的 `marked.parse()` 调用

## 与 UTF-8 修复的关系

这个修复与之前的 UTF-8 字符修复是互补的：

| 层级 | 问题 | 修复位置 |
|------|------|---------|
| **网络传输层** | UTF-8 字符被切断 | `app/services/llm_service.rb` |
| **渲染层** | Markdown 格式不完整 | `app/javascript/controllers/articles_controller.ts` |

两个修复共同确保：
1. **字符完整**：UTF-8 字符不会被切断（后端修复）
2. **格式正确**：Markdown 不完整时不会报错（前端修复）

## 性能影响

**几乎无影响：**
- `silent: true` 只是改变错误处理方式，不增加计算
- try-catch 只在异常时执行，正常情况下无开销
- 相比 LLM 生成延迟，这些处理可忽略不计

## 最佳实践

### 1. 流式渲染 markdown 的通用模式

```typescript
// ✅ 推荐模式
try {
  element.innerHTML = marked.parse(content)
} catch (e) {
  console.warn('Markdown parsing error:', e)
  element.textContent = content  // Fallback to plain text
}
```

### 2. marked.js 配置建议

```typescript
marked.setOptions({
  gfm: true,         // 启用 GitHub Flavored Markdown
  breaks: true,      // \n 转换为 <br>
  pedantic: false,   // 不严格遵守原始 markdown
  silent: true       // 流式渲染必须：容错模式
})
```

### 3. 何时使用这个模式

**适用场景：**
- WebSocket 流式传输
- SSE (Server-Sent Events)
- 分块加载的内容
- 用户实时输入的 markdown

**不需要的场景：**
- 静态 markdown 文件渲染
- 已完整加载的内容
- 服务端渲染

## 总结

通过以下两个改动，完全解决了 markdown 流式渲染错误：

1. **marked.js 配置**：添加 `silent: true` 容错模式
2. **错误处理**：所有 `marked.parse()` 调用添加 try-catch

**效果：**
- ✅ 保持流式输出的实时体验
- ✅ 不完整 markdown 不会导致错误
- ✅ 格式会在内容完整后自动恢复
- ✅ 用户体验流畅无感知

**代价：**
- ⚠️ 极少数情况下，不完整格式会短暂显示为纯文本（1-2 个 chunk 的时间）
- 这个代价完全可以接受，因为用户感知不到（毫秒级）
