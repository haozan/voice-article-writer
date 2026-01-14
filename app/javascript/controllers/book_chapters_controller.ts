import { Controller } from "@hotwired/stimulus"

// Connects to data-controller="book-chapters"
// Stores book chapters data for use by other controllers
export default class extends Controller<HTMLElement> {
  static values = {
    chapters: Array
  }
  
  declare readonly chaptersValue: Array<{ id: number; title: string; level: number }>

  connect(): void {
    // Store chapters data globally for other controllers
    (window as any).bookChaptersData = this.chaptersValue
  }

  disconnect(): void {
    // Clean up
    delete (window as any).bookChaptersData
  }

  toggleChapter(event: Event): void {
    const target = event.currentTarget as HTMLElement
    const chapterId = target.dataset.chapterId
    
    if (!chapterId) return

    const content = document.querySelector(`[data-toc-content="${chapterId}"]`) as HTMLElement
    const icon = document.querySelector(`[data-toc-toggle="${chapterId}"]`) as HTMLElement

    if (content && icon) {
      content.classList.toggle('hidden')
      icon.classList.toggle('rotate-90')
    }
  }
}
