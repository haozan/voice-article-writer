import BaseChannelController from "./base_channel_controller"
import { showToast } from "../toast"

/**
 * Articles Controller - Handles WebSocket streaming for article generation + UI interactions
 * 
 * This controller manages the two-step article generation process:
 * 1. Generate Grok's thinking/analysis (streaming)
 * 2. Generate final article by fusing user's original text + Grok's thinking (streaming)
 *
 * Targets:
 * - originalSection: Section showing user's original voice text
 * - originalText: Display area for original text
 * - thinkingSection: Section showing Grok's thinking
 * - thinkingText: Display area for Grok's thinking
 * - articleSection: Section showing final article
 * - articleText: Display area for final article
 * - copyButton: Button to copy final article
 * - actionButtons: Container for action buttons
 *
 * Values:
 * - streamName: Unique stream name for this session
 */
export default class extends BaseChannelController {
  static targets = [
    "inputText",
    "modelSelect",
    "thinkingSection",
    "thinkingTitle",
    "thinkingText",
    "articleSection",
    "articleText",
    "copyButton",
    "actionButtons"
  ]

  static values = {
    streamName: String
  }

  declare readonly inputTextTarget: HTMLTextAreaElement
  declare readonly modelSelectTarget: HTMLSelectElement
  declare readonly thinkingSectionTarget: HTMLElement
  declare readonly thinkingTitleTarget: HTMLElement
  declare readonly thinkingTextTarget: HTMLElement
  declare readonly articleSectionTarget: HTMLElement
  declare readonly articleTextTarget: HTMLElement
  declare readonly copyButtonTarget: HTMLElement
  declare readonly actionButtonsTarget: HTMLElement
  declare readonly streamNameValue: string
  declare readonly hasInputTextTarget: boolean
  declare readonly hasModelSelectTarget: boolean

  private originalTranscript: string = ""
  private thinkingContent: string = ""
  private articleContent: string = ""
  private currentStep: "idle" | "thinking" | "article" = "idle"
  private selectedModel: string = "anthropic/claude-3.5-sonnet"
  private selectedProvider: string = "anthropic"

  connect(): void {
    console.log("Articles controller connected")

    // Subscribe to WebSocket channel
    this.createSubscription("ArticlesChannel", {
      stream_name: this.streamNameValue
    })

    // Initialize selected model
    this.updateSelectedModel()
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

  // Called when user clicks "Generate Article" button
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
    this.updateSelectedModel()

    // Start generation process
    this.startThinkingGeneration()
  }

  // Called when voice recording is completed (legacy support)
  onVoiceCompleted(event: CustomEvent): void {
    const transcript = event.detail.transcript
    
    if (!transcript || transcript.trim().length === 0) {
      console.error("Empty transcript")
      return
    }

    this.originalTranscript = transcript

    // Start step 1: Generate Grok's thinking
    this.startThinkingGeneration()
  }

  private updateSelectedModel(): void {
    if (!this.hasModelSelectTarget) {
      return
    }

    const selectedOption = this.modelSelectTarget.selectedOptions[0]
    this.selectedModel = this.modelSelectTarget.value
    this.selectedProvider = selectedOption.dataset.provider || "xai"

    console.log("Selected model:", this.selectedModel, "provider:", this.selectedProvider)
  }

  private startThinkingGeneration(): void {
    this.currentStep = "thinking"

    // Update section title based on provider
    const modelLabel = this.getModelLabel()
    this.thinkingTitleTarget.textContent = `${modelLabel} 的思考`

    // Show thinking section
    this.thinkingSectionTarget.style.display = "block"
    this.thinkingTextTarget.innerHTML = `
      <div class="flex items-center gap-2 text-muted">
        <div class="loading-spinner w-5 h-5"></div>
        <span>思考中...</span>
      </div>
    `

    this.thinkingContent = ""

    // Trigger backend job for step 1
    this.perform("generate_thinking", {
      transcript: this.originalTranscript,
      model: this.selectedModel,
      provider: this.selectedProvider
    })
  }

  private startArticleGeneration(): void {
    this.currentStep = "article"

    // Show article section
    this.articleSectionTarget.style.display = "block"
    this.articleTextTarget.innerHTML = `
      <div class="flex items-center gap-2 text-muted">
        <div class="loading-spinner w-5 h-5"></div>
        <span>生成中...</span>
      </div>
    `

    this.articleContent = ""

    // Trigger backend job for step 2
    this.perform("generate_article", {
      transcript: this.originalTranscript,
      thinking: this.thinkingContent,
      model: this.selectedModel,
      provider: this.selectedProvider
    })
  }

  // WebSocket handler: Handle streaming chunks
  protected handleChunk(data: any): void {
    const chunk = data.chunk

    if (this.currentStep === "thinking") {
      this.thinkingContent += chunk
      this.thinkingTextTarget.textContent = this.thinkingContent
    } else if (this.currentStep === "article") {
      this.articleContent += chunk
      this.articleTextTarget.textContent = this.articleContent
      
      // Auto-scroll to bottom
      this.articleTextTarget.scrollTop = this.articleTextTarget.scrollHeight
    }
  }

  // WebSocket handler: Handle generation complete
  protected handleComplete(data: any): void {
    if (this.currentStep === "thinking") {
      // Step 1 complete, start step 2
      console.log("Thinking complete, starting article generation")
      this.startArticleGeneration()
    } else if (this.currentStep === "article") {
      // Step 2 complete, show action buttons
      console.log("Article generation complete")
      this.currentStep = "idle"
      this.copyButtonTarget.style.display = "inline-flex"
      this.actionButtonsTarget.style.display = "block"
    }
  }

  // WebSocket handler: Handle errors
  protected handleError(data: any): void {
    console.error("Generation error:", data.message)
    
    const errorMessage = `生成失败: ${data.message || "未知错误"}`
    
    if (this.currentStep === "thinking") {
      this.thinkingTextTarget.innerHTML = `
        <div class="text-danger">${errorMessage}</div>
      `
    } else if (this.currentStep === "article") {
      this.articleTextTarget.innerHTML = `
        <div class="text-danger">${errorMessage}</div>
      `
    }
    
    this.currentStep = "idle"
    this.actionButtonsTarget.style.display = "block"
  }

  // Get model label for display
  private getModelLabel(): string {
    if (!this.hasModelSelectTarget) {
      return "AI"
    }

    const selectedOption = this.modelSelectTarget.selectedOptions[0]
    const label = selectedOption.textContent || "AI"
    
    // Extract provider name from label
    if (label.includes("xAI")) {
      return "Grok"
    } else if (label.includes("Gemini")) {
      return "Gemini"
    }
    
    return "AI"
  }

  // Copy article to clipboard
  copyArticle(): void {
    if (!this.articleContent) {
      return
    }

    navigator.clipboard.writeText(this.articleContent).then(() => {
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
    this.thinkingContent = ""
    this.articleContent = ""
    this.currentStep = "idle"

    // Clear input text
    if (this.hasInputTextTarget) {
      this.inputTextTarget.value = ""
    }

    // Hide all sections
    this.thinkingSectionTarget.style.display = "none"
    this.articleSectionTarget.style.display = "none"
    this.actionButtonsTarget.style.display = "none"
    this.copyButtonTarget.style.display = "none"

    // Reset text
    this.thinkingTextTarget.innerHTML = ""
    this.articleTextTarget.innerHTML = ""

    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
}
