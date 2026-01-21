import BaseChannelController from "./base_channel_controller"
import { showToast } from "../toast"
import consumer from "../channels/consumer"
import { marked } from "marked"

// Configure marked.js to match server-side Redcarpet behavior
marked.setOptions({
  gfm: true,         // GitHub Flavored Markdown
  breaks: true,      // Convert \n to <br>
  pedantic: false    // Don't conform to original markdown.pl
})

// Fix malformed markdown (headers and lists)
// - "###1." -> "### 1."
// - "### title1#### title2" -> "### title1\n#### title2"
// - " -item" -> "-item" (remove leading spaces before list markers)
function fixMarkdownHeaders(text: string): string {
  // Step 1: Fix headers appearing consecutively on the same line
  // Match any character followed by # markers (not at line start), insert newline before the #
  let fixed = text.replace(/(.)#{1,6}(?=[^#\n])/g, function(match, prev, offset) {
    // Don't add newline if we're at the start or already after a newline
    if (offset === 0 || prev === '\n') return match
    return `${prev}\n${match.slice(1)}`
  })
  
  // Step 2: Add missing space after heading markers (e.g., "###text" -> "### text")
  fixed = fixed.replace(/^(#{1,6})([^\s#])/gm, '$1 $2')
  
  // Step 3: Remove leading spaces before list markers (-, *, +)
  // This fixes AI-generated lists with incorrect indentation like " -item"
  fixed = fixed.replace(/^\s+(-|\*|\+)(?=\s|\S)/gm, '$1')
  
  return fixed
}

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
 * - copyHtmlButtonGrok/Qwen/Deepseek/Gemini/Zhipu: Copy HTML buttons for each model
 * - copyMarkdownButtonGrok/Qwen/Deepseek/Gemini/Zhipu: Copy Markdown buttons for each model
 * - draftButtonGrok/Qwen/Deepseek/Gemini/Zhipu: Draft generation buttons
 * - draftSection: Draft editing section
 * - draftContent: Draft textarea
 * - selectedModelLabel: Shows selected model name
 * - finalSection: Final article section
 * - finalArticleContainer: Final article display container
 * - finalArticlePreview: Hidden div for streaming markdown display
 * - finalArticle: Editable textarea for final article content
 * - finalStyleLabel: Shows selected style name
 *
 * Values:
 * - streamName: Base stream name for this session
 */
export default class extends BaseChannelController {
  static targets = [
    "inputText",
    "charCount",
    "responsesContainer",
    "responseGrok",
    "responseQwen",
    "responseDeepseek",
    "responseGemini",
    "responseZhipu",
    "responseDoubao",
    "responseGrokEdit",
    "responseQwenEdit",
    "responseDeepseekEdit",
    "responseGeminiEdit",
    "responseZhipuEdit",
    "responseDoubaoEdit",
    "editButtonGrok",
    "editButtonQwen",
    "editButtonDeepseek",
    "editButtonGemini",
    "editButtonZhipu",
    "editButtonDoubao",
    "saveButtonGrok",
    "saveButtonQwen",
    "saveButtonDeepseek",
    "saveButtonGemini",
    "saveButtonZhipu",
    "saveButtonDoubao",
    "copyHtmlButtonGrok",
    "copyHtmlButtonQwen",
    "copyHtmlButtonDeepseek",
    "copyHtmlButtonGemini",
    "copyHtmlButtonZhipu",
    "copyHtmlButtonDoubao",
    "copyMarkdownButtonGrok",
    "copyMarkdownButtonQwen",
    "copyMarkdownButtonDeepseek",
    "copyMarkdownButtonGemini",
    "copyMarkdownButtonZhipu",
    "copyMarkdownButtonDoubao",

    "draftButtonGrok",
    "draftButtonQwen",
    "draftButtonDeepseek",
    "draftButtonGemini",
    "draftButtonZhipu",
    "draftButtonDoubao",
    "draftSection",
    "draftContent",
    "draftContentEdit",
    "draftCharCount",
    "editButtonDraft",
    "saveButtonDraft",
    "copyHtmlButtonDraft",
    "copyMarkdownButtonDraft",
    "selectedModelLabel",
    "finalSection",
    "finalArticleContainer",
    "finalArticlePreview",
    "finalArticle",
    "finalArticleEdit",
    "finalCharCount",
    "editButtonFinal",
    "saveButtonFinal",
    "copyHtmlButtonFinal",
    "copyMarkdownButtonFinal",
    "finalStyleLabel",
    "titleSection",
    "titleContainer",
    "titleList",
    "titleStyleLabel",
    "variantSection",
    "variantContainer",
    "variantText",
    "variantStyleLabel",
    "historyOverlay",
    "historySidebar",
    "historyList",
    "thinkingFramework"
  ]

  static values = {
    streamName: String
  }

  declare readonly inputTextTarget: HTMLTextAreaElement
  declare readonly charCountTarget: HTMLElement
  declare readonly responsesContainerTarget: HTMLElement
  declare readonly responseGrokTarget: HTMLElement
  declare readonly responseQwenTarget: HTMLElement
  declare readonly responseDeepseekTarget: HTMLElement
  declare readonly responseGeminiTarget: HTMLElement
  declare readonly responseZhipuTarget: HTMLElement
  declare readonly responseDoubaoTarget: HTMLElement

  declare readonly draftButtonGrokTarget: HTMLElement
  declare readonly draftButtonQwenTarget: HTMLElement
  declare readonly draftButtonDeepseekTarget: HTMLElement
  declare readonly draftButtonGeminiTarget: HTMLElement
  declare readonly draftButtonZhipuTarget: HTMLElement
  declare readonly draftButtonDoubaoTarget: HTMLElement
  declare readonly draftSectionTarget: HTMLElement
  declare readonly draftContentTarget: HTMLTextAreaElement
  declare readonly draftCharCountTarget: HTMLElement
  declare readonly selectedModelLabelTarget: HTMLElement
  declare readonly finalSectionTarget: HTMLElement
  declare readonly finalArticleContainerTarget: HTMLElement
  declare readonly finalArticlePreviewTarget: HTMLElement
  declare readonly finalArticleTarget: HTMLTextAreaElement
  declare readonly finalCharCountTarget: HTMLElement
  declare readonly finalStyleLabelTarget: HTMLElement
  declare readonly titleSectionTarget: HTMLElement
  declare readonly titleContainerTarget: HTMLElement
  declare readonly titleListTarget: HTMLElement
  declare readonly titleStyleLabelTarget: HTMLElement
  declare readonly variantSectionTarget: HTMLElement
  declare readonly variantContainerTarget: HTMLElement
  declare readonly variantTextTarget: HTMLTextAreaElement
  declare readonly variantStyleLabelTarget: HTMLElement
  declare readonly historyOverlayTarget: HTMLElement
  declare readonly historySidebarTarget: HTMLElement
  declare readonly historyListTarget: HTMLElement
  declare readonly thinkingFrameworkTarget: HTMLInputElement
  declare readonly streamNameValue: string
  declare readonly hasInputTextTarget: boolean
  declare readonly hasCharCountTarget: boolean
  declare readonly hasDraftCharCountTarget: boolean
  declare readonly hasFinalCharCountTarget: boolean

  private originalTranscript: string = ""
  private currentArticleId: number | null = null
  private selectedModel: string | null = null
  private responseContents: { [key: string]: string } = {
    grok: "",
    qwen: "",
    deepseek: "",
    gemini: "",
    zhipu: "",
    doubao: ""
  }
  private completedModels: Set<string> = new Set()
  private subscriptions: { [key: string]: any } = {}
  private commandSubscription: any = null
  private draftSubscription: any = null
  private finalSubscription: any = null
  private titleSubscription: any = null
  private variantSubscription: any = null
  private draftContent: string = ""
  private finalContent: string = ""
  private titleContent: string = ""
  private variantContent: string = ""
  private responseEditMode: { [key: string]: boolean } = {
    grok: false,
    qwen: false,
    deepseek: false,
    gemini: false,
    zhipu: false,
    doubao: false
  }
  private draftEditMode: boolean = false
  private finalEditMode: boolean = false

  connect(): void {
    console.log("Articles controller connected")
    
    // Initialize character count
    this.updateCharCount()
    
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
          } else if (data.type === 'final-saved') {
            showToast("定稿已保存", "success")
          } else if (data.type === 'draft-saved') {
            showToast("草稿已保存", "success")
          } else if (data.type === 'title-saved') {
            showToast("标题已保存", "success")
          } else if (data.type === 'variant-saved') {
            showToast("变体已保存", "success")
          }
        }
      }
    )

    // Subscribe to WebSocket channels for all 6 models (for receiving responses)
    const providers = ['grok', 'qwen', 'deepseek', 'gemini', 'zhipu', 'doubao']
    
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
    
    // Subscribe to title channel
    this.titleSubscription = consumer.subscriptions.create(
      {
        channel: "ArticlesChannel",
        stream_name: `${this.streamNameValue}_title`
      },
      {
        connected: () => { console.log("Title channel connected") },
        disconnected: () => { console.log("Title channel disconnected") },
        received: (data: any) => {
          if (data.type === 'chunk') {
            this.handleTitleChunk(data.chunk)
          } else if (data.type === 'complete') {
            this.handleTitleComplete()
          } else if (data.type === 'error') {
            this.handleTitleError(data.message)
          }
        }
      }
    )
    
    // Subscribe to variant channel
    this.variantSubscription = consumer.subscriptions.create(
      {
        channel: "ArticlesChannel",
        stream_name: `${this.streamNameValue}_variant`
      },
      {
        connected: () => { console.log("Variant channel connected") },
        disconnected: () => { console.log("Variant channel disconnected") },
        received: (data: any) => {
          if (data.type === 'chunk') {
            this.handleVariantChunk(data.chunk)
          } else if (data.type === 'complete') {
            this.handleVariantComplete()
          } else if (data.type === 'error') {
            this.handleVariantError(data.message)
          }
        }
      }
    )
  }

  disconnect(): void {
    // Unsubscribe from command channel
    this.commandSubscription?.unsubscribe()
    this.commandSubscription = null
    
    // Unsubscribe from draft, final, title, and variant channels
    this.draftSubscription?.unsubscribe()
    this.draftSubscription = null
    this.finalSubscription?.unsubscribe()
    this.finalSubscription = null
    this.titleSubscription?.unsubscribe()
    this.titleSubscription = null
    this.variantSubscription?.unsubscribe()
    this.variantSubscription = null
    
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

  // Update character count when user types in input textarea
  updateCharCount(): void {
    if (!this.hasInputTextTarget || !this.hasCharCountTarget) {
      return
    }
    
    const text = this.inputTextTarget.value
    const charCount = text.length
    this.charCountTarget.textContent = charCount.toString()
  }

  // Update draft character count
  private updateDraftCharCount(): void {
    if (!this.hasDraftCharCountTarget) {
      return
    }
    
    const charCount = this.draftContent.length
    this.draftCharCountTarget.textContent = charCount.toString()
  }

  // Update final character count
  private updateFinalCharCount(): void {
    if (!this.hasFinalCharCountTarget) {
      return
    }
    
    const charCount = this.finalContent.length
    this.finalCharCountTarget.textContent = charCount.toString()
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

    // CRITICAL: Clear article_id to create a new article
    // Every "Start Conversation" click should create a NEW article
    this.currentArticleId = null
    console.log('Starting new conversation, article_id cleared')

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
      zhipu: "",
      doubao: ""
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
    this.resetResponseArea("doubao", "豆包思考中...")

    // Hide all copy buttons (edit, save, copyHtml, copyMarkdown buttons are hidden by default with style="display: none")
    
    // Hide all draft buttons
    this.draftButtonGrokTarget.style.display = "none"
    this.draftButtonQwenTarget.style.display = "none"
    this.draftButtonDeepseekTarget.style.display = "none"
    this.draftButtonGeminiTarget.style.display = "none"
    this.draftButtonZhipuTarget.style.display = "none"
    this.draftButtonDoubaoTarget.style.display = "none"

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
      case 'doubao': return this.responseDoubaoTarget
      default: return null
    }
  }


  
  private getEditButtonTarget(provider: string): HTMLElement | null {
    switch (provider) {
      case 'grok': return (this as any).editButtonGrokTarget
      case 'qwen': return (this as any).editButtonQwenTarget
      case 'deepseek': return (this as any).editButtonDeepseekTarget
      case 'gemini': return (this as any).editButtonGeminiTarget
      case 'zhipu': return (this as any).editButtonZhipuTarget
      case 'doubao': return (this as any).editButtonDoubaoTarget
      default: return null
    }
  }
  
  private getSaveButtonTarget(provider: string): HTMLElement | null {
    switch (provider) {
      case 'grok': return (this as any).saveButtonGrokTarget
      case 'qwen': return (this as any).saveButtonQwenTarget
      case 'deepseek': return (this as any).saveButtonDeepseekTarget
      case 'gemini': return (this as any).saveButtonGeminiTarget
      case 'zhipu': return (this as any).saveButtonZhipuTarget
      case 'doubao': return (this as any).saveButtonDoubaoTarget
      default: return null
    }
  }
  
  private getCopyHtmlButtonTarget(provider: string): HTMLElement | null {
    switch (provider) {
      case 'grok': return (this as any).copyHtmlButtonGrokTarget
      case 'qwen': return (this as any).copyHtmlButtonQwenTarget
      case 'deepseek': return (this as any).copyHtmlButtonDeepseekTarget
      case 'gemini': return (this as any).copyHtmlButtonGeminiTarget
      case 'zhipu': return (this as any).copyHtmlButtonZhipuTarget
      case 'doubao': return (this as any).copyHtmlButtonDoubaoTarget
      default: return null
    }
  }
  
  private getCopyMarkdownButtonTarget(provider: string): HTMLElement | null {
    switch (provider) {
      case 'grok': return (this as any).copyMarkdownButtonGrokTarget
      case 'qwen': return (this as any).copyMarkdownButtonQwenTarget
      case 'deepseek': return (this as any).copyMarkdownButtonDeepseekTarget
      case 'gemini': return (this as any).copyMarkdownButtonGeminiTarget
      case 'zhipu': return (this as any).copyMarkdownButtonZhipuTarget
      case 'doubao': return (this as any).copyMarkdownButtonDoubaoTarget
      default: return null
    }
  }
  
  private getResponseEditTarget(provider: string): HTMLTextAreaElement | null {
    switch (provider) {
      case 'grok': return (this as any).responseGrokEditTarget
      case 'qwen': return (this as any).responseQwenEditTarget
      case 'deepseek': return (this as any).responseDeepseekEditTarget
      case 'gemini': return (this as any).responseGeminiEditTarget
      case 'zhipu': return (this as any).responseZhipuEditTarget
      case 'doubao': return (this as any).responseDoubaoEditTarget
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
      case 'doubao': return this.draftButtonDoubaoTarget
      default: return null
    }
  }

  // Handle streaming chunks for a specific provider
  private handleChunkForProvider(provider: string, chunk: string): void {
    this.responseContents[provider] += chunk
    const target = this.getResponseTarget(provider)
    
    if (target) {
      // Render Markdown to HTML (same as save and history loading)
      const fixedMarkdown = fixMarkdownHeaders(this.responseContents[provider])
      target.innerHTML = marked.parse(fixedMarkdown) as string
      // Auto-scroll to bottom
      target.scrollTop = target.scrollHeight
    }
  }

  // Handle completion for a specific provider
  private handleCompleteForProvider(provider: string): void {
    console.log(`${provider} response complete`)
    this.completedModels.add(provider)
    
    // Show edit, copy HTML, copy markdown, and draft buttons
    const editButton = this.getEditButtonTarget(provider)
    const copyHtmlButton = this.getCopyHtmlButtonTarget(provider)
    const copyMarkdownButton = this.getCopyMarkdownButtonTarget(provider)
    const draftButton = this.getDraftButtonTarget(provider)
    
    if (editButton) editButton.style.display = "inline-flex"
    if (copyHtmlButton) copyHtmlButton.style.display = "inline-flex"
    if (copyMarkdownButton) copyMarkdownButton.style.display = "inline-flex"
    if (draftButton) draftButton.style.display = "inline-flex"

    // All models complete (5 models, Doubao hidden)
    if (this.completedModels.size === 5) {
      // All responses generated
    }
  }

  // Handle errors for a specific provider
  private handleErrorForProvider(provider: string, message: string): void {
    console.error(`${provider} generation error:`, message)
    
    const target = this.getResponseTarget(provider)
    
    if (target) {
      // 显示友好的错误消息
      const errorPath = "M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 " +
        "1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 " +
        "00-1.414-1.414L10 8.586 8.707 7.293z"
      target.innerHTML = `
        <div class="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <svg class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="${errorPath}" clip-rule="evenodd"/>
          </svg>
          <div class="flex-1">
            <p class="text-sm font-medium text-red-800 dark:text-red-200">生成失败</p>
            <p class="text-sm text-red-700 dark:text-red-300 mt-1">${message}</p>
          </div>
        </div>
      `
    }
    
    // 标记为完成（虽然失败）
    this.completedModels.add(provider)
    
    // All models complete (including errors) (5 models, Doubao hidden)
    if (this.completedModels.size === 5) {
      // All responses generated
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
  
  // Edit a specific provider's response
  editResponse(event: Event): void {
    const button = event.currentTarget as HTMLElement
    const provider = button.dataset.provider
    
    if (!provider) return
    
    const responseDiv = this.getResponseTarget(provider)
    const responseEdit = this.getResponseEditTarget(provider)
    const editButton = this.getEditButtonTarget(provider)
    const saveButton = this.getSaveButtonTarget(provider)
    const copyHtmlButton = this.getCopyHtmlButtonTarget(provider)
    const copyMarkdownButton = this.getCopyMarkdownButtonTarget(provider)
    const draftButton = this.getDraftButtonTarget(provider)
    
    if (!responseDiv || !responseEdit) return
    
    // Switch to edit mode
    this.responseEditMode[provider] = true
    responseDiv.style.display = "none"
    responseEdit.style.display = "block"
    responseEdit.value = this.responseContents[provider]
    
    // Switch buttons
    if (editButton) editButton.style.display = "none"
    if (saveButton) saveButton.style.display = "inline-flex"
    if (copyHtmlButton) copyHtmlButton.style.display = "none"
    if (copyMarkdownButton) copyMarkdownButton.style.display = "none"
    if (draftButton) draftButton.style.display = "none"
  }
  
  // Save edited response
  saveResponse(event: Event): void {
    const button = event.currentTarget as HTMLElement
    const provider = button.dataset.provider
    
    if (!provider) return
    
    const responseDiv = this.getResponseTarget(provider)
    const responseEdit = this.getResponseEditTarget(provider)
    const editButton = this.getEditButtonTarget(provider)
    const saveButton = this.getSaveButtonTarget(provider)
    const copyHtmlButton = this.getCopyHtmlButtonTarget(provider)
    const copyMarkdownButton = this.getCopyMarkdownButtonTarget(provider)
    const draftButton = this.getDraftButtonTarget(provider)
    
    if (!responseDiv || !responseEdit) return
    
    // Update content
    this.responseContents[provider] = responseEdit.value
    // Render Markdown to HTML (same as loading from history)
    const fixedMarkdown = fixMarkdownHeaders(this.responseContents[provider])
    responseDiv.innerHTML = marked.parse(fixedMarkdown) as string
    
    // Switch back to view mode
    this.responseEditMode[provider] = false
    responseDiv.style.display = "block"
    responseEdit.style.display = "none"
    
    // Switch buttons
    if (editButton) editButton.style.display = "inline-flex"
    if (saveButton) saveButton.style.display = "none"
    if (copyHtmlButton) copyHtmlButton.style.display = "inline-flex"
    if (copyMarkdownButton) copyMarkdownButton.style.display = "inline-flex"
    if (draftButton) draftButton.style.display = "inline-flex"
    
    showToast("已保存", "success")
  }
  
  // Copy response HTML (with styles)
  copyResponseHtml(event: Event): void {
    const button = event.currentTarget as HTMLElement
    const provider = button.dataset.provider
    
    if (!provider) return
    
    const responseDiv = this.getResponseTarget(provider)
    if (!responseDiv) return
    
    const htmlContent = responseDiv.innerHTML
    
    navigator.clipboard.writeText(htmlContent).then(() => {
      showToast("已复制HTML", "success")
    }).catch(err => {
      console.error("Failed to copy:", err)
      showToast("复制失败", "danger")
    })
  }
  
  // Copy response Markdown
  copyResponseMarkdown(event: Event): void {
    const button = event.currentTarget as HTMLElement
    const provider = button.dataset.provider
    
    if (!provider || !this.responseContents[provider]) return
    
    navigator.clipboard.writeText(this.responseContents[provider]).then(() => {
      showToast("已复制Markdown", "success")
    }).catch(err => {
      console.error("Failed to copy:", err)
      showToast("复制失败", "danger")
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
      zhipu: "智谱",
      doubao: "豆包"
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
    // During streaming: show raw text to avoid re-rendering Markdown every time
    const draftDiv = (this as any).draftContentTarget as HTMLElement
    if (draftDiv) {
      draftDiv.textContent = this.draftContent
      // Auto-scroll to bottom
      draftDiv.scrollTop = draftDiv.scrollHeight
    }
    // Update character count during streaming
    this.updateDraftCharCount()
  }
  
  // Handle draft complete
  private handleDraftComplete(): void {
    console.log("Draft generation complete")
    
    // Render final Markdown after streaming completes
    const draftDiv = (this as any).draftContentTarget as HTMLElement
    if (draftDiv) {
      const fixedMarkdown = fixMarkdownHeaders(this.draftContent)
      draftDiv.innerHTML = marked.parse(fixedMarkdown) as string
    }
    
    // Update final character count
    this.updateDraftCharCount()
    
    showToast("初稿生成完成，您可以编辑后继续", "success")
    
    // Show edit, copy HTML, copy markdown buttons
    const editButton = (this as any).editButtonDraftTarget as HTMLElement
    const copyHtmlButton = (this as any).copyHtmlButtonDraftTarget as HTMLElement
    const copyMarkdownButton = (this as any).copyMarkdownButtonDraftTarget as HTMLElement
    
    if (editButton) editButton.style.display = "inline-flex"
    if (copyHtmlButton) copyHtmlButton.style.display = "inline-flex"
    if (copyMarkdownButton) copyMarkdownButton.style.display = "inline-flex"
  }
  
  // Edit draft
  editDraft(): void {
    const draftDiv = (this as any).draftContentTarget as HTMLElement
    const draftEdit = (this as any).draftContentEditTarget as HTMLTextAreaElement
    const editButton = (this as any).editButtonDraftTarget as HTMLElement
    const saveButton = (this as any).saveButtonDraftTarget as HTMLElement
    const copyHtmlButton = (this as any).copyHtmlButtonDraftTarget as HTMLElement
    const copyMarkdownButton = (this as any).copyMarkdownButtonDraftTarget as HTMLElement
    
    if (!draftDiv || !draftEdit) return
    
    // Switch to edit mode
    this.draftEditMode = true
    draftDiv.style.display = "none"
    draftEdit.style.display = "block"
    draftEdit.value = this.draftContent
    
    // Switch buttons
    if (editButton) editButton.style.display = "none"
    if (saveButton) saveButton.style.display = "inline-flex"
    if (copyHtmlButton) copyHtmlButton.style.display = "none"
    if (copyMarkdownButton) copyMarkdownButton.style.display = "none"
  }
  
  // Copy draft HTML
  copyDraftHtml(): void {
    const draftDiv = (this as any).draftContentTarget as HTMLElement
    if (!draftDiv) return
    
    const htmlContent = draftDiv.innerHTML
    
    navigator.clipboard.writeText(htmlContent).then(() => {
      showToast("已复制HTML", "success")
    }).catch(err => {
      console.error("Failed to copy:", err)
      showToast("复制失败", "danger")
    })
  }
  
  // Copy draft Markdown
  copyDraftMarkdown(): void {
    if (!this.draftContent) {
      showToast("草稿内容为空", "warning")
      return
    }
    
    navigator.clipboard.writeText(this.draftContent).then(() => {
      showToast("已复制Markdown", "success")
    }).catch(err => {
      console.error("Failed to copy:", err)
      showToast("复制失败", "danger")
    })
  }
  
  // Save draft (after user edits)
  saveDraft(): void {
    const draftDiv = (this as any).draftContentTarget as HTMLElement
    const draftEdit = (this as any).draftContentEditTarget as HTMLTextAreaElement
    const editButton = (this as any).editButtonDraftTarget as HTMLElement
    const saveButton = (this as any).saveButtonDraftTarget as HTMLElement
    const copyHtmlButton = (this as any).copyHtmlButtonDraftTarget as HTMLElement
    const copyMarkdownButton = (this as any).copyMarkdownButtonDraftTarget as HTMLElement
    
    if (!draftDiv || !draftEdit) return
    
    const draftText = draftEdit.value.trim()
    if (!draftText || draftText.length === 0) {
      showToast("草稿内容为空", "warning")
      return
    }
    
    if (!this.currentArticleId) {
      showToast("文章ID不存在，无法保存", "danger")
      return
    }
    
    // Update local state and render
    this.draftContent = draftText
    const fixedMarkdown = fixMarkdownHeaders(this.draftContent)
    draftDiv.innerHTML = marked.parse(fixedMarkdown) as string
    
    // Update character count after saving
    this.updateDraftCharCount()
    
    // Switch back to view mode
    this.draftEditMode = false
    draftDiv.style.display = "block"
    draftEdit.style.display = "none"
    
    // Switch buttons
    if (editButton) editButton.style.display = "inline-flex"
    if (saveButton) saveButton.style.display = "none"
    if (copyHtmlButton) copyHtmlButton.style.display = "inline-flex"
    if (copyMarkdownButton) copyMarkdownButton.style.display = "inline-flex"
    
    // Send to backend
    if (this.commandSubscription) {
      this.commandSubscription.perform("save_draft", {
        article_id: this.currentArticleId,
        draft_content: draftText
      })
    }
  }
  
  // Show style selection (Step 4)
  showStyleSelection(): void {
    // Check if draft content exists and is sufficient
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
    this.finalArticleTarget.value = "定稿生成中..."
    
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
    // During streaming: show raw text to avoid re-rendering Markdown every time
    const finalDiv = (this as any).finalArticleTarget as HTMLElement
    if (finalDiv && finalDiv.classList.contains('prose')) {
      finalDiv.textContent = this.finalContent
      // Auto-scroll to bottom
      finalDiv.scrollTop = finalDiv.scrollHeight
    }
    // Update character count during streaming
    this.updateFinalCharCount()
  }
  
  // Handle final complete
  private handleFinalComplete(): void {
    console.log("Final article generation complete")
    
    // Render final Markdown after streaming completes
    const finalDiv = (this as any).finalArticleTarget as HTMLElement
    if (finalDiv && finalDiv.classList.contains('prose')) {
      const fixedMarkdown = fixMarkdownHeaders(this.finalContent)
      finalDiv.innerHTML = marked.parse(fixedMarkdown) as string
    }
    
    // Update final character count
    this.updateFinalCharCount()
    
    showToast("定稿生成完成！", "success")
    
    // Show edit, copy HTML, copy markdown buttons
    const editButton = (this as any).editButtonFinalTarget as HTMLElement
    const copyHtmlButton = (this as any).copyHtmlButtonFinalTarget as HTMLElement
    const copyMarkdownButton = (this as any).copyMarkdownButtonFinalTarget as HTMLElement
    
    if (editButton) editButton.style.display = "inline-flex"
    if (copyHtmlButton) copyHtmlButton.style.display = "inline-flex"
    if (copyMarkdownButton) copyMarkdownButton.style.display = "inline-flex"
    
    // Show Step 5: Title Generation Section
    this.titleSectionTarget.style.display = "block"
    this.titleSectionTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  
  // Edit final article
  editFinal(): void {
    const finalDiv = (this as any).finalArticleTarget as HTMLElement
    const finalEdit = (this as any).finalArticleEditTarget as HTMLTextAreaElement
    const editButton = (this as any).editButtonFinalTarget as HTMLElement
    const saveButton = (this as any).saveButtonFinalTarget as HTMLElement
    const copyHtmlButton = (this as any).copyHtmlButtonFinalTarget as HTMLElement
    const copyMarkdownButton = (this as any).copyMarkdownButtonFinalTarget as HTMLElement
    
    if (!finalDiv || !finalEdit) return
    
    // Switch to edit mode
    this.finalEditMode = true
    finalDiv.style.display = "none"
    finalEdit.style.display = "block"
    finalEdit.value = this.finalContent
    
    // Switch buttons
    if (editButton) editButton.style.display = "none"
    if (saveButton) saveButton.style.display = "inline-flex"
    if (copyHtmlButton) copyHtmlButton.style.display = "none"
    if (copyMarkdownButton) copyMarkdownButton.style.display = "none"
  }
  
  // Copy final HTML
  copyFinalHtml(): void {
    const finalDiv = (this as any).finalArticleTarget as HTMLElement
    if (!finalDiv) return
    
    const htmlContent = finalDiv.innerHTML
    
    navigator.clipboard.writeText(htmlContent).then(() => {
      showToast("已复制HTML", "success")
    }).catch(err => {
      console.error("Failed to copy:", err)
      showToast("复制失败", "danger")
    })
  }
  
  // Copy final Markdown
  copyFinalMarkdown(): void {
    if (!this.finalContent) {
      showToast("定稿内容为空", "warning")
      return
    }
    
    navigator.clipboard.writeText(this.finalContent).then(() => {
      showToast("已复制Markdown", "success")
    }).catch(err => {
      console.error("Failed to copy:", err)
      showToast("复制失败", "danger")
    })
  }
  
  // Copy final article (deprecated, for backward compatibility)
  copyFinal(): void {
    const finalText = this.finalArticleTarget.value.trim()
    if (!finalText || finalText.length === 0) {
      showToast("定稿内容为空", "warning")
      return
    }

    navigator.clipboard.writeText(finalText).then(() => {
      showToast("定稿已复制到剪贴板", "success")
    }).catch(err => {
      console.error("Failed to copy:", err)
      showToast("复制失败，请手动选择并复制文本", "danger")
    })
  }
  
  // Save final article (after user edits)
  saveFinal(): void {
    const finalDiv = (this as any).finalArticleTarget as HTMLElement
    const finalEdit = (this as any).finalArticleEditTarget as HTMLTextAreaElement
    const editButton = (this as any).editButtonFinalTarget as HTMLElement
    const saveButton = (this as any).saveButtonFinalTarget as HTMLElement
    const copyHtmlButton = (this as any).copyHtmlButtonFinalTarget as HTMLElement
    const copyMarkdownButton = (this as any).copyMarkdownButtonFinalTarget as HTMLElement
    
    if (!finalDiv || !finalEdit) return
    
    const finalText = finalEdit.value.trim()
    if (!finalText || finalText.length === 0) {
      showToast("定稿内容为空", "warning")
      return
    }
    
    if (!this.currentArticleId) {
      showToast("文章ID不存在，无法保存", "danger")
      return
    }
    
    // Update local state and render
    this.finalContent = finalText
    const fixedMarkdown = fixMarkdownHeaders(this.finalContent)
    finalDiv.innerHTML = marked.parse(fixedMarkdown) as string
    
    // Update character count after saving
    this.updateFinalCharCount()
    
    // Switch back to view mode
    this.finalEditMode = false
    finalDiv.style.display = "block"
    finalEdit.style.display = "none"
    
    // Switch buttons
    if (editButton) editButton.style.display = "inline-flex"
    if (saveButton) saveButton.style.display = "none"
    if (copyHtmlButton) copyHtmlButton.style.display = "inline-flex"
    if (copyMarkdownButton) copyMarkdownButton.style.display = "inline-flex"
    
    // Send to backend
    if (this.commandSubscription) {
      this.commandSubscription.perform("save_final", {
        article_id: this.currentArticleId,
        final_content: finalText
      })
    }
  }

  // Reset and start over
  reset(): void {
    // Clear all content
    this.originalTranscript = ""
    this.currentArticleId = null
    this.selectedModel = null
    this.draftContent = ""
    this.finalContent = ""
    this.titleContent = ""
    this.variantContent = ""
    this.responseContents = {
      grok: "",
      qwen: "",
      deepseek: "",
      gemini: "",
      zhipu: "",
      doubao: ""
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
    this.titleSectionTarget.style.display = "none"
    this.titleContainerTarget.style.display = "none"
    this.variantSectionTarget.style.display = "none"
    this.variantContainerTarget.style.display = "none"
    
    // Hide all draft buttons (other buttons are hidden by default with style="display: none")
    this.draftButtonGrokTarget.style.display = "none"
    this.draftButtonQwenTarget.style.display = "none"
    this.draftButtonDeepseekTarget.style.display = "none"
    this.draftButtonGeminiTarget.style.display = "none"
    this.draftButtonZhipuTarget.style.display = "none"
    this.draftButtonDoubaoTarget.style.display = "none"

    // Reset all response texts
    this.responseGrokTarget.innerHTML = ""
    this.responseQwenTarget.innerHTML = ""
    this.responseDeepseekTarget.innerHTML = ""
    this.responseGeminiTarget.innerHTML = ""
    this.responseZhipuTarget.innerHTML = ""
    this.responseDoubaoTarget.innerHTML = ""
    
    // Reset draft, final and variant content
    const draftDiv = (this as any).draftContentTarget as HTMLElement
    const finalDiv = (this as any).finalArticleTarget as HTMLElement
    if (draftDiv) draftDiv.innerHTML = '<p class="text-muted">草稿生成中...</p>'
    if (finalDiv) finalDiv.innerHTML = '<p class="text-muted">定稿生成中...</p>'
    this.variantTextTarget.value = ""

    // Scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  
  // Step 5: Generate viral title with selected style
  generateTitle(event: Event): void {
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
      mimeng: "迷蒙体",
      normal: "普通风格"
    }
    this.titleStyleLabelTarget.textContent = styleNames[style] || style
    
    // CRITICAL: Clear old content and reset state
    this.titleContent = ""
    this.titleListTarget.innerHTML = '<p class="text-muted">标题生成中...</p>'
    
    // Show title container
    this.titleContainerTarget.style.display = "block"
    
    // Scroll to title container
    this.titleContainerTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
    
    // Call backend to generate title
    if (this.commandSubscription) {
      this.commandSubscription.perform("generate_title", {
        article_id: this.currentArticleId,
        final_content: this.finalContent,
        style: style
      })
    }
  }
  
  // Handle title chunks
  private handleTitleChunk(chunk: string): void {
    this.titleContent += chunk
    
    // Split by newlines to get individual titles
    const lines = this.titleContent.split('\n').filter(line => line.trim().length > 0)
    
    // Update display with formatted titles
    if (lines.length > 0) {
      this.titleListTarget.innerHTML = lines.map((title, index) => 
        `<div class="flex items-start gap-3 p-3 bg-surface/50 hover:bg-primary/5 transition-colors rounded-none border border-border/50">
          <span class="text-primary font-bold text-xl flex-shrink-0">${index + 1}.</span>
          <p class="flex-1 text-foreground">${this.escapeHtml(title)}</p>
          <button 
            class="btn-sm btn-secondary flex-shrink-0" 
            onclick="navigator.clipboard.writeText('${this.escapeHtml(title).replace(/'/g, "\\'")}')
              .then(() => window.showToast('已复制', 'success'))
              .catch(() => window.showToast('复制失败', 'danger'))"
          >
            ${this.getCopyIcon()}
          </button>
        </div>`
      ).join('')
    }
  }
  
  // Handle title complete
  private handleTitleComplete(): void {  
    console.log("Title generation complete")
    
    // 如果没有换行符,使用智能分割
    if (!this.titleContent.includes('\n') && this.titleContent.length > 0) {
      console.log("Titles without line breaks detected, applying smart split")
      const splitTitles = this.smartSplitTitles(this.titleContent)
      
      // 用换行符连接分割后的标题
      this.titleContent = splitTitles.join('\n')
      
      // 重新渲染
      const lines = splitTitles.filter(line => line.trim().length > 0)
      if (lines.length > 0) {
        this.titleListTarget.innerHTML = lines.map((title, index) => 
          `<div class="flex items-start gap-3 p-3 bg-surface/50 hover:bg-primary/5 transition-colors rounded-none border border-border/50">
            <span class="text-primary font-bold text-xl flex-shrink-0">${index + 1}.</span>
            <p class="flex-1 text-foreground">${this.escapeHtml(title)}</p>
            <button 
              class="btn-sm btn-secondary flex-shrink-0" 
              onclick="navigator.clipboard.writeText('${this.escapeHtml(title).replace(/'/g, "\\'")}')  
                .then(() => window.showToast('已复制', 'success'))
                .catch(() => window.showToast('复制失败', 'danger'))"
            >
              ${this.getCopyIcon()}
            </button>
          </div>`
        ).join('')
      }
    }
    
    showToast("标题生成完成！", "success")
    
    // Show Step 6: Variant Generation Section
    this.variantSectionTarget.style.display = "block"
    this.variantSectionTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  
  // Smart split titles without line breaks
  // 智能分割没有换行符的标题文本
  private smartSplitTitles(content: string): string[] {
    console.log('Original content:', content)
    
    // 策略1: 查找完整的句子作为标题
    // 标题通常以完整的句子结尾(。！？等)，且长度在15-50字之间
    const sentencePattern = /[^。！？\n]+[。！？]/g
    const sentences = content.match(sentencePattern)
    
    if (sentences && sentences.length >= 3) {
      const titles = sentences
        .map(s => s.trim())
        .filter(s => s.length >= 10 && s.length <= 80)
      
      if (titles.length >= 3 && titles.length <= 15) {
        console.log(`Successfully split into ${titles.length} titles by sentences`)
        return titles
      }
    }
    
    // 策略2: 如果句子太少，尝试识别没有标点符号结尾的标题
    // 通过识别常见的标题起始模式
    const heuristicTitles = this.heuristicSplit(content)
    if (heuristicTitles.length >= 3 && heuristicTitles.length <= 15) {
      console.log(`Split into ${heuristicTitles.length} titles by heuristics`)
      return heuristicTitles
    }
    
    // 策略3: 固定长度分割(最后的手段)
    console.warn(`Using fallback: fixed length split`)
    return this.fixedLengthSplit(content, 5)
  }
  
  // 启发式分割:基于常见的标题起始模式
  private heuristicSplit(content: string): string[] {
    // 常见的标题起始模式
    const titleStartPatterns = [
      /\d+[年月日天]/,              // "6年", "2个月", "3天"
      /^那些/,                       // "那些"
      /^这些/,                       // "这些"
      /^你以为/,                     // "你以为"
      /^为什么/,                     // "为什么"
      /^如何/,                       // "如何"
      /^什么/,                       // "什么"
      /^[^，。！？]{0,10}的我/,      // "独立开发者的我"
      /^当[^，]{0,5}[后时]/,         // "当...后", "当...时"
      /^从[^到]{0,8}到/,             // "从...到..."
    ]
    
    // 查找所有可能的标题起始位置
    const splitPoints: number[] = [0] // 第一个标题从0开始
    
    for (let i = 1; i < content.length; i++) {
      const remaining = content.substring(i)
      
      // 检查当前位置是否匹配任何标题起始模式
      for (const pattern of titleStartPatterns) {
        if (pattern.test(remaining)) {
          // 确保前一个字符是合理的结束点(不是句子中间)
          const prevChar = content[i - 1]
          const isPrevEndPoint = /[。！？了\s]|[a-zA-Z]/.test(prevChar)
          
          // 确保距离上一个分割点至少10个字符(避免过短的标题)
          const lastSplit = splitPoints[splitPoints.length - 1]
          const distance = i - lastSplit
          
          if (isPrevEndPoint && distance >= 10) {
            splitPoints.push(i)
            break
          }
        }
      }
    }
    
    // 根据分割点提取标题
    const titles: string[] = []
    for (let i = 0; i < splitPoints.length; i++) {
      const start = splitPoints[i]
      const end = i < splitPoints.length - 1 ? splitPoints[i + 1] : content.length
      const title = content.substring(start, end).trim()
      
      if (title.length >= 10 && title.length <= 100) {
        titles.push(title)
      }
    }
    
    console.log(`Heuristic split found ${titles.length} titles at positions:`, splitPoints)
    return titles
  }
  
  // 检查是否是新句子的开始
  private isNewSentenceStart(char: string): boolean {
    // 中文字符、数字、大写字母等通常是新句子的开始
    return /[\u4e00-\u9fa5A-Z0-9]/.test(char)
  }
  
  // Fallback: 固定长度分割
  private fixedLengthSplit(content: string, targetCount: number): string[] {
    const avgLength = Math.floor(content.length / targetCount)
    const titles: string[] = []
    
    for (let i = 0; i < targetCount; i++) {
      const start = i * avgLength
      const end = i === targetCount - 1 ? content.length : (i + 1) * avgLength
      const segment = content.substring(start, end).trim()
      
      if (segment.length > 0) {
        titles.push(segment)
      }
    }
    
    return titles
  }
  
  // Handle title error
  private handleTitleError(message: string): void {
    console.error("Title generation error:", message)
    
    // Clear the "生成中..." placeholder
    this.titleListTarget.innerHTML = ""
    
    // Hide title container to allow user to retry
    this.titleContainerTarget.style.display = "none"
    
    // Show error toast
    showToast(message || "标题生成失败，请稍后重试", "danger")
  }
  
  // Copy all titles
  copyAllTitles(): void {
    const lines = this.titleContent.split('\n').filter(line => line.trim().length > 0)
    
    if (lines.length === 0) {
      showToast("标题内容为空", "warning")
      return
    }

    const allTitles = lines.map((title, index) => `${index + 1}. ${title}`).join('\n\n')
    
    navigator.clipboard.writeText(allTitles).then(() => {
      showToast("所有标题已复制到剪贴板", "success")
    }).catch(err => {
      console.error("Failed to copy:", err)
      showToast("复制失败，请手动选择并复制文本", "danger")
    })
  }
  
  // Helper: Escape HTML
  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
  
  // Helper: Get copy icon SVG
  private getCopyIcon(): string {
    return '<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>'
  }
  
  // Step 6: Generate variant with selected style
  generateVariant(event: Event): void {
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
      xiaolvshu: "小绿书",
      xiaohongshu: "小红书"
    }
    this.variantStyleLabelTarget.textContent = styleNames[style] || style
    
    // Show variant container
    this.variantContainerTarget.style.display = "block"
    this.variantContent = ""
    this.variantTextTarget.value = "变体生成中..."
    
    // Scroll to variant container
    this.variantContainerTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
    
    // Call backend to generate variant
    // 后端会从数据库读取完整的定稿文章，确保内容完整
    if (this.commandSubscription) {
      this.commandSubscription.perform("generate_variant", {
        article_id: this.currentArticleId,
        style: style
      })
    }
  }
  
  // Handle variant chunks
  private handleVariantChunk(chunk: string): void {
    // 如果之前是错误状态，清空并重新开始
    if (this.variantTextTarget.disabled) {
      this.variantTextTarget.disabled = false
      this.variantContent = ""
    }
    
    this.variantContent += chunk
    // Update textarea with variant text
    this.variantTextTarget.value = this.variantContent
    // Auto-scroll to bottom
    this.variantTextTarget.scrollTop = this.variantTextTarget.scrollHeight
  }
  
  // Handle variant complete
  private handleVariantComplete(): void {
    console.log("Variant generation complete")
    // 确保 textarea 可编辑
    this.variantTextTarget.disabled = false
    showToast("变体生成完成！", "success")
  }
  
  // Handle variant error
  private handleVariantError(message: string): void {
    console.error("Variant generation error:", message)
    
    // 检测是否为临时错误（503服务繁忙、自动重试中）
    const isTemporaryError = message.includes('服务繁忙') || 
                            message.includes('正在自动重试') || 
                            message.includes('overloaded') ||
                            message.includes('503')
    
    if (isTemporaryError) {
      // 临时错误：保持容器显示，显示重试提示
      this.variantTextTarget.value = `⏳ ${message}\n\n系统正在自动重试，请稍候...`
      this.variantTextTarget.disabled = true
      showToast(message, "warning")
    } else {
      // 永久错误：清空内容并隐藏容器
      this.variantTextTarget.value = ""
      this.variantContainerTarget.style.display = "none"
      showToast(message || "变体生成失败，请稍后重试", "danger")
    }
  }
  
  // Copy variant
  copyVariant(): void {
    const variantText = this.variantTextTarget.value.trim()
    if (!variantText || variantText.length === 0) {
      showToast("变体内容为空", "warning")
      return
    }

    navigator.clipboard.writeText(variantText).then(() => {
      showToast("变体已复制到剪贴板", "success")
    }).catch(err => {
      console.error("Failed to copy:", err)
      showToast("复制失败，请手动选择并复制文本", "danger")
    })
  }
  
  // Save variant (after user edits)
  saveVariant(): void {
    const variantText = this.variantTextTarget.value.trim()
    if (!variantText || variantText.length === 0) {
      showToast("变体内容为空", "warning")
      return
    }
    
    if (!this.currentArticleId) {
      showToast("文章ID不存在，无法保存", "danger")
      return
    }
    
    // Update local state
    this.variantContent = variantText
    
    // Send to backend
    if (this.commandSubscription) {
      this.commandSubscription.perform("save_variant", {
        article_id: this.currentArticleId,
        variant_content: variantText
      })
    }
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
      const response = await fetch('/write/history')
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
        // Update character count after loading historical content
        this.updateCharCount()
      }
      
      // Show responses container if has brainstorm
      if (article.has_brainstorm) {
        this.responsesContainerTarget.style.display = "block"
        
        // Restore brainstorm results
        const providers = ['grok', 'qwen', 'deepseek', 'gemini', 'zhipu', 'doubao']
        providers.forEach(provider => {
          const content = article[`brainstorm_${provider}`]
          if (content) {
            this.responseContents[provider] = content
            this.completedModels.add(provider)
            
            // Update UI
            const targetName = `response${provider.charAt(0).toUpperCase() + provider.slice(1)}Target` as keyof this
            const target = this[targetName] as HTMLElement
            if (target) {
              // Render Markdown for restored content with header fix
              const fixedMarkdown = fixMarkdownHeaders(content)
              target.innerHTML = marked.parse(fixedMarkdown) as string
            }
            
            // Show buttons (edit, copyHtml, copyMarkdown, draft)
            const editButtonName = `editButton${provider.charAt(0).toUpperCase() + provider.slice(1)}Target` as keyof this
            const copyHtmlButtonName = `copyHtmlButton${provider.charAt(0).toUpperCase() + provider.slice(1)}Target` as keyof this
            const copyMarkdownButtonName = `copyMarkdownButton${provider.charAt(0).toUpperCase() + provider.slice(1)}Target` as keyof this
            const draftButtonName = `draftButton${provider.charAt(0).toUpperCase() + provider.slice(1)}Target` as keyof this
            
            const editButton = this[editButtonName] as HTMLElement
            const copyHtmlButton = this[copyHtmlButtonName] as HTMLElement
            const copyMarkdownButton = this[copyMarkdownButtonName] as HTMLElement
            const draftButton = this[draftButtonName] as HTMLElement
            
            if (editButton) editButton.style.display = "inline-flex"
            if (copyHtmlButton) copyHtmlButton.style.display = "inline-flex"
            if (copyMarkdownButton) copyMarkdownButton.style.display = "inline-flex"
            if (draftButton) draftButton.style.display = "inline-flex"
          }
        })
      }
      
      // Restore draft if exists
      if (article.draft) {
        this.selectedModel = article.selected_model
        this.draftContent = article.draft
        this.draftSectionTarget.style.display = "block"
        
        // Render markdown in div (view mode)
        const draftDiv = (this as any).draftContentTarget as HTMLElement
        if (draftDiv) {
          const fixedMarkdown = fixMarkdownHeaders(article.draft)
          draftDiv.innerHTML = marked.parse(fixedMarkdown) as string
        }
        
        // Update character count for restored draft
        this.updateDraftCharCount()
        
        // Show edit, copyHtml, copyMarkdown buttons
        const editButtonDraft = (this as any).editButtonDraftTarget as HTMLElement
        const copyHtmlButtonDraft = (this as any).copyHtmlButtonDraftTarget as HTMLElement
        const copyMarkdownButtonDraft = (this as any).copyMarkdownButtonDraftTarget as HTMLElement
        if (editButtonDraft) editButtonDraft.style.display = "inline-flex"
        if (copyHtmlButtonDraft) copyHtmlButtonDraft.style.display = "inline-flex"
        if (copyMarkdownButtonDraft) copyMarkdownButtonDraft.style.display = "inline-flex"
        
        const modelNames: { [key: string]: string } = {
          grok: "Grok", qwen: "千问", deepseek: "DeepSeek", 
          gemini: "Gemini", zhipu: "智谱", doubao: "豆包"
        }
        this.selectedModelLabelTarget.textContent = modelNames[article.selected_model] || article.selected_model
      }
      
      // Restore final if exists
      if (article.final_content) {
        this.finalContent = article.final_content
        this.finalSectionTarget.style.display = "block"
        this.finalArticleContainerTarget.style.display = "block"
        
        // Render markdown in div (view mode)
        const finalDiv = (this as any).finalArticleTarget as HTMLElement
        if (finalDiv && finalDiv.classList.contains('prose')) {
          const fixedMarkdown = fixMarkdownHeaders(article.final_content)
          finalDiv.innerHTML = marked.parse(fixedMarkdown) as string
        }
        
        // Update character count for restored final
        this.updateFinalCharCount()
        
        // Show edit, copyHtml, copyMarkdown buttons
        const editButtonFinal = (this as any).editButtonFinalTarget as HTMLElement
        const copyHtmlButtonFinal = (this as any).copyHtmlButtonFinalTarget as HTMLElement
        const copyMarkdownButtonFinal = (this as any).copyMarkdownButtonFinalTarget as HTMLElement
        if (editButtonFinal) editButtonFinal.style.display = "inline-flex"
        if (copyHtmlButtonFinal) copyHtmlButtonFinal.style.display = "inline-flex"
        if (copyMarkdownButtonFinal) copyMarkdownButtonFinal.style.display = "inline-flex"
        
        const styleNames: { [key: string]: string } = {
          pinker: "史蒂芬·平克",
          luozhenyu: "罗振宇",
          wangxiaobo: "王小波"
        }
        this.finalStyleLabelTarget.textContent = styleNames[article.final_style] || article.final_style
        
        // Show Step 5: Title Generation Section
        this.titleSectionTarget.style.display = "block"
        
        // If title exists, restore it
        if (article.title) {
          this.titleContent = article.title
          this.titleContainerTarget.style.display = "block"
          
          // Parse titles (split by newlines)
          const lines = article.title.split('\n').filter((line: string) => line.trim().length > 0)
          
          if (lines.length > 0) {
            this.titleListTarget.innerHTML = lines.map((title: string, index: number) => 
              `<div class="flex items-start gap-3 p-3 bg-surface/50 hover:bg-primary/5 transition-colors rounded-none border border-border/50">
                <span class="text-primary font-bold text-xl flex-shrink-0">${index + 1}.</span>
                <p class="flex-1 text-foreground">${this.escapeHtml(title)}</p>
                <button 
                  class="btn-sm btn-secondary flex-shrink-0" 
                  onclick="navigator.clipboard.writeText('${this.escapeHtml(title).replace(/'/g, "\\'")}')
                    .then(() => window.showToast('已复制', 'success'))
                    .catch(() => window.showToast('复制失败', 'danger'))"
                >
                  ${this.getCopyIcon()}
                </button>
              </div>`
            ).join('')
          } else {
            // Fallback: if title is not in multi-line format, show as single title
            this.titleListTarget.innerHTML = `
              <div class="flex items-start gap-3 p-3 bg-surface/50 hover:bg-primary/5 transition-colors rounded-none border border-border/50">
                <span class="text-primary font-bold text-xl flex-shrink-0">1.</span>
                <p class="flex-1 text-foreground">${this.escapeHtml(article.title)}</p>
                <button 
                  class="btn-sm btn-secondary flex-shrink-0" 
                  onclick="navigator.clipboard.writeText('${this.escapeHtml(article.title).replace(/'/g, "\\'")}')
                    .then(() => window.showToast('已复制', 'success'))
                    .catch(() => window.showToast('复制失败', 'danger'))"
                >
                  ${this.getCopyIcon()}
                </button>
              </div>
            `
          }
          
          const titleStyleNames: { [key: string]: string } = {
            mimeng: "迷蒙体",
            normal: "普通风格"
          }
          this.titleStyleLabelTarget.textContent = titleStyleNames[article.title_style] || article.title_style
          
          // Show Step 6: Variant Generation Section
          this.variantSectionTarget.style.display = "block"
          
          // If variant exists, restore it
          if (article.variant) {
            this.variantContent = article.variant
            this.variantContainerTarget.style.display = "block"
            this.variantTextTarget.value = article.variant
            
            const variantStyleNames: { [key: string]: string } = {
              xiaolvshu: "小绿书",
              xiaohongshu: "小红书"
            }
            this.variantStyleLabelTarget.textContent = variantStyleNames[article.variant_style] || article.variant_style
          }
        }
      }
      
      // Scroll to appropriate section
      if (article.variant) {
        // If has variant, scroll to variant section (most complete state)
        this.variantSectionTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (article.title) {
        // If has title but no variant, scroll to variant section to encourage variant generation
        this.variantSectionTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else if (article.final_content) {
        // If has final content but no title, scroll to title section to encourage title generation
        this.titleSectionTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
