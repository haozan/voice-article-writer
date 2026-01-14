import BaseChannelController from "./base_channel_controller"
import { showToast } from "../toast"
import consumer from "../channels/consumer"

/**
 * Articles Controller - Handles "懒人写作术" 4-step workflow
 * 
 * Step 1: 语音输入 - User inputs their thoughts
 * Step 2: AI脑爆 - 5 models brainstorm simultaneously
 * Step 3: 初稿 - User selects a model to generate draft
 * Step 4: 定稿 - User selects writing style for final article
 *
 * Targets:
 * - inputText: Text input area
 * - responsesContainer: Container for all model responses
 * - responseGrok/Qwen/Deepseek/Gemini/Zhipu: Display areas for each model
 * - copyButtonGrok/Qwen/Deepseek/Gemini/Zhipu: Copy buttons for each model
 * - draftButtonGrok/Qwen/Deepseek/Gemini/Zhipu: Draft generation buttons
 * - draftSection: Draft editing section
 * - draftContent: Draft textarea
 * - selectedModelLabel: Shows selected model name
 * - finalSection: Final article section
 * - finalArticleContainer: Final article display container
 * - finalArticle: Final article content
 * - finalStyleLabel: Shows selected style name
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
    "draftButtonGrok",
    "draftButtonQwen",
    "draftButtonDeepseek",
    "draftButtonGemini",
    "draftButtonZhipu",
    "draftSection",
    "draftContent",
    "selectedModelLabel",
    "finalSection",
    "finalArticleContainer",
    "finalArticle",
    "finalStyleLabel",
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
  declare readonly draftButtonGrokTarget: HTMLElement
  declare readonly draftButtonQwenTarget: HTMLElement
  declare readonly draftButtonDeepseekTarget: HTMLElement
  declare readonly draftButtonGeminiTarget: HTMLElement
  declare readonly draftButtonZhipuTarget: HTMLElement
  declare readonly draftSectionTarget: HTMLElement
  declare readonly draftContentTarget: HTMLTextAreaElement
  declare readonly selectedModelLabelTarget: HTMLElement
  declare readonly finalSectionTarget: HTMLElement
  declare readonly finalArticleContainerTarget: HTMLElement
  declare readonly finalArticleTarget: HTMLElement
  declare readonly finalStyleLabelTarget: HTMLElement
  declare readonly actionButtonsTarget: HTMLElement
  declare readonly streamNameValue: string
  declare readonly hasInputTextTarget: boolean

  private originalTranscript: string = ""
  private currentArticleId: number | null = null
  private selectedModel: string | null = null
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
  private draftSubscription: any = null
  private finalSubscription: any = null
  private draftContent: string = ""
  private finalContent: string = ""

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
        received: (data: any) => {
          // Handle article_id broadcast
          if (data.type === 'article-created') {
            this.currentArticleId = data.article_id
            console.log('Article created with ID:', this.currentArticleId)
          }
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
    
    // Subscribe to draft channel
    this.draftSubscription = consumer.subscriptions.create(
      {
        channel: "ArticlesChannel",
        stream_name: `${this.streamNameValue}_draft`
      },
      {
        connected: () => { console.log("Draft channel connected") },
        disconnected: () => { console.log("Draft channel disconnected") },
        received: (data: any) => {
          if (data.type === 'chunk') {
            this.handleDraftChunk(data.chunk)
          } else if (data.type === 'complete') {
            this.handleDraftComplete()
          }
        }
      }
    )
    
    // Subscribe to final channel
    this.finalSubscription = consumer.subscriptions.create(
      {
        channel: "ArticlesChannel",
        stream_name: `${this.streamNameValue}_final`
      },
      {
        connected: () => { console.log("Final channel connected") },
        disconnected: () => { console.log("Final channel disconnected") },
        received: (data: any) => {
          if (data.type === 'chunk') {
            this.handleFinalChunk(data.chunk)
          } else if (data.type === 'complete') {
            this.handleFinalComplete()
          }
        }
      }
    )
  }

  disconnect(): void {
    // Unsubscribe from command channel
    this.commandSubscription?.unsubscribe()
    this.commandSubscription = null
    
    // Unsubscribe from draft and final channels
    this.draftSubscription?.unsubscribe()
    this.draftSubscription = null
    this.finalSubscription?.unsubscribe()
    this.finalSubscription = null
    
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
    
    // Hide all draft buttons
    this.draftButtonGrokTarget.style.display = "none"
    this.draftButtonQwenTarget.style.display = "none"
    this.draftButtonDeepseekTarget.style.display = "none"
    this.draftButtonGeminiTarget.style.display = "none"
    this.draftButtonZhipuTarget.style.display = "none"

    // Trigger backend job (which will start all 5 models)
    // We only need to call this once - the backend will handle all providers
    if (this.commandSubscription) {
      this.commandSubscription.perform("generate_response", {
        transcript: this.originalTranscript,
        article_id: this.currentArticleId
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
  
  private getDraftButtonTarget(provider: string): HTMLElement | null {
    switch (provider) {
      case 'grok': return this.draftButtonGrokTarget
      case 'qwen': return this.draftButtonQwenTarget
      case 'deepseek': return this.draftButtonDeepseekTarget
      case 'gemini': return this.draftButtonGeminiTarget
      case 'zhipu': return this.draftButtonZhipuTarget
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
    
    // Show draft button for this provider
    const draftButton = this.getDraftButtonTarget(provider)
    if (draftButton) {
      draftButton.style.display = "inline-flex"
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
  
  // Generate draft using selected model
  generateDraft(event: Event): void {
    const button = event.currentTarget as HTMLElement
    const provider = button.dataset.provider
    
    if (!provider) {
      showToast("无法确定选择的模型", "danger")
      return
    }
    
    if (!this.currentArticleId) {
      showToast("文章ID不存在，请重新开始", "danger")
      return
    }
    
    this.selectedModel = provider
    
    // Update model label
    const modelNames: { [key: string]: string } = {
      grok: "Grok",
      qwen: "千问",
      deepseek: "DeepSeek",
      gemini: "Gemini",
      zhipu: "智谱"
    }
    this.selectedModelLabelTarget.textContent = modelNames[provider] || provider
    
    // Show draft section
    this.draftSectionTarget.style.display = "block"
    this.draftContent = ""
    this.draftContentTarget.value = "草稿生成中..."
    
    // Scroll to draft section
    this.draftSectionTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
    
    // Call backend to generate draft
    if (this.commandSubscription) {
      this.commandSubscription.perform("generate_draft", {
        article_id: this.currentArticleId,
        selected_model: provider
      })
    }
  }
  
  // Handle draft chunks
  private handleDraftChunk(chunk: string): void {
    this.draftContent += chunk
    this.draftContentTarget.value = this.draftContent
    // Auto-scroll to bottom
    this.draftContentTarget.scrollTop = this.draftContentTarget.scrollHeight
  }
  
  // Handle draft complete
  private handleDraftComplete(): void {
    console.log("Draft generation complete")
    showToast("初稿生成完成，您可以编辑后继续", "success")
  }
  
  // Save draft (manual save by user)
  saveDraft(): void {
    const draftText = this.draftContentTarget.value
    if (draftText && draftText.trim().length > 0) {
      this.draftContent = draftText
      showToast("草稿已保存", "success")
    }
  }
  
  // Show style selection (Step 4)
  showStyleSelection(): void {
    // Save current draft content
    this.draftContent = this.draftContentTarget.value
    
    if (!this.draftContent || this.draftContent.trim().length < 50) {
      showToast("草稿内容太短，请至少输入50个字", "warning")
      return
    }
    
    // Show final section
    this.finalSectionTarget.style.display = "block"
    this.finalSectionTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  
  // Generate final article with selected style
  generateFinal(event: Event): void {
    const button = event.currentTarget as HTMLElement
    const style = button.dataset.style
    
    if (!style) {
      showToast("无法确定选择的风格", "danger")
      return
    }
    
    if (!this.currentArticleId) {
      showToast("文章ID不存在，请重新开始", "danger")
      return
    }
    
    // Update style label
    const styleNames: { [key: string]: string } = {
      pinker: "史蒂芬·平克",
      luozhenyu: "罗振宇",
      wangxiaobo: "王小波"
    }
    this.finalStyleLabelTarget.textContent = styleNames[style] || style
    
    // Show final article container
    this.finalArticleContainerTarget.style.display = "block"
    this.finalContent = ""
    this.finalArticleTarget.innerHTML = `
      <div class="flex items-center gap-2 text-muted">
        <div class="loading-spinner w-4 h-4"></div>
        <span>正在生成定稿...</span>
      </div>
    `
    
    // Scroll to final article
    this.finalArticleContainerTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
    
    // Call backend to generate final
    if (this.commandSubscription) {
      this.commandSubscription.perform("generate_final", {
        article_id: this.currentArticleId,
        draft_content: this.draftContent,
        style: style
      })
    }
  }
  
  // Handle final chunks
  private handleFinalChunk(chunk: string): void {
    this.finalContent += chunk
    this.finalArticleTarget.textContent = this.finalContent
    // Auto-scroll to bottom
    this.finalArticleTarget.scrollTop = this.finalArticleTarget.scrollHeight
  }
  
  // Handle final complete
  private handleFinalComplete(): void {
    console.log("Final article generation complete")
    showToast("定稿生成完成！", "success")
  }
  
  // Copy final article
  copyFinal(): void {
    if (!this.finalContent || this.finalContent.trim().length === 0) {
      showToast("定稿内容为空", "warning")
      return
    }

    navigator.clipboard.writeText(this.finalContent).then(() => {
      showToast("定稿已复制到剪贴板", "success")
    }).catch(err => {
      console.error("Failed to copy:", err)
      showToast("复制失败，请手动选择并复制文本", "danger")
    })
  }

  // Reset and start over
  reset(): void {
    // Clear all content
    this.originalTranscript = ""
    this.currentArticleId = null
    this.selectedModel = null
    this.draftContent = ""
    this.finalContent = ""
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
    this.draftSectionTarget.style.display = "none"
    this.finalSectionTarget.style.display = "none"
    this.finalArticleContainerTarget.style.display = "none"
    this.actionButtonsTarget.style.display = "none"
    
    // Hide all copy buttons
    this.copyButtonGrokTarget.style.display = "none"
    this.copyButtonQwenTarget.style.display = "none"
    this.copyButtonDeepseekTarget.style.display = "none"
    this.copyButtonGeminiTarget.style.display = "none"
    this.copyButtonZhipuTarget.style.display = "none"
    
    // Hide all draft buttons
    this.draftButtonGrokTarget.style.display = "none"
    this.draftButtonQwenTarget.style.display = "none"
    this.draftButtonDeepseekTarget.style.display = "none"
    this.draftButtonGeminiTarget.style.display = "none"
    this.draftButtonZhipuTarget.style.display = "none"

    // Reset all response texts
    this.responseGrokTarget.innerHTML = ""
    this.responseQwenTarget.innerHTML = ""
    this.responseDeepseekTarget.innerHTML = ""
    this.responseGeminiTarget.innerHTML = ""
    this.responseZhipuTarget.innerHTML = ""
    
    // Reset draft and final content
    this.draftContentTarget.value = ""
    this.finalArticleTarget.innerHTML = ""

    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
}
