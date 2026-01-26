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
    "draftsContainer",
    "draftGrok",
    "draftQwen",
    "draftDeepseek",
    "draftGemini",
    "draftZhipu",
    "draftCharCountGrok",
    "draftCharCountQwen",
    "draftCharCountDeepseek",
    "draftCharCountGemini",
    "draftCharCountZhipu",
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
  declare readonly historyOverlayTarget: HTMLElement
  declare readonly historySidebarTarget: HTMLElement
  declare readonly historyListTarget: HTMLElement
  declare readonly thinkingFrameworkTarget: HTMLInputElement
  declare readonly streamNameValue: string
  declare readonly hasInputTextTarget: boolean
  declare readonly hasCharCountTarget: boolean
  declare readonly hasDraftCharCountTarget: boolean

  private originalTranscript: string = ""
  private currentArticleId: number | null = null
  private responseContents: { [key: string]: string} = {
    grok: "",
    qwen: "",
    deepseek: "",
    gemini: "",
    zhipu: "",
    doubao: ""
  }
  private completedModels: Set<string> = new Set()
  private draftContents: { [key: string]: string } = {
    grok: "",
    qwen: "",
    deepseek: "",
    gemini: "",
    zhipu: "",
    doubao: ""
  }
  private completedDrafts: Set<string> = new Set()
  private subscriptions: { [key: string]: any } = {}
  private draftSubscriptions: { [key: string]: any } = {}
  private commandSubscription: any = null
  private draftSubscription: any = null
  private draftContent: string = ""
  private responseEditMode: { [key: string]: boolean } = {
    grok: false,
    qwen: false,
    deepseek: false,
    gemini: false,
    zhipu: false,
    doubao: false
  }

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
          } else if (data.type === 'regeneration-started') {
            // Handle regeneration started event
            const provider = data.provider
            console.log(`Regeneration started for ${provider}`)
            
            // Reset content for this provider
            this.responseContents[provider] = ""
            this.completedModels.delete(provider)
            
            // Show loading state
            const modelNames: { [key: string]: string } = {
              grok: "Grok",
              qwen: "千问",
              deepseek: "DeepSeek",
              gemini: "Gemini",
              zhipu: "智谱",
              doubao: "豆包"
            }
            this.resetResponseArea(provider, `${modelNames[provider]} 思考中...`)
          } else if (data.type === 'all-drafts-started') {
            console.log('All drafts generation started')
            // Draft generation will be handled by individual draft_xxx subscriptions
          } else if (data.type === 'draft-regeneration-started') {
            const provider = data.provider
            console.log(`Draft regeneration started for ${provider}`)
            
            // Reset draft content for this provider
            this.draftContents[provider] = ""
            this.completedDrafts.delete(provider)
            
            // Show loading state for draft
            const modelNames: { [key: string]: string } = {
              grok: "Grok",
              qwen: "千问",
              deepseek: "DeepSeek",
              gemini: "Gemini",
              zhipu: "智谱",
              doubao: "豆包"
            }
            this.resetDraftArea(provider, `${modelNames[provider]} 初稿生成中...`)
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
    
    // Subscribe to draft channels for each provider
    const draftProviders = ['grok', 'qwen', 'deepseek', 'gemini', 'zhipu']
    draftProviders.forEach(provider => {
      const streamName = `${this.streamNameValue}_draft_${provider}`
      this.draftSubscriptions[provider] = consumer.subscriptions.create(
        {
          channel: "ArticlesChannel",
          stream_name: streamName
        },
        {
          connected: () => {
            console.log(`${provider} draft channel connected`)
          },
          disconnected: () => {
            console.log(`${provider} draft channel disconnected`)
          },
          received: (data: any) => {
            this.handleDraftMessage(provider, data)
          }
        }
      )
    })
  }

  disconnect(): void {
    // Unsubscribe from command channel
    this.commandSubscription?.unsubscribe()
    this.commandSubscription = null
    
    // Unsubscribe from draft channels
    this.draftSubscription?.unsubscribe()
    this.draftSubscription = null
    
    // Unsubscribe from all provider channels
    Object.values(this.subscriptions).forEach(subscription => {
      subscription?.unsubscribe()
    })
    this.subscriptions = {}
    
    // Unsubscribe from all draft subscriptions
    Object.values(this.draftSubscriptions).forEach(subscription => {
      subscription?.unsubscribe()
    })
    this.draftSubscriptions = {}
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
  
  // Handle draft messages from a specific provider
  private handleDraftMessage(provider: string, data: any): void {
    if (data.type === 'chunk') {
      this.handleDraftChunkForProvider(provider, data.chunk)
    } else if (data.type === 'complete') {
      this.handleDraftCompleteForProvider(provider)
    } else if (data.type === 'error') {
      this.handleDraftErrorForProvider(provider, data.message)
    }
  }
  
  // Trigger generation of all drafts after brainstorm completes
  private triggerAllDraftsGeneration(): void {
    if (!this.currentArticleId) {
      console.error('No article_id found, cannot generate drafts')
      return
    }
    
    console.log('Triggering all drafts generation for article:', this.currentArticleId)
    
    // Reset draft state
    this.draftContents = {
      grok: "",
      qwen: "",
      deepseek: "",
      gemini: "",
      zhipu: "",
      doubao: ""
    }
    this.completedDrafts.clear()
    
    // Call backend to generate all drafts
    if (this.commandSubscription) {
      this.commandSubscription.perform("generate_all_drafts", {
        article_id: this.currentArticleId
      })
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
      // All brainstorm responses generated, auto-trigger draft generation
      console.log('All brainstorm completed, triggering draft generation')
      this.triggerAllDraftsGeneration()
    }
  }

  // Handle errors for a specific provider
  private handleErrorForProvider(provider: string, message: string): void {
    console.error(`${provider} generation error:`, message)
    
    const target = this.getResponseTarget(provider)
    
    if (target) {
      // 显示友好的错误消息和重新生成按钮
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
            <button 
              type="button"
              class="btn-sm btn-primary mt-2"
              data-action="click->articles#regenerateProvider"
              data-provider="${provider}"
            >
              <svg class="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              重新生成
            </button>
          </div>
        </div>
      `
    }
    
    // 标记为完成（虽然失败）
    this.completedModels.add(provider)
    
    // All models complete (including errors) (5 models, Doubao hidden)
    if (this.completedModels.size === 5) {
      // All brainstorm responses generated (including errors), auto-trigger draft generation
      console.log('All brainstorm completed (including errors), triggering draft generation')
      this.triggerAllDraftsGeneration()
    }
  }
  
  // Handle draft chunk for a specific provider
  private handleDraftChunkForProvider(provider: string, chunk: string): void {
    this.draftContents[provider] += chunk
    // For now, we don't render chunks - we wait for complete
    // If you want real-time rendering, add rendering logic here
  }
  
  // Handle draft complete for a specific provider
  private handleDraftCompleteForProvider(provider: string): void {
    console.log(`${provider} draft generation complete`)
    this.completedDrafts.add(provider)
    
    // Render draft content to UI
    const target = this.getDraftTarget(provider)
    const charCountTarget = this.getDraftCharCountTarget(provider)
    
    if (target && this.draftContents[provider]) {
      const fixedMarkdown = fixMarkdownHeaders(this.draftContents[provider])
      target.innerHTML = marked.parse(fixedMarkdown) as string
      
      // Update character count
      if (charCountTarget) {
        const charCount = this.draftContents[provider].length
        const countSpan = charCountTarget.querySelector('.font-semibold')
        if (countSpan) {
          countSpan.textContent = charCount.toString()
        }
      }
    }
    
    // Show drafts container after first draft completes
    const draftsContainer = (this as any).draftsContainerTarget
    if (draftsContainer && draftsContainer.style.display === 'none') {
      draftsContainer.style.display = 'block'
      // Scroll to drafts section
      draftsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }
  
  // Handle draft error for a specific provider
  private handleDraftErrorForProvider(provider: string, message: string): void {
    console.error(`${provider} draft generation error:`, message)
    this.completedDrafts.add(provider)
    
    // TODO: Show error in draft UI with regenerate button
    // This will be done in Task 5 when we update the view
  }
  
  // Reset draft area for a specific provider (show loading state)
  private resetDraftArea(provider: string, loadingText: string): void {
    const target = this.getDraftTarget(provider)
    if (target) {
      target.innerHTML = `
        <div class="flex items-center gap-2 text-muted">
          <div class="loading-spinner w-4 h-4"></div>
          <span>${loadingText}</span>
        </div>
      `
    }
  }
  
  // Get draft target for a specific provider
  private getDraftTarget(provider: string): HTMLElement | null {
    switch (provider) {
      case 'grok': return (this as any).draftGrokTarget
      case 'qwen': return (this as any).draftQwenTarget
      case 'deepseek': return (this as any).draftDeepseekTarget
      case 'gemini': return (this as any).draftGeminiTarget
      case 'zhipu': return (this as any).draftZhipuTarget
      default: return null
    }
  }
  
  // Get draft char count target for a specific provider
  private getDraftCharCountTarget(provider: string): HTMLElement | null {
    switch (provider) {
      case 'grok': return (this as any).draftCharCountGrokTarget
      case 'qwen': return (this as any).draftCharCountQwenTarget
      case 'deepseek': return (this as any).draftCharCountDeepseekTarget
      case 'gemini': return (this as any).draftCharCountGeminiTarget
      case 'zhipu': return (this as any).draftCharCountZhipuTarget
      default: return null
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
  
  // Regenerate a failed provider
  regenerateProvider(event: Event): void {
    const button = event.currentTarget as HTMLElement
    const provider = button.dataset.provider
    
    if (!provider) {
      showToast("无法确定需要重新生成的模型", "danger")
      return
    }
    
    if (!this.currentArticleId) {
      showToast("文章ID不存在，请重新开始", "danger")
      return
    }
    
    console.log(`Regenerating ${provider}`)
    
    // Call backend to regenerate this provider
    if (this.commandSubscription) {
      this.commandSubscription.perform("regenerate_provider", {
        article_id: this.currentArticleId,
        provider: provider
      })
    }
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
  }
  
  // Reset and start over
  reset(): void {
    // Clear all content
    this.originalTranscript = ""
    this.currentArticleId = null
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
      
      // Scroll to appropriate section
      if (article.has_brainstorm) {
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
