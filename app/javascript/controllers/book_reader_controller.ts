import { Controller } from "@hotwired/stimulus"

export default class extends Controller<HTMLElement> {
  static targets = [
    "sidebar",
    "overlay",
    "mobileSidebar",
    "pagesContainer",
    "currentPage",
    "totalPages",
    "prevBtn",
    "nextBtn",
    "pageInfo"
  ]

  static values = {
    currentPage: { type: Number, default: 0 },
    totalPages: { type: Number, default: 0 }
  }

  declare readonly sidebarTarget: HTMLElement
  declare readonly overlayTarget: HTMLElement
  declare readonly mobileSidebarTarget: HTMLElement
  declare readonly pagesContainerTarget: HTMLElement
  declare readonly currentPageTarget: HTMLElement
  declare readonly totalPagesTarget: HTMLElement
  declare readonly prevBtnTarget: HTMLButtonElement
  declare readonly nextBtnTarget: HTMLButtonElement
  declare readonly pageInfoTarget: HTMLElement

  declare currentPageValue: number
  declare totalPagesValue: number

  private pages: string[] = []
  private currentArticleId: number | null = null

  connect(): void {
    console.log("BookReader connected")
    // Listen for keyboard navigation
    document.addEventListener('keydown', this.handleKeyPress.bind(this))
  }

  disconnect(): void {
    console.log("BookReader disconnected")
    document.removeEventListener('keydown', this.handleKeyPress.bind(this))
  }

  toggleSidebar(): void {
    this.mobileSidebarTarget.classList.toggle('-translate-x-full')
    this.overlayTarget.classList.toggle('hidden')
  }

  closeSidebar(): void {
    this.mobileSidebarTarget.classList.add('-translate-x-full')
    this.overlayTarget.classList.add('hidden')
  }

  toggleChapter(event: Event): void {
    const target = event.currentTarget as HTMLElement
    const chapterId = target.dataset.chapterId
    
    if (!chapterId) return

    const content = document.querySelector(`[data-chapter-content="${chapterId}"]`) as HTMLElement
    const icon = document.querySelector(`[data-chapter-toggle="${chapterId}"]`) as HTMLElement

    if (content && icon) {
      content.classList.toggle('hidden')
      icon.classList.toggle('rotate-90')
    }
  }

  loadChapter(event: Event): void {
    const target = event.currentTarget as HTMLElement
    const chapterId = target.dataset.chapterId
    
    if (!chapterId) return

    // Just expand/collapse the chapter
    this.toggleChapter(event)
  }

  async loadArticle(event: Event): Promise<void> {
    const target = event.currentTarget as HTMLElement
    const articleId = target.dataset.articleId
    
    if (!articleId) return

    this.currentArticleId = parseInt(articleId)

    try {
      const response = await fetch(`/articles/${articleId}.json`)
      const data = await response.json()
      
      // Split content into pages (simulate pagination)
      this.pages = this.splitIntoPages(data.final_content || data.draft || '暂无内容')
      this.totalPagesValue = this.pages.length
      this.currentPageValue = 0

      this.renderCurrentPage()
      this.updateNavigation()
      this.closeSidebar()
    } catch (error) {
      console.error('Failed to load article:', error)
      this.showError('加载文章失败')
    }
  }

  prevPage(): void {
    if (this.currentPageValue > 0) {
      this.currentPageValue--
      this.renderCurrentPage()
      this.updateNavigation()
    }
  }

  nextPage(): void {
    if (this.currentPageValue < this.totalPagesValue - 1) {
      this.currentPageValue++
      this.renderCurrentPage()
      this.updateNavigation()
    }
  }

  private handleKeyPress(event: KeyboardEvent): void {
    if (this.pages.length === 0) return

    switch(event.key) {
      case 'ArrowLeft':
        this.prevPage()
        break
      case 'ArrowRight':
        this.nextPage()
        break
    }
  }

  private splitIntoPages(content: string): string[] {
    // Simple pagination: split by paragraphs, ~500 words per page
    const wordsPerPage = 500
    const paragraphs = content.split('\n\n').filter(p => p.trim())
    const pages: string[] = []
    let currentPage: string[] = []
    let currentWordCount = 0

    paragraphs.forEach(para => {
      const wordCount = para.length // Approximate word count
      
      if (currentWordCount + wordCount > wordsPerPage && currentPage.length > 0) {
        pages.push(currentPage.join('\n\n'))
        currentPage = [para]
        currentWordCount = wordCount
      } else {
        currentPage.push(para)
        currentWordCount += wordCount
      }
    })

    if (currentPage.length > 0) {
      pages.push(currentPage.join('\n\n'))
    }

    return pages.length > 0 ? pages : [content]
  }

  private renderCurrentPage(): void {
    const page = this.pages[this.currentPageValue] || ''
    
    // Create page-turn animation
    this.pagesContainerTarget.style.opacity = '0'
    
    setTimeout(() => {
      this.pagesContainerTarget.innerHTML = `
        <div class="prose prose-lg dark:prose-invert max-w-none p-12 min-h-[600px]">
          ${this.formatContent(page)}
        </div>
      `
      
      // Fade in
      setTimeout(() => {
        this.pagesContainerTarget.style.opacity = '1'
      }, 50)
    }, 200)
  }

  private formatContent(content: string): string {
    // Convert plain text to HTML with proper formatting
    return content
      .split('\n\n')
      .map(para => `<p>${this.escapeHtml(para)}</p>`)
      .join('')
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  private updateNavigation(): void {
    this.currentPageTarget.textContent = (this.currentPageValue + 1).toString()
    this.totalPagesTarget.textContent = this.totalPagesValue.toString()

    // Show/hide navigation
    this.pageInfoTarget.style.display = 'block'
    this.prevBtnTarget.style.display = 'inline-flex'
    this.nextBtnTarget.style.display = 'inline-flex'

    // Update button states
    if (this.currentPageValue === 0) {
      this.prevBtnTarget.style.opacity = '0.5'
      this.prevBtnTarget.disabled = true
    } else {
      this.prevBtnTarget.style.opacity = '1'
      this.prevBtnTarget.disabled = false
    }

    if (this.currentPageValue >= this.totalPagesValue - 1) {
      this.nextBtnTarget.style.opacity = '0.5'
      this.nextBtnTarget.disabled = true
    } else {
      this.nextBtnTarget.style.opacity = '1'
      this.nextBtnTarget.disabled = false
    }
  }

  private showError(message: string): void {
    this.pagesContainerTarget.innerHTML = `
      <div class="flex items-center justify-center py-24">
        <div class="text-center">
          <div class="text-red-500 text-6xl mb-4">⚠️</div>
          <p class="text-gray-700 dark:text-gray-300">${message}</p>
        </div>
      </div>
    `
  }
}
