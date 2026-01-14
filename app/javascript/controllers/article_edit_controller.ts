import { Controller } from "@hotwired/stimulus"
import { showToast } from '../toast'

// Connects to data-controller="article-edit"
// Handles inline editing of articles in book view
// Actions: toggleEdit, save, cancel
// Targets: content, editor, saveButton, cancelButton, editButton
// Values: articleId (Number)
export default class extends Controller<HTMLElement> {
  static targets = ["content", "editor", "saveButton", "cancelButton", "editButton"]
  
  static values = {
    articleId: Number
  }
  
  declare readonly contentTarget: HTMLElement
  declare readonly editorTarget: HTMLTextAreaElement
  declare readonly saveButtonTarget: HTMLButtonElement
  declare readonly cancelButtonTarget: HTMLButtonElement
  declare readonly editButtonTarget: HTMLButtonElement
  declare readonly articleIdValue: number
  
  private originalContent = ""

  connect(): void {
    // Listen for turbo:submit-end to handle form submission completion
    document.addEventListener('turbo:submit-end', this.handleSubmitEnd.bind(this))
  }

  disconnect(): void {
    document.removeEventListener('turbo:submit-end', this.handleSubmitEnd.bind(this))
  }

  toggleEdit(): void {
    // Switch to edit mode
    this.originalContent = this.editorTarget.value
    this.contentTarget.classList.add('hidden')
    this.editorTarget.classList.remove('hidden')
    this.saveButtonTarget.classList.remove('hidden')
    this.cancelButtonTarget.classList.remove('hidden')
    this.editButtonTarget.classList.add('hidden')
  }

  cancel(): void {
    // Restore original content and switch back to view mode
    this.editorTarget.value = this.originalContent
    this.switchToViewMode()
  }

  save(): void {
    const content = this.editorTarget.value.trim()
    
    if (!content) {
      showToast('内容不能为空', 'error')
      return
    }
    
    // Disable buttons during save
    this.saveButtonTarget.disabled = true
    this.cancelButtonTarget.disabled = true
    this.saveButtonTarget.textContent = '保存中...'
    
    // Create form and submit via Turbo
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = `/my_books/articles/${this.articleIdValue}`
    
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
    
    // Add content
    const contentInput = document.createElement('input')
    contentInput.type = 'hidden'
    contentInput.name = 'final_content'
    contentInput.value = content
    form.appendChild(contentInput)
    
    // Store form reference for cleanup
    form.dataset.articleEditForm = 'true'
    
    // Append form to body and submit
    document.body.appendChild(form)
    form.requestSubmit()
    
    // Switch to view mode after a short delay
    // The Turbo Stream response will update the content
    setTimeout(() => {
      form.remove()
      this.switchToViewMode()
    }, 500)
  }

  private handleSubmitEnd(event: Event): void {
    const customEvent = event as CustomEvent
    // Check if this is our form submission
    const form = customEvent.detail?.formSubmission?.formElement
    if (form?.dataset?.articleEditForm === 'true') {
      // Reset button states
      this.saveButtonTarget.disabled = false
      this.cancelButtonTarget.disabled = false
      this.saveButtonTarget.textContent = '保存'
    }
  }

  private switchToViewMode(): void {
    this.contentTarget.classList.remove('hidden')
    this.editorTarget.classList.add('hidden')
    this.saveButtonTarget.classList.add('hidden')
    this.cancelButtonTarget.classList.add('hidden')
    this.editButtonTarget.classList.remove('hidden')
  }

  copyMarkdown(): void {
    // Copy markdown content from editor textarea
    const markdown = this.editorTarget.value
    
    navigator.clipboard.writeText(markdown)
      .then(() => {
        showToast('Markdown 已复制到剪切板', 'success')
      })
      .catch(() => {
        showToast('复制失败', 'error')
      })
  }

  copyHtml(): void {
    // Copy rendered HTML content
    const htmlContent = this.contentTarget.innerHTML
    
    // Create a ClipboardItem with HTML content
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const clipboardItem = new ClipboardItem({ 'text/html': blob })
    
    navigator.clipboard.write([clipboardItem])
      .then(() => {
        showToast('内容已复制到剪切板', 'success')
      })
      .catch(() => {
        // Fallback: copy as plain text
        const textContent = this.contentTarget.innerText
        navigator.clipboard.writeText(textContent)
          .then(() => {
            showToast('内容已复制到剪切板（纯文本）', 'success')
          })
          .catch(() => {
            showToast('复制失败', 'error')
          })
      })
  }
}
