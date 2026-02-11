# Open Graph 使用说明

## 已添加的功能

✅ OG 图片已下载到 `app/assets/images/og-image.png`
✅ Open Graph meta 标签已添加到 `app/views/layouts/application.html.erb`
✅ 支持 Facebook、Twitter 等社交平台的分享预览

## 默认配置

默认情况下，所有页面都会使用以下 OG 信息：

- **标题**: 应用名称（或页面标题 + 应用名称）
- **描述**: "能说就能写，写出影响力"
- **图片**: og-image.png
- **类型**: website

## 如何在特定页面自定义 OG 信息

在任何视图文件中，你可以通过 `content_for` 自定义 OG 标签：

```erb
<%# 设置页面标题 %>
<% content_for :title, "我的文章标题" %>

<%# 设置页面描述 %>
<% content_for :description, "这是一篇关于写作技巧的精彩文章..." %>

<div class="container">
  <!-- 你的页面内容 -->
</div>
```

## 示例：文章页面

```erb
<%# app/views/articles/show.html.erb %>
<% content_for :title, @article.title %>
<% content_for :description, @article.summary || @article.content.truncate(150) %>

<article>
  <h1><%= @article.title %></h1>
  <!-- 文章内容 -->
</article>
```

## 测试 OG 标签

可以使用以下工具测试分享效果：

1. **Facebook Sharing Debugger**: https://developers.facebook.com/tools/debug/
2. **Twitter Card Validator**: https://cards-dev.twitter.com/validator
3. **LinkedIn Post Inspector**: https://www.linkedin.com/post-inspector/

## 技术说明

- OG 图片使用 `image_url` helper，自动处理 asset pipeline
- 支持动态 URL（通过 `request.original_url`）
- 支持页面级别的标题和描述自定义
- 使用 `summary_large_image` 卡片类型，确保大图展示
