# Step 5: 爆款标题生成功能

## 功能概述

Step 5 是写作流程的最后一步，在完成定稿（Step 4）后自动显示。用户可以选择不同的标题风格来生成吸引人的标题。

## 使用方式

### 1. 新文章流程

1. **完成 Step 1-4**：输入内容 → AI 脑爆 → 生成初稿 → 生成定稿
2. **定稿完成后**：页面会自动滚动到 Step 5 标题生成部分
3. **选择标题风格**：
   - **迷蒙体**：情绪共鸣、制造对比、身份代入、悬念设置的爆款标题风格
   - **普通风格**：简洁、准确、有吸引力的常规标题风格
4. **点击风格按钮**：AI 会根据定稿内容实时流式生成标题
5. **编辑标题**：生成的标题可以在文本框中直接编辑
6. **保存或复制**：
   - 点击「保存标题」按钮将标题保存到数据库
   - 点击「复制标题」按钮将标题复制到剪贴板

### 2. 从历史文章继续写作

**问题场景**：当您从历史文章列表进入「继续写作」，如果文章已完成定稿，如何生成标题？

**解决方案**：

1. **打开历史文章**：
   - 点击顶部导航栏的「开始写作」按钮
   - 点击「历史文章」图标打开侧边栏
   - 选择一篇已完成定稿的文章
   - 点击文章卡片进入详情页

2. **进入继续写作**：
   - 在文章详情页点击「继续写作」按钮
   - 或直接从历史列表中的文章卡片点击「继续写作」

3. **自动显示 Step 5**：
   - 系统会自动检测文章是否已有定稿内容
   - 如果有定稿，Step 5 标题生成部分会**自动显示**
   - 页面会自动滚动到 Step 5 部分

4. **如果已有标题**：
   - 标题会自动恢复显示在编辑框中
   - 标题风格标签会显示（迷蒙体/普通风格）
   - 可以直接编辑并重新保存

5. **如果还没有标题**：
   - Step 5 部分会显示风格选择按钮
   - 点击任意风格按钮即可生成标题

## 技术实现细节

### 数据库字段

```ruby
# articles table
add_column :articles, :title, :text
add_column :articles, :title_style, :string
```

### 后端方法

```ruby
# app/channels/articles_channel.rb

# 生成标题
def generate_title(data)
  article_id = data['article_id']
  final_content = data['final_content']
  style = data['style']
  
  # 使用 LlmStreamJob 实时流式生成标题
  LlmStreamJob.perform_later(
    stream_name: "#{@stream_name}_title",
    prompt: title_prompt,
    llm_config: llm_config,
    article_id: article.id,
    provider: 'title'
  )
end

# 保存标题
def save_title(data)
  article.update!(title: data['title_content'])
end
```

### 前端方法

```typescript
// app/javascript/controllers/articles_controller.ts

// 生成标题（选择风格后触发）
generateTitle(event: Event): void

// 处理流式响应
handleTitleChunk(chunk: string): void

// 完成后显示操作按钮
handleTitleComplete(): void

// 复制标题到剪贴板
copyTitle(): void

// 保存编辑后的标题
saveTitle(): void
```

### 历史文章恢复

```typescript
// 检测 URL 参数并恢复文章状态
private async checkArticleIdParam(): Promise<void> {
  // ...
  
  // 如果有定稿内容，自动显示 Step 5
  if (article.final_content) {
    this.titleSectionTarget.style.display = "block"
    
    // 如果有标题，恢复标题内容
    if (article.title) {
      this.titleContent = article.title
      this.titleContainerTarget.style.display = "block"
      this.titleTextTarget.value = article.title
      this.titleStyleLabelTarget.textContent = styleNames[article.title_style]
      this.actionButtonsTarget.style.display = "block"
    }
  }
  
  // 自动滚动到标题部分
  if (article.title || article.final_content) {
    this.titleSectionTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
```

## 迷蒙体标题特征

迷蒙体标题系统使用了以下 6 种标题公式：

1. **痛点型**：《那些[具体行为]的人，后来都[结果]了》
2. **对比型**：《[A类人]和[B类人]的区别，就是[核心差异]》
3. **颠覆型**：《你以为[常识]，其实[真相]》
4. **共鸣型**：《[年龄/身份]的我，终于明白了[道理]》
5. **悬念型**：《关于[话题]，我必须说点什么了》
6. **数字型**：《[数字]岁那年，我[关键转折]》

## 常见问题

**Q: 为什么我看不到 Step 5？**
A: Step 5 只在完成定稿（Step 4）后才会显示。请确保您已经生成了定稿内容。

**Q: 从历史文章进入后，Step 5 在哪里？**
A: 如果文章已有定稿内容，系统会自动显示 Step 5 并滚动到该位置。您只需要点击风格按钮即可生成标题。

**Q: 生成的标题可以修改吗？**
A: 可以。标题生成后会显示在可编辑的文本框中，您可以直接修改，然后点击「保存标题」按钮保存修改。

**Q: 标题会保存到数据库吗？**
A: 是的。点击「保存标题」按钮后，标题会保存到文章记录中。下次打开该文章时，标题会自动恢复。

**Q: 可以重新生成标题吗？**
A: 可以。即使已经生成过标题，您仍然可以点击风格按钮重新生成。新标题会覆盖旧标题（需要点击保存按钮才会保存到数据库）。

## 更新日志

- **2026-01-15**: 初始版本发布
  - 添加数据库字段 `title` 和 `title_style`
  - 实现迷蒙体和普通风格两种标题生成模式
  - 支持实时流式生成标题
  - 支持历史文章标题恢复
  - 添加标题编辑、保存、复制功能
