import { Controller } from "@hotwired/stimulus"
import { marked } from "marked"

// Configure marked with GitHub Flavored Markdown
marked.setOptions({
  gfm: true,
  breaks: true
})

// Fix common markdown formatting issues from AI output
function fixMarkdownHeaders(text: string): string {
  // Step 1: Fix headers appearing consecutively on the same line
  // Match any character followed by # markers (not at line start), insert newline before the #
  let fixed = text.replace(/(.)#{1,6}(?=[^#\n])/g, function(match, prev, offset) {
    // Don't add newline if we're at the start or already after a newline
    if (offset === 0 || prev === '\n') return match
    return `${prev}\n${match.slice(1)}`
  })
  
  // Step 2: Add missing space after heading markers (e.g., "###text" -> "### text")
  fixed = fixed.replace(/^(#{1,6})([^\s#])/gm, '$1 $2')
  
  // Step 3: Remove leading spaces before list markers (-, *, +)
  // This fixes AI-generated lists with incorrect indentation like " -item"
  fixed = fixed.replace(/^\s+(-|\*|\+)(?=\s|\S)/gm, '$1')
  
  return fixed
}

/**
 * Markdown Renderer Controller
 * 
 * Renders Markdown content on the client side using marked.js
 * This ensures consistent rendering with the AI response pages
 * 
 * Usage:
 * <div data-controller="markdown-renderer" 
 *      data-markdown-renderer-content-value="<%= @article.brainstorm_grok.to_json %>">
 * </div>
 */
export default class extends Controller {
  static values = {
    content: String
  }

  declare readonly contentValue: string

  connect(): void {
    this.render()
  }

  contentValueChanged(): void {
    this.render()
  }

  private render(): void {
    if (!this.contentValue || this.contentValue.trim().length === 0) {
      this.element.innerHTML = '<p class="text-muted">无内容</p>'
      return
    }

    try {
      // Parse JSON if the content is JSON-encoded
      let content = this.contentValue
      try {
        content = JSON.parse(this.contentValue)
      } catch {
        // Not JSON, use as-is
      }

      // Fix markdown headers and render
      const fixedMarkdown = fixMarkdownHeaders(content)
      const html = marked.parse(fixedMarkdown) as string
      this.element.innerHTML = html
    } catch (error) {
      console.error('Failed to render markdown:', error)
      this.element.innerHTML = '<p class="text-danger">渲染失败</p>'
    }
  }
}
