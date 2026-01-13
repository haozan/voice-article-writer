import BaseChannelController from "./base_channel_controller"
import { showToast } from "../toast"

/**
 * Articles Controller - Handles WebSocket streaming for Grok's response + UI interactions
 * 
 * This controller manages single-step Grok response:
 * - User provides original thoughts/content
 * - Grok shares his genuine thinking, ideas, and suggestions (no expansion)
 *
 * Targets:
 * - inputText: Text input area
 * - responseSection: Section showing Grok's response
 * - responseText: Display area for Grok's response
 * - copyButton: Button to copy Grok's response
 * - actionButtons: Container for action buttons
 *
 * Values:
 * - streamName: Unique stream name for this session
 */
export default class extends BaseChannelController {
  static targets = [
    "inputText",
    "responseSection",
    "responseText",
    "copyButton",
    "actionButtons",
    "providerRadio"
  ]

  static values = {
    streamName: String
  }

  declare readonly inputTextTarget: HTMLTextAreaElement
  declare readonly responseSectionTarget: HTMLElement
  declare readonly responseTextTarget: HTMLElement
  declare readonly copyButtonTarget: HTMLElement
  declare readonly actionButtonsTarget: HTMLElement
  declare readonly providerRadioTargets: HTMLInputElement[]
  declare readonly streamNameValue: string
  declare readonly hasInputTextTarget: boolean

  private originalTranscript: string = ""
  private responseContent: string = ""
  private currentStep: "idle" | "responding" = "idle"

  connect(): void {
    console.log("Articles controller connected")

    // Subscribe to WebSocket channel
    this.createSubscription("ArticlesChannel", {
      stream_name: this.streamNameValue
    })
  }

  disconnect(): void {
    this.destroySubscription()
  }

  protected channelConnected(): void {
    console.log("Articles channel connected")
  }

  protected channelDisconnected(): void {
    console.log("Articles channel disconnected")
  }

  // Called when user clicks "Generate" button
  generateArticle(): void {
    if (!this.hasInputTextTarget) {
      console.error("Input text target not found")
      return
    }

    const inputText = this.inputTextTarget.value.trim()
    
    if (!inputText || inputText.length === 0) {
      showToast("请先输入一些内容", "warning")
      this.inputTextTarget.focus()
      return
    }

    // Validate minimum length
    if (inputText.length < 10) {
      showToast("内容太短，请至少输入10个字", "warning")
      this.inputTextTarget.focus()
      return
    }

    this.originalTranscript = inputText

    // Start generation process
    this.startGrokResponse()
  }

  // Called when voice recording is completed (legacy support)
  onVoiceCompleted(event: CustomEvent): void {
    const transcript = event.detail.transcript
    
    if (!transcript || transcript.trim().length === 0) {
      console.error("Empty transcript")
      return
    }

    this.originalTranscript = transcript

    // Start Grok's response
    this.startGrokResponse()
  }

  private startGrokResponse(): void {
    this.currentStep = "responding"
    
    // Get selected LLM provider
    const selectedProvider = this.providerRadioTargets.find((radio) => radio.checked)?.value || 'grok'
    const providerName = selectedProvider === 'qwen' ? '千问' : 
                         selectedProvider === 'deepseek' ? 'DeepSeek' : 
                         'Grok'

    // Show response section
    this.responseSectionTarget.style.display = "block"
    this.responseTextTarget.innerHTML = `
      <div class="flex items-center gap-2 text-muted">
        <div class="loading-spinner w-5 h-5"></div>
        <span>${providerName} 思考中...</span>
      </div>
    `

    this.responseContent = ""

    // Trigger backend job with selected provider
    this.perform("generate_response", {
      transcript: this.originalTranscript,
      llm_provider: selectedProvider
    })
  }

  // WebSocket handler: Handle streaming chunks
  protected handleChunk(data: any): void {
    const chunk = data.chunk

    if (this.currentStep === "responding") {
      this.responseContent += chunk
      this.responseTextTarget.textContent = this.responseContent
      
      // Auto-scroll to bottom
      this.responseTextTarget.scrollTop = this.responseTextTarget.scrollHeight
    }
  }

  // WebSocket handler: Handle generation complete
  protected handleComplete(data: any): void {
    if (this.currentStep === "responding") {
      // Response complete, show action buttons
      console.log("Grok response complete")
      this.currentStep = "idle"
      this.copyButtonTarget.style.display = "inline-flex"
      this.actionButtonsTarget.style.display = "block"
    }
  }

  // WebSocket handler: Handle errors
  protected handleError(data: any): void {
    console.error("Generation error:", data.message)
    
    const errorMessage = `生成失败: ${data.message || "未知错误"}`
    
    if (this.currentStep === "responding") {
      this.responseTextTarget.innerHTML = `
        <div class="text-danger">${errorMessage}</div>
      `
    }
    
    this.currentStep = "idle"
    this.actionButtonsTarget.style.display = "block"
  }

  // Copy Grok's response to clipboard
  copyArticle(): void {
    if (!this.responseContent) {
      return
    }

    navigator.clipboard.writeText(this.responseContent).then(() => {
      // Show success feedback
      const originalText = this.copyButtonTarget.textContent
      this.copyButtonTarget.textContent = "✓ 已复制"
      this.copyButtonTarget.classList.add("btn-success")
      this.copyButtonTarget.classList.remove("btn-primary")
      
      setTimeout(() => {
        this.copyButtonTarget.textContent = originalText
        this.copyButtonTarget.classList.remove("btn-success")
        this.copyButtonTarget.classList.add("btn-primary")
      }, 2000)
    }).catch(err => {
      console.error("Failed to copy:", err)
      showToast("复制失败，请手动选择并复制文本", "danger")
    })
  }

  // Reset and start over
  reset(): void {
    // Clear all content
    this.originalTranscript = ""
    this.responseContent = ""
    this.currentStep = "idle"

    // Clear input text
    if (this.hasInputTextTarget) {
      this.inputTextTarget.value = ""
    }

    // Hide all sections
    this.responseSectionTarget.style.display = "none"
    this.actionButtonsTarget.style.display = "none"
    this.copyButtonTarget.style.display = "none"

    // Reset text
    this.responseTextTarget.innerHTML = ""

    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
}
