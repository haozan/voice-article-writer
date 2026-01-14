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
    "actionButtons",
    "historyOverlay",
    "historySidebar",
    "historyList",
    "thinkingFramework"
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
  declare readonly historyOverlayTarget: HTMLElement
  declare readonly historySidebarTarget: HTMLElement
  declare readonly historyListTarget: HTMLElement
  declare readonly thinkingFrameworkTarget: HTMLInputElement
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
    
    // Check for article_id in URL params (for "Continue Editing" feature)
    this.checkArticleIdParam()

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

    // Get selected thinking framework
    const thinkingFramework = this.getSelectedThinkingFramework()

    // Start generation process
    this.startAllModelsResponse(thinkingFramework)
  }

  private getSelectedThinkingFramework(): string {
    // Get all radio buttons with name="thinking_framework"
    const radios = document.querySelectorAll<HTMLInputElement>('input[name="thinking_framework"]')
    for (const radio of radios) {
      if (radio.checked) {
        return radio.value
      }
    }
    // Default to 'original' if nothing selected
    return 'original'
  }

  private startAllModelsResponse(thinkingFramework: string = 'original'): void {
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
        article_id: this.currentArticleId,
        thinking_framework: thinkingFramework
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
  
  // Open history sidebar
  openHistory(): void {
    try {
      // Show overlay and sidebar
      this.historyOverlayTarget.style.display = "block"
      this.historySidebarTarget.style.display = "block"
      
      // Trigger animation
      setTimeout(() => {
        this.historyOverlayTarget.style.opacity = "1"
        this.historySidebarTarget.style.transform = "translateX(0)"
      }, 10)
      
      // Load history
      this.loadHistory()
    } catch (error) {
      console.error('History feature error:', error)
      showToast("历史文章功能暂时不可用，请刷新页面", "danger")
    }
  }
  
  // Close history sidebar
  closeHistory(): void {
    this.historyOverlayTarget.style.opacity = "0"
    this.historySidebarTarget.style.transform = "translateX(100%)"
    
    setTimeout(() => {
      this.historyOverlayTarget.style.display = "none"
      this.historySidebarTarget.style.display = "none"
    }, 300)
  }
  
  // Load history from backend
  private async loadHistory(): Promise<void> {
    try {
      const response = await fetch('/articles/history')
      if (!response.ok) {
        throw new Error('Failed to load history')
      }
      
      const articles = await response.json()
      
      if (articles.length === 0) {
        this.historyListTarget.innerHTML = `
          <div class="text-center py-12 text-muted">
            <p>暂无历史文章</p>
          </div>
        `
        return
      }
      
      // Render article list
      this.historyListTarget.innerHTML = articles.map((article: any) => `
        <div class="card card-elevated p-4 mb-3 rounded-none">
          <a href="/articles/${article.id}" class="block hover:opacity-80 transition-all">
            <div class="flex items-start justify-between mb-2">
              <div class="flex-1">
                <div class="text-xs text-muted mb-1">${article.created_at}</div>
                <div class="text-sm text-secondary line-clamp-3">${article.transcript_preview}</div>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-2 mt-2">
              <span class="badge ${article.status_class} text-xs">${article.status}</span>
              ${article.archived && article.archive_info ? `
                <span class="badge badge-info text-xs flex items-center gap-1">
                  <span>📚</span>
                  <span>已归档</span>
                </span>
              ` : ''}
            </div>
            ${article.archived && article.archive_info ? `
              <div class="text-xs text-muted mt-1 line-clamp-1">
                《${article.archive_info.book_title}》→ ${article.archive_info.chapter_title}
              </div>
            ` : ''}
          </a>
          ${article.can_archive && !article.archived ? `
            <button 
              class="btn-primary btn-sm mt-3 w-full"
              data-action="click->articles#showArchiveModal"
              data-article-id="${article.id}"
            >
              📚 归档到书籍
            </button>
          ` : ''}
        </div>
      `).join('')
      
    } catch (error) {
      console.error('Error loading history:', error)
      this.historyListTarget.innerHTML = `
        <div class="text-center py-12 text-danger">
          <p>加载失败，请重试</p>
        </div>
      `
    }
  }
  
  // Check for article_id in URL params and restore article state
  private async checkArticleIdParam(): Promise<void> {
    const urlParams = new URLSearchParams(window.location.search)
    const articleId = urlParams.get('article_id')
    
    if (!articleId) return
    
    try {
      // Fetch article data
      const response = await fetch(`/articles/${articleId}.json`)
      if (!response.ok) {
        throw new Error('Article not found')
      }
      
      const article = await response.json()
      
      // Restore state
      this.currentArticleId = article.id
      this.originalTranscript = article.transcript || ""
      
      // Set input text
      if (this.hasInputTextTarget && article.transcript) {
        this.inputTextTarget.value = article.transcript
      }
      
      // Show responses container if has brainstorm
      if (article.has_brainstorm) {
        this.responsesContainerTarget.style.display = "block"
        
        // Restore brainstorm results
        const providers = ['grok', 'qwen', 'deepseek', 'gemini', 'zhipu']
        providers.forEach(provider => {
          const content = article[`brainstorm_${provider}`]
          if (content) {
            this.responseContents[provider] = content
            this.completedModels.add(provider)
            
            // Update UI
            const targetName = `response${provider.charAt(0).toUpperCase() + provider.slice(1)}Target` as keyof this
            const target = this[targetName] as HTMLElement
            if (target) {
              target.textContent = content
            }
            
            // Show buttons
            const copyButtonName = `copyButton${provider.charAt(0).toUpperCase() + provider.slice(1)}Target` as keyof this
            const draftButtonName = `draftButton${provider.charAt(0).toUpperCase() + provider.slice(1)}Target` as keyof this
            const copyButton = this[copyButtonName] as HTMLElement
            const draftButton = this[draftButtonName] as HTMLElement
            if (copyButton) copyButton.style.display = "inline-block"
            if (draftButton) draftButton.style.display = "inline-block"
          }
        })
      }
      
      // Restore draft if exists
      if (article.draft) {
        this.selectedModel = article.selected_model
        this.draftContent = article.draft
        this.draftSectionTarget.style.display = "block"
        this.draftContentTarget.value = article.draft
        
        const modelNames: { [key: string]: string } = {
          grok: "Grok", qwen: "千问", deepseek: "DeepSeek", 
          gemini: "Gemini", zhipu: "智谱"
        }
        this.selectedModelLabelTarget.textContent = modelNames[article.selected_model] || article.selected_model
      }
      
      // Restore final if exists
      if (article.final_content) {
        this.finalContent = article.final_content
        this.finalSectionTarget.style.display = "block"
        this.finalArticleContainerTarget.style.display = "block"
        this.finalArticleTarget.textContent = article.final_content
        
        const styleNames: { [key: string]: string } = {
          pinker: "史蒂芬·平克",
          luozhenyu: "罗振宇",
          wangxiaobo: "王小波"
        }
        this.finalStyleLabelTarget.textContent = styleNames[article.final_style] || article.final_style
      }
      
      // Scroll to appropriate section
      if (article.final_content) {
        this.finalSectionTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (article.draft) {
        this.draftSectionTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (article.has_brainstorm) {
        this.responsesContainerTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      
      showToast("已加载历史文章，可继续编辑", "success")
      
    } catch (error) {
      console.error('Error restoring article:', error)
      showToast("加载文章失败", "danger")
    }
  }

  // Archive article to book
  async showArchiveModal(event: Event): Promise<void> {
    const button = event.currentTarget as HTMLElement
    const articleId = button.dataset.articleId
    
    if (!articleId) {
      showToast("文章ID缺失", "danger")
      return
    }

    try {
      // Fetch available books
      const booksResponse = await fetch('/api/books')
      if (!booksResponse.ok) throw new Error('Failed to fetch books')
      const books = await booksResponse.json()

      if (books.length === 0) {
        showToast("请先创建书籍，点击右上角「我的书架」按钮", "warning")
        return
      }

      // Create modal HTML
      const modalHtml = `
        <div class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" id="archiveModal">
          <div class="card bg-white dark:bg-gray-800 max-w-2xl w-full max-h-[80vh] overflow-y-auto rounded-none">
            <div class="card-body p-6">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-xl font-bold text-gray-900 dark:text-gray-50">归档到书籍</h3>
                <button class="btn-ghost p-2" onclick="document.getElementById('archiveModal').remove()">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>

              <div class="space-y-4">
                <!-- Book Selection -->
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">选择书籍</label>
                  <select id="archiveBookSelect" class="form-select w-full">
                    <option value="">请选择...</option>
                    ${books.map((book: any) => `<option value="${book.id}">${book.title}</option>`).join('')}
                  </select>
                </div>

                <!-- Chapter Selection (hidden initially) -->
                <div id="archiveChapterContainer" class="hidden">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">选择章节</label>
                  <select id="archiveChapterSelect" class="form-select w-full">
                    <option value="">请选择...</option>
                  </select>
                </div>

                <!-- Action Buttons -->
                <div class="flex justify-end gap-3 mt-6">
                  <button class="btn-ghost" onclick="document.getElementById('archiveModal').remove()">取消</button>
                  <button id="archiveConfirmBtn" class="btn-primary" disabled>确认归档</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `

      // Insert modal into DOM
      document.body.insertAdjacentHTML('beforeend', modalHtml)

      // Setup event listeners
      const bookSelect = document.getElementById('archiveBookSelect') as HTMLSelectElement
      const chapterContainer = document.getElementById('archiveChapterContainer') as HTMLElement
      const chapterSelect = document.getElementById('archiveChapterSelect') as HTMLSelectElement
      const confirmBtn = document.getElementById('archiveConfirmBtn') as HTMLButtonElement

      // Book selection change handler
      bookSelect.addEventListener('change', async () => {
        const bookId = bookSelect.value
        
        if (!bookId) {
          chapterContainer.classList.add('hidden')
          confirmBtn.disabled = true
          return
        }

        try {
          // Fetch chapters for selected book
          const chaptersResponse = await fetch(`/api/books/${bookId}/chapters`)
          if (!chaptersResponse.ok) throw new Error('Failed to fetch chapters')
          const chapters = await chaptersResponse.json()

          if (chapters.length === 0) {
            showToast("该书籍暂无章节，请先创建章节", "warning")
            chapterContainer.classList.add('hidden')
            confirmBtn.disabled = true
            return
          }

          // Flatten chapter tree to show all levels
          const flattenChapters = (chapters: any[], result: any[] = []): any[] => {
            chapters.forEach(chapter => {
              result.push({ id: chapter.id, full_title: chapter.full_title, level: chapter.level })
              if (chapter.children && chapter.children.length > 0) {
                flattenChapters(chapter.children, result)
              }
            })
            return result
          }

          const flatChapters = flattenChapters(chapters)

          // Populate chapter dropdown with indentation
          chapterSelect.innerHTML = `<option value="">请选择...</option>${
            flatChapters.map((chapter: any) => {
              const indent = '　'.repeat(chapter.level) // Use full-width space for indentation
              return `<option value="${chapter.id}">${indent}${chapter.full_title}</option>`
            }).join('')
          }`
          
          chapterContainer.classList.remove('hidden')
          confirmBtn.disabled = true
        } catch (error) {
          console.error('Error loading chapters:', error)
          showToast("加载章节失败", "danger")
        }
      })

      // Chapter selection change handler
      chapterSelect.addEventListener('change', () => {
        confirmBtn.disabled = !chapterSelect.value
      })

      // Confirm button handler
      confirmBtn.addEventListener('click', async () => {
        const chapterId = chapterSelect.value
        
        if (!chapterId) {
          showToast("请选择章节", "warning")
          return
        }

        try {
          confirmBtn.disabled = true
          confirmBtn.textContent = '归档中...'

          const response = await fetch(`/articles/${articleId}/archive`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
            },
            body: JSON.stringify({ chapter_id: chapterId })
          })

          const result = await response.json()

          if (result.success) {
            showToast(result.message, "success")
            document.getElementById('archiveModal')?.remove()
            
            // Refresh history list
            this.loadHistory()
          } else {
            showToast(result.message, "danger")
            confirmBtn.disabled = false
            confirmBtn.textContent = '确认归档'
          }
        } catch (error) {
          console.error('Error archiving article:', error)
          showToast("归档失败", "danger")
          confirmBtn.disabled = false
          confirmBtn.textContent = '确认归档'
        }
      })

    } catch (error) {
      console.error('Error showing archive modal:', error)
      showToast("显示归档窗口失败", "danger")
    }
  }
}
