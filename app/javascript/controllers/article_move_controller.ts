import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="article-move"
export default class extends Controller<HTMLElement> {
  static targets = ["movePanel", "chapterSelect", "message"]
  
  static values = {
    articleId: Number,
    bookId: Number
  }
  
  declare readonly movePanelTarget: HTMLElement
  declare readonly chapterSelectTarget: HTMLSelectElement
  declare readonly messageTarget: HTMLElement
  declare readonly articleIdValue: number
  declare readonly bookIdValue: number
  
  private chaptersLoaded = false

  connect(): void {
    // Controller connected
  }

  toggleMovePanel(): void {
    if (this.movePanelTarget.classList.contains('hidden')) {
      // Show panel and load chapters if not loaded
      this.movePanelTarget.classList.remove('hidden')
      if (!this.chaptersLoaded) {
        this.loadChapters()
      }
    } else {
      // Hide panel and clear message
      this.movePanelTarget.classList.add('hidden')
      this.hideMessage()
    }
  }

  loadChapters(): void {
    // Get chapters data from window (set by book-chapters controller)
    const chapters = (window as any).bookChaptersData
    
    if (!chapters || chapters.length === 0) {
      this.showMessage('没有可用的章节', 'error')
      return
    }
    
    this.populateChapterSelect(chapters)
    this.chaptersLoaded = true
  }

  populateChapterSelect(chapters: Array<{ id: number; title: string; level: number }>): void {
    // Clear existing options except the first placeholder
    this.chapterSelectTarget.innerHTML = '<option value="">请选择目标章节...</option>'
    
    // Add chapter options with indentation based on level
    chapters.forEach((chapter) => {
      const option = document.createElement('option')
      option.value = chapter.id.toString()
      const indent = '　'.repeat(chapter.level)
      option.textContent = `${indent}${chapter.title}`
      this.chapterSelectTarget.appendChild(option)
    })
  }

  move(): void {
    const targetChapterId = this.chapterSelectTarget.value
    
    if (!targetChapterId) {
      this.showMessage('请选择目标章节', 'error')
      return
    }
    
    // Create a form and submit via Turbo
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = `/my_books/${this.bookIdValue}/move_article`
    
    // Add CSRF token
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
    if (csrfToken) {
      const csrfInput = document.createElement('input')
      csrfInput.type = 'hidden'
      csrfInput.name = 'authenticity_token'
      csrfInput.value = csrfToken
      form.appendChild(csrfInput)
    }
    
    // Add _method for PATCH
    const methodInput = document.createElement('input')
    methodInput.type = 'hidden'
    methodInput.name = '_method'
    methodInput.value = 'patch'
    form.appendChild(methodInput)
    
    // Add article_id
    const articleInput = document.createElement('input')
    articleInput.type = 'hidden'
    articleInput.name = 'article_id'
    articleInput.value = this.articleIdValue.toString()
    form.appendChild(articleInput)
    
    // Add target_chapter_id
    const chapterInput = document.createElement('input')
    chapterInput.type = 'hidden'
    chapterInput.name = 'target_chapter_id'
    chapterInput.value = targetChapterId
    form.appendChild(chapterInput)
    
    // Show processing message
    this.showMessage('正在移动...', 'success')
    
    // Append form to body and submit
    document.body.appendChild(form)
    form.requestSubmit()
    
    // Clean up after a short delay
    setTimeout(() => {
      form.remove()
      // Page will refresh via Turbo Stream response
    }, 100)
  }

  showMessage(text: string, type: 'success' | 'error'): void {
    this.messageTarget.textContent = text
    this.messageTarget.classList.remove('hidden', 'text-green-600', 'text-red-600')
    this.messageTarget.classList.add(type === 'success' ? 'text-green-600' : 'text-red-600')
  }

  hideMessage(): void {
    this.messageTarget.classList.add('hidden')
  }
}
