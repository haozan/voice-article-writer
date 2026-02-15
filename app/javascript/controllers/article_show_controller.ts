import { Controller } from "@hotwired/stimulus"
import { marked } from "marked"
import { showToast } from "../toast"

export default class extends Controller<HTMLElement> {
  static targets = [
    "draftGrok",
    "draftQwen", 
    "draftDeepseek",
    "draftGemini",
    "draftDoubao"
  ]

  declare readonly draftGrokTarget: HTMLElement
  declare readonly draftQwenTarget: HTMLElement
  declare readonly draftDeepseekTarget: HTMLElement
  declare readonly draftGeminiTarget: HTMLElement
  declare readonly draftDoubaoTarget: HTMLElement

  connect(): void {
    console.log("ArticleShow connected")
  }

  disconnect(): void {
    console.log("ArticleShow disconnected")
  }

  // Copy rendered HTML content
  copyHtml(event: Event): void {
    event.preventDefault()
    const button = event.currentTarget as HTMLButtonElement
    
    // Find the sibling div that contains the rendered HTML
    const card = button.closest('.card')
    if (!card) return
    
    const contentDiv = card.querySelector('[data-controller="markdown-renderer"]')
    if (!contentDiv) return
    
    const htmlContent = contentDiv.innerHTML
    
    navigator.clipboard.writeText(htmlContent).then(() => {
      showToast("已复制HTML", "success")
    }).catch(err => {
      console.error("Failed to copy HTML:", err)
      showToast("复制失败", "danger")
    })
  }

  // Copy original Markdown content
  copyMarkdown(event: Event): void {
    event.preventDefault()
    const button = event.currentTarget as HTMLButtonElement
    
    // Get Markdown content from data-content attribute
    const markdownContent = button.dataset.content
    
    if (!markdownContent) {
      showToast("未找到Markdown内容", "warning")
      return
    }
    
    // Parse JSON to get actual string
    let actualContent: string
    try {
      actualContent = JSON.parse(markdownContent)
    } catch (e) {
      actualContent = markdownContent
    }
    
    navigator.clipboard.writeText(actualContent).then(() => {
      showToast("已复制Markdown", "success")
    }).catch(err => {
      console.error("Failed to copy Markdown:", err)
      showToast("复制失败", "danger")
    })
  }
}
