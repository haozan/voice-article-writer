import BaseChannelController from "./base_channel_controller"
import { showToast } from "../toast"
import consumer from "../channels/consumer"

/**
 * Articles Controller - Handles WebSocket streaming for multi-model concurrent responses + UI interactions
 * 
 * This controller manages concurrent responses from 5 AI models:
 * - User provides original thoughts/content
 * - All 5 models (Grok, Qwen, DeepSeek, Gemini, Zhipu) respond simultaneously
 * - Each model streams to its own dedicated response area
 *
 * Targets:
 * - inputText: Text input area
 * - responsesContainer: Container for all model responses
 * - responseGrok/Qwen/Deepseek/Gemini/Zhipu: Display areas for each model
 * - copyButtonGrok/Qwen/Deepseek/Gemini/Zhipu: Copy buttons for each model
 * - actionButtons: Container for action buttons
 *
 * Values:
 * - streamName: Base stream name for this session
 */
export default class extends BaseChannelController {
  static targets = [
    "inputText",
    "responsesContainer",
    "responseGrok",
    "responseQwen",
    "responseDeepseek",
    "responseGemini",
    "responseZhipu",
    "copyButtonGrok",
    "copyButtonQwen",
    "copyButtonDeepseek",
    "copyButtonGemini",
    "copyButtonZhipu",
    "actionButtons"
  ]

  static values = {
    streamName: String
  }

  declare readonly inputTextTarget: HTMLTextAreaElement
  declare readonly responsesContainerTarget: HTMLElement
  declare readonly responseGrokTarget: HTMLElement
  declare readonly responseQwenTarget: HTMLElement
  declare readonly responseDeepseekTarget: HTMLElement
  declare readonly responseGeminiTarget: HTMLElement
  declare readonly responseZhipuTarget: HTMLElement
  declare readonly copyButtonGrokTarget: HTMLElement
  declare readonly copyButtonQwenTarget: HTMLElement
  declare readonly copyButtonDeepseekTarget: HTMLElement
  declare readonly copyButtonGeminiTarget: HTMLElement
  declare readonly copyButtonZhipuTarget: HTMLElement
  declare readonly actionButtonsTarget: HTMLElement
  declare readonly streamNameValue: string
  declare readonly hasInputTextTarget: boolean

  private originalTranscript: string = ""
  private responseContents: { [key: string]: string } = {
    grok: "",
    qwen: "",
    deepseek: "",
    gemini: "",
    zhipu: ""
  }
  private completedModels: Set<string> = new Set()
  private subscriptions: { [key: string]: any } = {}
  private commandSubscription: any = null

  connect(): void {
    console.log("Articles controller connected")

    // Create a base subscription for sending commands (using base stream name)
    this.commandSubscription = consumer.subscriptions.create(
      {
        channel: "ArticlesChannel",
        stream_name: this.streamNameValue  // Base stream name without provider suffix
      },
      {
        connected: () => {
          console.log("Command channel connected")
        },
        disconnected: () => {
          console.log("Command channel disconnected")
        },
        received: () => {
          // This subscription is only for sending commands, not receiving
        }
      }
    )

    // Subscribe to WebSocket channels for all 5 models (for receiving responses)
    const providers = ['grok', 'qwen', 'deepseek', 'gemini', 'zhipu']
    
    providers.forEach(provider => {
      const streamName = `${this.streamNameValue}_${provider}`
      this.subscriptions[provider] = consumer.subscriptions.create(
        {
          channel: "ArticlesChannel",
          stream_name: streamName
        },
        {
          connected: () => {
            console.log(`${provider} channel connected`)
          },
          disconnected: () => {
            console.log(`${provider} channel disconnected`)
          },
          received: (data: any) => {
            this.handleProviderMessage(provider, data)
          }
        }
      )
    })
  }

  disconnect(): void {
    // Unsubscribe from command channel
    this.commandSubscription?.unsubscribe()
    this.commandSubscription = null
    
    // Unsubscribe from all provider channels
    Object.values(this.subscriptions).forEach(subscription => {
      subscription?.unsubscribe()
    })
    this.subscriptions = {}
  }

  // Handle messages from a specific provider
  private handleProviderMessage(provider: string, data: any): void {
    if (data.type === 'chunk') {
      this.handleChunkForProvider(provider, data.chunk)
    } else if (data.type === 'complete') {
      this.handleCompleteForProvider(provider)
    } else if (data.type === 'error') {
      this.handleErrorForProvider(provider, data.message)
    }
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
    this.startAllModelsResponse()
  }

  private startAllModelsResponse(): void {
    // Reset state
    this.responseContents = {
      grok: "",
      qwen: "",
      deepseek: "",
      gemini: "",
      zhipu: ""
    }
    this.completedModels.clear()

    // Show responses container
    this.responsesContainerTarget.style.display = "block"

    // Reset all response areas to loading state
    this.resetResponseArea("grok", "Grok 思考中...")
    this.resetResponseArea("qwen", "千问思考中...")
    this.resetResponseArea("deepseek", "DeepSeek 思考中...")
    this.resetResponseArea("gemini", "Gemini 思考中...")
    this.resetResponseArea("zhipu", "智谱思考中...")

    // Hide all copy buttons
    this.copyButtonGrokTarget.style.display = "none"
    this.copyButtonQwenTarget.style.display = "none"
    this.copyButtonDeepseekTarget.style.display = "none"
    this.copyButtonGeminiTarget.style.display = "none"
    this.copyButtonZhipuTarget.style.display = "none"

    // Trigger backend job (which will start all 5 models)
    // We only need to call this once - the backend will handle all providers
    if (this.commandSubscription) {
      this.commandSubscription.perform("generate_response", {
        transcript: this.originalTranscript
      })
    }
  }

  private resetResponseArea(provider: string, loadingText: string): void {
    const target = this.getResponseTarget(provider)
    if (target) {
      target.innerHTML = `
        <div class="flex items-center gap-2 text-muted">
          <div class="loading-spinner w-4 h-4"></div>
          <span>${loadingText}</span>
        </div>
      `
    }
  }

  private getResponseTarget(provider: string): HTMLElement | null {
    switch (provider) {
      case 'grok': return this.responseGrokTarget
      case 'qwen': return this.responseQwenTarget
      case 'deepseek': return this.responseDeepseekTarget
      case 'gemini': return this.responseGeminiTarget
      case 'zhipu': return this.responseZhipuTarget
      default: return null
    }
  }

  private getCopyButtonTarget(provider: string): HTMLElement | null {
    switch (provider) {
      case 'grok': return this.copyButtonGrokTarget
      case 'qwen': return this.copyButtonQwenTarget
      case 'deepseek': return this.copyButtonDeepseekTarget
      case 'gemini': return this.copyButtonGeminiTarget
      case 'zhipu': return this.copyButtonZhipuTarget
      default: return null
    }
  }

  // Handle streaming chunks for a specific provider
  private handleChunkForProvider(provider: string, chunk: string): void {
    this.responseContents[provider] += chunk
    const target = this.getResponseTarget(provider)
    
    if (target) {
      target.textContent = this.responseContents[provider]
      // Auto-scroll to bottom
      target.scrollTop = target.scrollHeight
    }
  }

  // Handle completion for a specific provider
  private handleCompleteForProvider(provider: string): void {
    console.log(`${provider} response complete`)
    this.completedModels.add(provider)
    
    // Show copy button for this provider
    const copyButton = this.getCopyButtonTarget(provider)
    if (copyButton) {
      copyButton.style.display = "inline-flex"
    }

    // If all models are complete, show action buttons
    if (this.completedModels.size === 5) {
      this.actionButtonsTarget.style.display = "block"
    }
  }

  // Handle errors for a specific provider
  private handleErrorForProvider(provider: string, message: string): void {
    console.error(`${provider} generation error:`, message)
    
    const errorMessage = `生成失败: ${message || "未知错误"}`
    const target = this.getResponseTarget(provider)
    
    if (target) {
      target.innerHTML = `
        <div class="text-danger">${errorMessage}</div>
      `
    }
    
    this.completedModels.add(provider)
    
    // If all models are complete (including errors), show action buttons
    if (this.completedModels.size === 5) {
      this.actionButtonsTarget.style.display = "block"
    }
  }

  // Copy a specific provider's response to clipboard
  copyResponse(event: Event): void {
    const button = event.currentTarget as HTMLElement
    const provider = button.dataset.provider
    
    if (!provider || !this.responseContents[provider]) {
      return
    }

    navigator.clipboard.writeText(this.responseContents[provider]).then(() => {
      // Show success feedback
      const originalText = button.textContent
      button.textContent = "✓ 已复制"
      button.classList.add("btn-success")
      button.classList.remove("btn-primary")
      
      setTimeout(() => {
        button.textContent = originalText
        button.classList.remove("btn-success")
        button.classList.add("btn-primary")
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
    this.responseContents = {
      grok: "",
      qwen: "",
      deepseek: "",
      gemini: "",
      zhipu: ""
    }
    this.completedModels.clear()

    // Clear input text
    if (this.hasInputTextTarget) {
      this.inputTextTarget.value = ""
    }

    // Hide all sections
    this.responsesContainerTarget.style.display = "none"
    this.actionButtonsTarget.style.display = "none"
    
    // Hide all copy buttons
    this.copyButtonGrokTarget.style.display = "none"
    this.copyButtonQwenTarget.style.display = "none"
    this.copyButtonDeepseekTarget.style.display = "none"
    this.copyButtonGeminiTarget.style.display = "none"
    this.copyButtonZhipuTarget.style.display = "none"

    // Reset all response texts
    this.responseGrokTarget.innerHTML = ""
    this.responseQwenTarget.innerHTML = ""
    this.responseDeepseekTarget.innerHTML = ""
    this.responseGeminiTarget.innerHTML = ""
    this.responseZhipuTarget.innerHTML = ""

    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
}
