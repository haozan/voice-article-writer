import { Controller } from "@hotwired/stimulus"

// Stimulus controller for writing tip banner
// Handles tip navigation (previous/next)
export default class extends Controller<HTMLElement> {
  static targets = ["content", "tipsData"]
  
  declare readonly contentTarget: HTMLElement
  declare readonly tipsDataTarget: HTMLElement
  
  private tips: Array<{ id: number; content: string }> = []
  private currentIndex: number = 0
  
  connect(): void {
    this.loadTips()
    this.showRandomTip()
  }
  
  // Load tips from data attribute
  private loadTips(): void {
    try {
      const tipsJson = this.tipsDataTarget.dataset.tips
      if (tipsJson) {
        this.tips = JSON.parse(tipsJson)
      }
    } catch (error) {
      console.error("Failed to load writing tips:", error)
    }
  }
  
  // Show a random tip on initial load
  private showRandomTip(): void {
    if (this.tips.length === 0) return
    
    this.currentIndex = Math.floor(Math.random() * this.tips.length)
    this.updateContent()
  }
  
  // Navigate to next tip
  next(): void {
    if (this.tips.length === 0) return
    
    this.currentIndex = (this.currentIndex + 1) % this.tips.length
    this.updateContent()
  }
  
  // Navigate to previous tip
  previous(): void {
    if (this.tips.length === 0) return
    
    this.currentIndex = (this.currentIndex - 1 + this.tips.length) % this.tips.length
    this.updateContent()
  }
  
  // Update displayed content with fade effect
  private updateContent(): void {
    const tip = this.tips[this.currentIndex]
    if (!tip) return
    
    // Add fade-out effect
    this.contentTarget.style.opacity = "0.5"
    
    // Update content after brief delay
    setTimeout(() => {
      this.contentTarget.textContent = tip.content
      this.contentTarget.style.opacity = "1"
    }, 150)
  }
}
