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
 * - responseGrok/Qwen/Deepseek/Gemini/Doubao: Display areas for each model
 * - copyHtmlButtonGrok/Qwen/Deepseek/Gemini/Doubao: Copy HTML buttons for each model
 * - copyMarkdownButtonGrok/Qwen/Deepseek/Gemini/Doubao: Copy Markdown buttons for each model
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
    "responseDoubao",
    "responseGrokEdit",
    "responseQwenEdit",
    "responseDeepseekEdit",
    "responseGeminiEdit",
    "responseDoubaoEdit",
    "saveButtonGrok",
    "saveButtonQwen",
    "saveButtonDeepseek",
    "saveButtonGemini",
    "saveButtonDoubao",
    "copyHtmlButtonGrok",
    "copyHtmlButtonQwen",
    "copyHtmlButtonDeepseek",
    "copyHtmlButtonGemini",
    "copyHtmlButtonDoubao",
    "copyMarkdownButtonGrok",
    "copyMarkdownButtonQwen",
    "copyMarkdownButtonDeepseek",
    "copyMarkdownButtonGemini",
    "copyMarkdownButtonDoubao",

    "draftsContainer",
    "draftGrok",
    "draftQwen",
    "draftDeepseek",
    "draftGemini",
    "draftDoubao",
    "draftCharCountGrok",
    "draftCharCountQwen",
    "draftCharCountDeepseek",
    "draftCharCountGemini",
    "draftCharCountDoubao",
    "editDraftButtonGrok",
    "editDraftButtonQwen",
    "editDraftButtonDeepseek",
    "editDraftButtonGemini",
    "editDraftButtonDoubao",
    "saveDraftButtonGrok",
    "saveDraftButtonQwen",
    "saveDraftButtonDeepseek",
    "saveDraftButtonGemini",
    "saveDraftButtonDoubao",
    "draftGrokEdit",
    "draftQwenEdit",
    "draftDeepseekEdit",
    "draftGeminiEdit",
    "draftDoubaoEdit",
    "copyDraftHtmlButtonGrok",
    "copyDraftHtmlButtonQwen",
    "copyDraftHtmlButtonDeepseek",
    "copyDraftHtmlButtonGemini",
    "copyDraftHtmlButtonDoubao",
    "copyDraftMarkdownButtonGrok",
    "copyDraftMarkdownButtonQwen",
    "copyDraftMarkdownButtonDeepseek",
    "copyDraftMarkdownButtonGemini",
    "copyDraftMarkdownButtonDoubao",
    "generateAllDraftsButton",
    "writingStyleSelector",
    "writingStyleRadio",
    "historyOverlay",
    "historySidebar",
    "historyList",
    "thinkingFramework",
    "progressContainer",
    "progressBarGrok",
    "progressBarQwen",
    "progressBarDeepseek",
    "progressBarGemini",
    "progressBarDoubao",
    "progressTextGrok",
    "progressTextQwen",
    "progressTextDeepseek",
    "progressTextGemini",
    "progressTextDoubao"
  ]

  static values = {
    streamName: String,
    writingStyle: { type: String, default: "original" }
  }

  declare readonly inputTextTarget: HTMLTextAreaElement
  declare readonly charCountTarget: HTMLElement
  declare readonly responsesContainerTarget: HTMLElement
  declare readonly responseGrokTarget: HTMLElement
  declare readonly responseQwenTarget: HTMLElement
  declare readonly responseDeepseekTarget: HTMLElement
  declare readonly responseGeminiTarget: HTMLElement
  declare readonly responseDoubaoTarget: HTMLElement

  declare readonly editDraftButtonGrokTarget: HTMLElement
  declare readonly editDraftButtonQwenTarget: HTMLElement
  declare readonly editDraftButtonDeepseekTarget: HTMLElement
  declare readonly editDraftButtonGeminiTarget: HTMLElement
  declare readonly editDraftButtonDoubaoTarget: HTMLElement
  declare readonly saveDraftButtonGrokTarget: HTMLElement
  declare readonly saveDraftButtonQwenTarget: HTMLElement
  declare readonly saveDraftButtonDeepseekTarget: HTMLElement
  declare readonly saveDraftButtonGeminiTarget: HTMLElement
  declare readonly saveDraftButtonDoubaoTarget: HTMLElement
  declare readonly draftGrokEditTarget: HTMLTextAreaElement
  declare readonly draftQwenEditTarget: HTMLTextAreaElement
  declare readonly draftDeepseekEditTarget: HTMLTextAreaElement
  declare readonly draftGeminiEditTarget: HTMLTextAreaElement
  declare readonly draftDoubaoEditTarget: HTMLTextAreaElement
  declare readonly copyDraftHtmlButtonGrokTarget: HTMLElement
  declare readonly copyDraftHtmlButtonQwenTarget: HTMLElement
  declare readonly copyDraftHtmlButtonDeepseekTarget: HTMLElement
  declare readonly copyDraftHtmlButtonGeminiTarget: HTMLElement
  declare readonly copyDraftHtmlButtonDoubaoTarget: HTMLElement
  declare readonly copyDraftMarkdownButtonGrokTarget: HTMLElement
  declare readonly copyDraftMarkdownButtonQwenTarget: HTMLElement
  declare readonly copyDraftMarkdownButtonDeepseekTarget: HTMLElement
  declare readonly copyDraftMarkdownButtonGeminiTarget: HTMLElement
  declare readonly copyDraftMarkdownButtonDoubaoTarget: HTMLElement
  declare readonly generateAllDraftsButtonTarget: HTMLElement
  declare readonly writingStyleSelectorTarget: HTMLElement
  declare readonly writingStyleRadioTargets: HTMLInputElement[]
  declare readonly historyOverlayTarget: HTMLElement
  declare readonly historySidebarTarget: HTMLElement
  declare readonly historyListTarget: HTMLElement
  declare readonly thinkingFrameworkTarget: HTMLInputElement
  declare readonly progressContainerTarget: HTMLElement
  declare readonly progressBarGrokTarget: HTMLElement
  declare readonly progressBarQwenTarget: HTMLElement
  declare readonly progressBarDeepseekTarget: HTMLElement
  declare readonly progressBarGeminiTarget: HTMLElement
  declare readonly progressBarDoubaoTarget: HTMLElement
  declare readonly progressTextGrokTarget: HTMLElement
  declare readonly progressTextQwenTarget: HTMLElement
  declare readonly progressTextDeepseekTarget: HTMLElement
  declare readonly progressTextGeminiTarget: HTMLElement
  declare readonly progressTextDoubaoTarget: HTMLElement
  declare readonly streamNameValue: string
  declare writingStyleValue: string
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
    doubao: ""
  }
  private completedModels: Set<string> = new Set()
  private draftContents: { [key: string]: string } = {
    grok: "",
    qwen: "",
    deepseek: "",
    gemini: "",
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
    doubao: false
  }
  private draftEditMode: { [key: string]: boolean } = {
    grok: false,
    qwen: false,
    deepseek: false,
    gemini: false,
    doubao: false
  }
  private modelProgress: { [key: string]: number } = {
    grok: 0,
    qwen: 0,
    deepseek: 0,
    gemini: 0,
    doubao: 0
  }
  private progressIntervals: { [key: string]: number | null } = {
    grok: null,
    qwen: null,
    deepseek: null,
    gemini: null,
    doubao: null
  }
  private progressTargets: { [key: string]: number } = {
    grok: 45,
    qwen: 45,
    deepseek: 45,
    gemini: 45,
    doubao: 45
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
            // Check if there's already saved content in database that wasn't rendered
            this.loadSavedContentIfExists()
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
              doubao: "豆包"
            }
            this.resetResponseArea(provider, `${modelNames[provider]} 等待AI响应...`)
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
              doubao: "豆包"
            }
            this.resetDraftArea(provider, `${modelNames[provider]} 等待AI响应...`)
          }
        }
      }
    )

    // Subscribe to WebSocket channels for all 6 models (for receiving responses)
    const providers = ['grok', 'qwen', 'deepseek', 'gemini', 'doubao']
    
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
    
    // Subscribe to draft channels for each provider
    const draftProviders = ['grok', 'qwen', 'deepseek', 'gemini', 'doubao']
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
    
    // CRITICAL FIX: Check for saved content after all subscriptions are set up
    // This handles the case where WebSocket 'complete' messages were missed
    // but content was already saved to database
    setTimeout(() => {
      this.loadSavedContentIfExists()
    }, 500) // Small delay to ensure DOM is ready and article_id might be set
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
    
    console.log('Triggering all drafts generation for article:', this.currentArticleId, 'with writing style:', this.writingStyleValue)
    
    // Reset draft state
    this.draftContents = {
      grok: "",
      qwen: "",
      deepseek: "",
      gemini: "",
      doubao: ""
    }
    this.completedDrafts.clear()
    
    // CRITICAL: Show drafts container immediately (like responsesContainer in brainstorm)
    const draftsContainer = (this as any).draftsContainerTarget
    if (draftsContainer) {
      draftsContainer.style.display = 'block'
      // Scroll to drafts section
      draftsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    
    // CRITICAL: Show loading state for all draft areas immediately (like brainstorm does)
    // This makes all 5 draft cards visible right away
    this.resetDraftArea("grok", "Grok 等待AI响应...")
    this.resetDraftArea("qwen", "千问等待AI响应...")
    this.resetDraftArea("deepseek", "DeepSeek 等待AI响应...")
    this.resetDraftArea("gemini", "Gemini 等待AI响应...")
    this.resetDraftArea("doubao", "豆包等待AI响应...")
    
    // Call backend to generate all drafts with writing style
    if (this.commandSubscription) {
      this.commandSubscription.perform("generate_all_drafts", {
        article_id: this.currentArticleId,
        writing_style: this.writingStyleValue
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

  // Confirm regenerate action with article quota warning
  confirmRegenerate(event: Event): void {
    event.preventDefault()
    const link = event.currentTarget as HTMLElement
    const articleId = link.dataset.articlesArticleIdValue
    
    if (!articleId) {
      showToast("文章ID缺失", "danger")
      return
    }
    
    // Create elegant confirmation modal
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4'
    modal.innerHTML = `
      <div class="card bg-white dark:bg-gray-800 max-w-md w-full rounded-lg shadow-2xl">
        <div class="p-6">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <svg class="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z">
                </path>
              </svg>
            </div>
            <div>
              <h3 class="text-xl font-bold text-gray-900 dark:text-gray-50">重新生成确认</h3>
            </div>
          </div>
          
          <div class="space-y-3 mb-6 text-gray-700 dark:text-gray-300">
            <p class="flex items-start gap-2">
              <span class="text-xl">💡</span>
              <span>重新生成将创建一篇新文章</span>
            </p>
            <p class="flex items-start gap-2">
              <span class="text-xl">📊</span>
              <span class="font-semibold text-orange-600 dark:text-orange-400">会消耗 1 篇额度</span>
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400">原始内容将被保留，但会重新生成所有AI脑爆和初稿。</p>
          </div>
          
          <div class="flex gap-3">
            <button class="btn-ghost flex-1" data-action="click">
              取消
            </button>
            <button class="btn-primary flex-1" data-action="click">
              确定继续
            </button>
          </div>
        </div>
      </div>
    `
    
    document.body.appendChild(modal)
    
    // Handle button clicks
    const buttons = modal.querySelectorAll('button')
    buttons[0].addEventListener('click', () => {
      document.body.removeChild(modal)
    })
    buttons[1].addEventListener('click', () => {
      document.body.removeChild(modal)
      window.location.href = `/write?article_id=${articleId}`
    })
    
    // Close on background click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal)
      }
    })
  }


  // Called when user clicks "一键生成所有脑爆和初稿" button
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
    console.log('Starting new conversation with brainstorm + drafts, article_id cleared')

    // Get selected thinking framework
    const thinkingFramework = this.getSelectedThinkingFramework()
    
    // Get selected writing style
    const writingStyle = this.writingStyleValue

    // Start generation process with both brainstorm and drafts
    this.startBrainstormAndDrafts(thinkingFramework, writingStyle)
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

  // Start brainstorm and drafts generation in one go
  private startBrainstormAndDrafts(thinkingFramework: string = 'original', writingStyle: string = 'original'): void {
    // Reset state for brainstorm
    this.responseContents = {
      grok: "",
      qwen: "",
      deepseek: "",
      gemini: "",
      doubao: ""
    }
    this.completedModels.clear()
    
    // Reset state for drafts
    this.draftContents = {
      grok: "",
      qwen: "",
      deepseek: "",
      gemini: "",
      doubao: ""
    }
    this.completedDrafts.clear()
    
    // Reset progress for all 5 models
    this.modelProgress = {
      grok: 0,
      qwen: 0,
      deepseek: 0,
      gemini: 0,
      doubao: 0
    }
    
    // Show and reset progress bars
    this.progressContainerTarget.style.display = 'block'
    this.updateProgress('grok', 0)
    this.updateProgress('qwen', 0)
    this.updateProgress('deepseek', 0)
    this.updateProgress('gemini', 0)
    this.updateProgress('doubao', 0)
    
    // Start smooth progress animation for all 5 models (phase 1: 0% to 45%)
    this.progressTargets = { grok: 45, qwen: 45, deepseek: 45, gemini: 45, doubao: 45 }
    this.startSmoothProgress('grok')
    this.startSmoothProgress('qwen')
    this.startSmoothProgress('deepseek')
    this.startSmoothProgress('gemini')
    this.startSmoothProgress('doubao')

    // Show responses container
    this.responsesContainerTarget.style.display = "block"

    // Reset all response areas to "等待响应" state
    this.resetResponseArea("grok", "Grok 等待AI响应...")
    this.resetResponseArea("qwen", "千问等待AI响应...")
    this.resetResponseArea("deepseek", "DeepSeek 等待AI响应...")
    this.resetResponseArea("gemini", "Gemini 等待AI响应...")
    this.resetResponseArea("doubao", "豆包等待AI响应...")
    
    // Show drafts container immediately (even before brainstorm completes)
    const draftsContainer = (this as any).draftsContainerTarget
    if (draftsContainer) {
      draftsContainer.style.display = 'block'
    }
    
    // Show loading state for all draft areas
    this.resetDraftArea("grok", "等待脑爆完成后生成初稿...")
    this.resetDraftArea("qwen", "等待脑爆完成后生成初稿...")
    this.resetDraftArea("deepseek", "等待脑爆完成后生成初稿...")
    this.resetDraftArea("gemini", "等待脑爆完成后生成初稿...")
    this.resetDraftArea("doubao", "等待脑爆完成后生成初稿...")

    // Trigger backend to create new article with brainstorm + drafts
    if (this.commandSubscription) {
      this.commandSubscription.perform("create_new_from_existing", {
        transcript: this.originalTranscript,
        writing_style: writingStyle,
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
      case 'doubao': return this.responseDoubaoTarget
      default: return null
    }
  }

  
  private getSaveButtonTarget(provider: string): HTMLElement | null {
    switch (provider) {
      case 'grok': return (this as any).saveButtonGrokTarget
      case 'qwen': return (this as any).saveButtonQwenTarget
      case 'deepseek': return (this as any).saveButtonDeepseekTarget
      case 'gemini': return (this as any).saveButtonGeminiTarget
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
      case 'doubao': return (this as any).responseDoubaoEditTarget
      default: return null
    }
  }

  // Handle streaming chunks for a specific provider
  private handleChunkForProvider(provider: string, chunk: string): void {
    // If this is the first chunk, update status to "正在生成"
    if (this.responseContents[provider] === "") {
      const modelNames: { [key: string]: string } = {
        grok: "Grok",
        qwen: "千问",
        deepseek: "DeepSeek",
        gemini: "Gemini",
        doubao: "豆包"
      }
      this.resetResponseArea(provider, `${modelNames[provider]} 正在生成...`)
    }
    
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
    
    // Stop smooth progress and set to 50% (brainstorm complete, waiting for draft)
    this.stopSmoothProgress(provider)
    this.updateProgress(provider, 50)
    // Start smooth progress again from 50% to 95% for draft phase
    this.progressTargets[provider] = 95
    this.startSmoothProgress(provider)
    
    // Update draft areas to "等待AI响应" state (brainstorm complete, draft job queued)
    const modelNames: { [key: string]: string } = {
      grok: "Grok",
      qwen: "千问",
      deepseek: "DeepSeek",
      gemini: "Gemini",
      doubao: "豆包"
    }
    this.resetDraftArea(provider, `${modelNames[provider]} 等待AI响应...`)
    
    // Show copy HTML, copy markdown buttons (but NOT edit button in brainstorm)
    const copyHtmlButton = this.getCopyHtmlButtonTarget(provider)
    const copyMarkdownButton = this.getCopyMarkdownButtonTarget(provider)
    
    if (copyHtmlButton) copyHtmlButton.style.display = "inline-flex"
    if (copyMarkdownButton) copyMarkdownButton.style.display = "inline-flex"
    // Note: Draft buttons are NOT shown in new flow since drafts auto-generate

    // No need to show "Generate All Drafts" button since it's part of initial flow now
  }

  // Handle errors for a specific provider
  private handleErrorForProvider(provider: string, message: string): void {
    console.error(`[BRAINSTORM ERROR] ${provider} generation error:`, message)
    console.log(`[BRAINSTORM ERROR] Target check - responseTarget for ${provider}:`, this.getResponseTarget(provider))
    
    // Stop progress bar animation on error
    this.stopSmoothProgress(provider)
    
    const target = this.getResponseTarget(provider)
    
    if (target) {
      console.log(`[BRAINSTORM ERROR] Updating brainstorm area for ${provider} with error message`)
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
      // All brainstorm responses generated (including errors), show "Generate All Drafts" button and writing style selector
      console.log('All brainstorm completed (including errors), showing generate all drafts button and writing style selector')
      if (this.generateAllDraftsButtonTarget) {
        this.generateAllDraftsButtonTarget.style.display = "inline-flex"
      }
      if (this.writingStyleSelectorTarget) {
        this.writingStyleSelectorTarget.style.display = "block"
        // Scroll to selector
        this.writingStyleSelectorTarget.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }
  
  // Handle draft chunk for a specific provider
  private handleDraftChunkForProvider(provider: string, chunk: string): void {
    // If this is the first chunk, update status to "正在生成"
    if (this.draftContents[provider] === "") {
      const modelNames: { [key: string]: string } = {
        grok: "Grok",
        qwen: "千问",
        deepseek: "DeepSeek",
        gemini: "Gemini",
        doubao: "豆包"
      }
      this.resetDraftArea(provider, `${modelNames[provider]} 正在生成初稿...`)
    }
    
    this.draftContents[provider] += chunk
    // Accumulate chunks, render only on 'complete' message
  }
  
  // Handle draft complete for a specific provider
  private handleDraftCompleteForProvider(provider: string): void {
    console.log(`${provider} draft generation complete`)
    this.completedDrafts.add(provider)
    
    // Stop smooth progress and set to 100% (draft complete)
    this.stopSmoothProgress(provider)
    this.updateProgress(provider, 100)
    
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
    
    // Show draft action buttons (edit, copy, copyMarkdown)
    const editDraftButton = this.getEditDraftButtonTarget(provider)
    const copyDraftHtmlButton = this.getCopyDraftHtmlButtonTarget(provider)
    const copyDraftMarkdownButton = this.getCopyDraftMarkdownButtonTarget(provider)
    
    if (editDraftButton) editDraftButton.style.display = "inline-flex"
    if (copyDraftHtmlButton) copyDraftHtmlButton.style.display = "inline-flex"
    if (copyDraftMarkdownButton) copyDraftMarkdownButton.style.display = "inline-flex"
    
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
    console.error(`[DRAFT ERROR] ${provider} draft generation error:`, message)
    console.log(`[DRAFT ERROR] Target check - draftTarget for ${provider}:`, this.getDraftTarget(provider))
    console.log(`[DRAFT ERROR] Sanity check - responseTarget for ${provider}:`, this.getResponseTarget(provider))
    this.completedDrafts.add(provider)
    
    // Stop progress bar animation on draft error
    if (provider !== 'doubao') {
      this.stopSmoothProgress(provider)
    }
    
    const target = this.getDraftTarget(provider)
    if (target) {
      console.log(`[DRAFT ERROR] Updating draft area for ${provider} with error message`)
      const modelNames: { [key: string]: string } = {
        grok: "Grok",
        qwen: "千问",
        deepseek: "DeepSeek",
        gemini: "Gemini",
        doubao: "豆包"
      }
      
      target.innerHTML = `
        <div class="alert alert-danger">
          <div class="flex items-center gap-2 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-circle w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span class="font-medium">${modelNames[provider]} 初稿生成失败</span>
          </div>
          <p class="text-sm text-muted mb-3">${message}</p>
          <p class="text-xs text-warning mb-3">⚠️ 注意：这是初稿生成失败，不影响上方已生成的思考框架内容</p>
          <button
            type="button"
            class="btn-sm btn-primary"
            data-action="click->articles#retryDraft"
            data-provider="${provider}"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-refresh-cw w-4 h-4 inline-block mr-1"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
            重新生成初稿
          </button>
        </div>
      `
    } else {
      console.error(`[DRAFT ERROR] Failed to get draft target for ${provider}`)
    }
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
      case 'doubao': return (this as any).draftDoubaoTarget
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
      case 'doubao': return (this as any).draftCharCountDoubaoTarget
      default: return null
    }
  }

  // Get edit draft button target for a specific provider
  private getEditDraftButtonTarget(provider: string): HTMLElement | null {
    switch (provider) {
      case 'grok': return this.editDraftButtonGrokTarget
      case 'qwen': return this.editDraftButtonQwenTarget
      case 'deepseek': return this.editDraftButtonDeepseekTarget
      case 'gemini': return this.editDraftButtonGeminiTarget
      case 'doubao': return this.editDraftButtonDoubaoTarget
      default: return null
    }
  }

  // Get save draft button target for a specific provider
  private getSaveDraftButtonTarget(provider: string): HTMLElement | null {
    switch (provider) {
      case 'grok': return this.saveDraftButtonGrokTarget
      case 'qwen': return this.saveDraftButtonQwenTarget
      case 'deepseek': return this.saveDraftButtonDeepseekTarget
      case 'gemini': return this.saveDraftButtonGeminiTarget
      case 'doubao': return this.saveDraftButtonDoubaoTarget
      default: return null
    }
  }

  // Get draft edit textarea target for a specific provider
  private getDraftEditTarget(provider: string): HTMLTextAreaElement | null {
    switch (provider) {
      case 'grok': return this.draftGrokEditTarget
      case 'qwen': return this.draftQwenEditTarget
      case 'deepseek': return this.draftDeepseekEditTarget
      case 'gemini': return this.draftGeminiEditTarget
      case 'doubao': return this.draftDoubaoEditTarget
      default: return null
    }
  }

  // Get copy draft HTML button target for a specific provider
  private getCopyDraftHtmlButtonTarget(provider: string): HTMLElement | null {
    switch (provider) {
      case 'grok': return this.copyDraftHtmlButtonGrokTarget
      case 'qwen': return this.copyDraftHtmlButtonQwenTarget
      case 'deepseek': return this.copyDraftHtmlButtonDeepseekTarget
      case 'gemini': return this.copyDraftHtmlButtonGeminiTarget
      case 'doubao': return this.copyDraftHtmlButtonDoubaoTarget
      default: return null
    }
  }

  // Get copy draft Markdown button target for a specific provider
  private getCopyDraftMarkdownButtonTarget(provider: string): HTMLElement | null {
    switch (provider) {
      case 'grok': return this.copyDraftMarkdownButtonGrokTarget
      case 'qwen': return this.copyDraftMarkdownButtonQwenTarget
      case 'deepseek': return this.copyDraftMarkdownButtonDeepseekTarget
      case 'gemini': return this.copyDraftMarkdownButtonGeminiTarget
      case 'doubao': return this.copyDraftMarkdownButtonDoubaoTarget
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
    const saveButton = this.getSaveButtonTarget(provider)
    const copyHtmlButton = this.getCopyHtmlButtonTarget(provider)
    const copyMarkdownButton = this.getCopyMarkdownButtonTarget(provider)
    
    if (!responseDiv || !responseEdit) return
    
    // Switch to edit mode
    this.responseEditMode[provider] = true
    responseDiv.style.display = "none"
    responseEdit.style.display = "block"
    responseEdit.value = this.responseContents[provider]
    
    // Switch buttons
    if (saveButton) saveButton.style.display = "inline-flex"
    if (copyHtmlButton) copyHtmlButton.style.display = "none"
    if (copyMarkdownButton) copyMarkdownButton.style.display = "none"
  }
  
  // Save edited response
  saveResponse(event: Event): void {
    const button = event.currentTarget as HTMLElement
    const provider = button.dataset.provider
    
    if (!provider) return
    
    const responseDiv = this.getResponseTarget(provider)
    const responseEdit = this.getResponseEditTarget(provider)
    const saveButton = this.getSaveButtonTarget(provider)
    const copyHtmlButton = this.getCopyHtmlButtonTarget(provider)
    const copyMarkdownButton = this.getCopyMarkdownButtonTarget(provider)
    
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
    if (saveButton) saveButton.style.display = "none"
    if (copyHtmlButton) copyHtmlButton.style.display = "inline-flex"
    if (copyMarkdownButton) copyMarkdownButton.style.display = "inline-flex"
    
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
  
  // Update writing style selection
  updateWritingStyle(event: Event): void {
    const radio = event.currentTarget as HTMLInputElement
    if (radio.checked) {
      this.writingStyleValue = radio.value
      console.log('Writing style updated to:', this.writingStyleValue)
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
    
    // Check if brainstorm content exists for this provider
    if (!this.responseContents[provider]) {
      showToast("请先完成AI脑爆", "warning")
      return
    }
    
    // Show loading state
    const target = this.getDraftTarget(provider)
    if (target) {
      const modelNames: { [key: string]: string } = {
        grok: "Grok",
        qwen: "千问",
        deepseek: "DeepSeek",
        gemini: "Gemini",
        doubao: "豆包"
      }
      this.resetDraftArea(provider, `${modelNames[provider]} 初稿生成中...`)
    }
    
    // Reset draft content
    this.draftContents[provider] = ""
    this.completedDrafts.delete(provider)
    
    // Call backend to regenerate draft for this provider with writing style
    if (this.commandSubscription) {
      this.commandSubscription.perform("regenerate_draft", {
        article_id: this.currentArticleId,
        provider: provider,
        writing_style: this.writingStyleValue
      })
    }
    
    showToast("开始生成初稿...", "info")
  }
  
  // Retry draft generation after error
  retryDraft(event: Event): void {
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
    
    // Show loading state
    const target = this.getDraftTarget(provider)
    if (target) {
      const modelNames: { [key: string]: string } = {
        grok: "Grok",
        qwen: "千问",
        deepseek: "DeepSeek",
        gemini: "Gemini",
        doubao: "豆包"
      }
      this.resetDraftArea(provider, `${modelNames[provider]} 重新生成中...`)
    }
    
    // Reset draft content
    this.draftContents[provider] = ""
    this.completedDrafts.delete(provider)
    
    // Call backend to regenerate draft for this provider with writing style
    if (this.commandSubscription) {
      this.commandSubscription.perform("regenerate_draft", {
        article_id: this.currentArticleId,
        provider: provider,
        writing_style: this.writingStyleValue
      })
    }
    
    showToast("重新生成中...", "info")
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
      doubao: ""
    }
    this.completedModels.clear()

    // Clear input text
    if (this.hasInputTextTarget) {
      this.inputTextTarget.value = ""
    }

    // Hide all sections
    this.responsesContainerTarget.style.display = "none"

    // Reset all response texts
    this.responseGrokTarget.innerHTML = ""
    this.responseQwenTarget.innerHTML = ""
    this.responseDeepseekTarget.innerHTML = ""
    this.responseGeminiTarget.innerHTML = ""
    this.responseDoubaoTarget.innerHTML = ""
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
      const response = await fetch('/write/history', {
        credentials: 'same-origin'  // Include session cookies
      })
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
      const response = await fetch(`/articles/${articleId}.json`, {
        credentials: 'same-origin'  // Include session cookies
      })
      if (!response.ok) {
        throw new Error('Article not found')
      }
      
      const article = await response.json()
      
      // CRITICAL: For "Re-brainstorm" feature, we DON'T restore article_id
      // This forces creation of a NEW article when user clicks "一键AI脑爆"
      this.currentArticleId = null  // Explicitly clear to create new article
      
      // Restore transcript (original input)
      this.originalTranscript = article.transcript || ""
      
      // Set input text
      if (this.hasInputTextTarget && article.transcript) {
        this.inputTextTarget.value = article.transcript
        // Update character count after loading historical content
        this.updateCharCount()
      }
      
      // DON'T restore brainstorm results - user wants to re-brainstorm
      // Clear all response contents
      this.responseContents = {
        grok: "",
        qwen: "",
        deepseek: "",
        gemini: "",
        doubao: ""
      }
      this.completedModels.clear()
      
      // DON'T restore draft results - start fresh
      this.draftContents = {
        grok: "",
        qwen: "",
        deepseek: "",
        gemini: "",
        doubao: ""
      }
      this.completedDrafts.clear()
      
      // Hide responses container (will show when user clicks "一键AI脑爆")
      this.responsesContainerTarget.style.display = "none"
      
      // Hide drafts container
      const draftsContainer = (this as any).draftsContainerTarget
      if (draftsContainer) {
        draftsContainer.style.display = "none"
      }
      
      // Hide progress container
      this.progressContainerTarget.style.display = 'none'
      
      // Clear all response display areas
      const providers = ['grok', 'qwen', 'deepseek', 'gemini', 'doubao', 'doubao']
      providers.forEach(provider => {
        const target = this.getResponseTarget(provider)
        if (target) {
          target.innerHTML = ''
        }
        const draftTarget = this.getDraftTarget(provider)
        if (draftTarget) {
          draftTarget.innerHTML = ''
        }
      })
      
      // Scroll to input area (top of page)
      if (this.hasInputTextTarget) {
        this.inputTextTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
      
      showToast("已加载原始内容，可以开始重新脑爆", "success")
      
    } catch (error) {
      console.error('Error restoring article:', error)
      showToast("加载文章失败", "danger")
    }
  }
  
  // CRITICAL FIX: Load saved content from database if exists but not rendered
  // This fixes the issue where WebSocket 'complete' messages are missed
  // but content was already saved to database
  private async loadSavedContentIfExists(): Promise<void> {
    // Only check if we have a current article ID
    if (!this.currentArticleId) {
      console.log('[loadSavedContentIfExists] No currentArticleId, skipping check')
      return
    }
    
    console.log('[loadSavedContentIfExists] Checking for saved content for article:', this.currentArticleId)
    
    try {
      // Fetch article data from backend
      const response = await fetch(`/articles/${this.currentArticleId}.json`, {
        credentials: 'same-origin'
      })
      
      if (!response.ok) {
        console.error('[loadSavedContentIfExists] Failed to fetch article')
        return
      }
      
      const article = await response.json()
      console.log('[loadSavedContentIfExists] Article data fetched:', article)
      
      const providers = ['grok', 'qwen', 'deepseek', 'gemini', 'doubao', 'doubao']
      
      // Check and render brainstorm contents
      providers.forEach(provider => {
        const dbContent = article[`brainstorm_${provider}`]
        const frontendContent = this.responseContents[provider]
        
        console.log(`[loadSavedContentIfExists] Checking ${provider} brainstorm:`, {
          dbContentExists: !!dbContent,
          dbContentLength: dbContent?.length || 0,
          frontendContentExists: !!frontendContent,
          frontendContentLength: frontendContent?.length || 0
        })
        
        // If database has content but frontend doesn't (or is empty), render it
        if (dbContent && !frontendContent) {
          console.log(`[loadSavedContentIfExists] ✅ Found saved brainstorm for ${provider}, rendering now`)
          
          // Update frontend state
          this.responseContents[provider] = dbContent
          this.completedModels.add(provider)
          
          // Render to UI
          const target = this.getResponseTarget(provider)
          if (target) {
            const fixedMarkdown = fixMarkdownHeaders(dbContent)
            target.innerHTML = marked.parse(fixedMarkdown) as string
            
            // Show brainstorm action buttons
            const copyHtmlButton = this.getCopyHtmlButtonTarget(provider)
            const copyMarkdownButton = this.getCopyMarkdownButtonTarget(provider)
            if (copyHtmlButton) copyHtmlButton.style.display = "inline-flex"
            if (copyMarkdownButton) copyMarkdownButton.style.display = "inline-flex"
            
            // Show responses container
            if (this.responsesContainerTarget.style.display === 'none') {
              this.responsesContainerTarget.style.display = 'block'
            }
          }
        }
      })
      
      // Check and render draft contents (only for grok, qwen, deepseek, gemini, doubao)
      const draftProviders = ['grok', 'qwen', 'deepseek', 'gemini', 'doubao']
      let hasDrafts = false
      
      draftProviders.forEach(provider => {
        const dbContent = article[`draft_${provider}`]
        const frontendContent = this.draftContents[provider]
        
        console.log(`[loadSavedContentIfExists] Checking ${provider} draft:`, {
          dbContentExists: !!dbContent,
          dbContentLength: dbContent?.length || 0,
          frontendContentExists: !!frontendContent,
          frontendContentLength: frontendContent?.length || 0
        })
        
        // If database has content but frontend doesn't (or is empty), render it
        if (dbContent && !frontendContent) {
          console.log(`[loadSavedContentIfExists] ✅ Found saved draft for ${provider}, rendering now`)
          
          hasDrafts = true
          
          // Update frontend state
          this.draftContents[provider] = dbContent
          this.completedDrafts.add(provider)
          
          // Render to UI
          const target = this.getDraftTarget(provider)
          const charCountTarget = this.getDraftCharCountTarget(provider)
          
          if (target) {
            const fixedMarkdown = fixMarkdownHeaders(dbContent)
            target.innerHTML = marked.parse(fixedMarkdown) as string
            
            // Update character count
            if (charCountTarget) {
              const charCount = dbContent.length
              const countSpan = charCountTarget.querySelector('.font-semibold')
              if (countSpan) {
                countSpan.textContent = charCount.toString()
              }
            }
            
            // Show draft action buttons
            const editDraftButton = this.getEditDraftButtonTarget(provider)
            const copyDraftHtmlButton = this.getCopyDraftHtmlButtonTarget(provider)
            const copyDraftMarkdownButton = this.getCopyDraftMarkdownButtonTarget(provider)
            
            if (editDraftButton) editDraftButton.style.display = "inline-flex"
            if (copyDraftHtmlButton) copyDraftHtmlButton.style.display = "inline-flex"
            if (copyDraftMarkdownButton) copyDraftMarkdownButton.style.display = "inline-flex"
            
            // Set progress to 100%
            if (provider !== 'doubao') {
              this.updateProgress(provider, 100)
            }
          }
        }
      })
      
      // Show drafts container if any drafts were rendered
      if (hasDrafts) {
        const draftsContainer = (this as any).draftsContainerTarget
        if (draftsContainer && draftsContainer.style.display === 'none') {
          draftsContainer.style.display = 'block'
          console.log('[loadSavedContentIfExists] Showing drafts container')
        }
      }
      
      console.log('[loadSavedContentIfExists] Content check complete')
      
    } catch (error) {
      console.error('[loadSavedContentIfExists] Error loading saved content:', error)
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
      const booksResponse = await fetch('/api/books', {
        credentials: 'same-origin'  // Include session cookies
      })
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
          const chaptersResponse = await fetch(`/api/books/${bookId}/chapters`, {
            credentials: 'same-origin'  // Include session cookies
          })
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
            credentials: 'same-origin',  // Include session cookies
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

  // Edit draft content
  editDraft(event: Event): void {
    const button = event.currentTarget as HTMLElement
    const provider = button.dataset.provider
    
    if (!provider) return
    
    const draftDiv = this.getDraftTarget(provider)
    const draftEdit = this.getDraftEditTarget(provider)
    const editDraftButton = this.getEditDraftButtonTarget(provider)
    const saveDraftButton = this.getSaveDraftButtonTarget(provider)
    const copyHtmlButton = this.getCopyDraftHtmlButtonTarget(provider)
    const copyMarkdownButton = this.getCopyDraftMarkdownButtonTarget(provider)
    
    if (!draftDiv || !draftEdit) return
    
    // Switch to edit mode
    this.draftEditMode[provider] = true
    draftDiv.style.display = "none"
    draftEdit.style.display = "block"
    draftEdit.value = this.draftContents[provider]
    
    // Switch buttons
    if (editDraftButton) editDraftButton.style.display = "none"
    if (saveDraftButton) saveDraftButton.style.display = "inline-flex"
    if (copyHtmlButton) copyHtmlButton.style.display = "none"
    if (copyMarkdownButton) copyMarkdownButton.style.display = "none"
  }

  // Save edited draft
  saveDraft(event: Event): void {
    const button = event.currentTarget as HTMLElement
    const provider = button.dataset.provider
    
    if (!provider) return
    
    const draftDiv = this.getDraftTarget(provider)
    const draftEdit = this.getDraftEditTarget(provider)
    const editDraftButton = this.getEditDraftButtonTarget(provider)
    const saveDraftButton = this.getSaveDraftButtonTarget(provider)
    const copyHtmlButton = this.getCopyDraftHtmlButtonTarget(provider)
    const copyMarkdownButton = this.getCopyDraftMarkdownButtonTarget(provider)
    
    if (!draftDiv || !draftEdit) return
    
    // Update content
    this.draftContents[provider] = draftEdit.value
    // Render Markdown to HTML
    const fixedMarkdown = fixMarkdownHeaders(this.draftContents[provider])
    draftDiv.innerHTML = marked.parse(fixedMarkdown) as string
    
    // Update character count
    const charCountTarget = this.getDraftCharCountTarget(provider)
    if (charCountTarget) {
      const charCount = this.draftContents[provider].length
      const countSpan = charCountTarget.querySelector('.font-semibold')
      if (countSpan) {
        countSpan.textContent = charCount.toString()
      }
    }
    
    // Switch back to view mode
    this.draftEditMode[provider] = false
    draftDiv.style.display = "block"
    draftEdit.style.display = "none"
    
    // Switch buttons
    if (editDraftButton) editDraftButton.style.display = "inline-flex"
    if (saveDraftButton) saveDraftButton.style.display = "none"
    if (copyHtmlButton) copyHtmlButton.style.display = "inline-flex"
    if (copyMarkdownButton) copyMarkdownButton.style.display = "inline-flex"
    
    showToast("已保存", "success")
  }

  // Copy draft HTML (with styles)
  copyDraftHtml(event: Event): void {
    const button = event.currentTarget as HTMLElement
    const provider = button.dataset.provider
    
    if (!provider) return
    
    const draftDiv = this.getDraftTarget(provider)
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
  copyDraftMarkdown(event: Event): void {
    const button = event.currentTarget as HTMLElement
    const provider = button.dataset.provider
    
    if (!provider || !this.draftContents[provider]) return
    
    navigator.clipboard.writeText(this.draftContents[provider]).then(() => {
      showToast("已复制Markdown", "success")
    }).catch(err => {
      console.error("Failed to copy:", err)
      showToast("复制失败", "danger")
    })
  }

  // Generate all drafts at once
  generateAllDrafts(): void {
    if (!this.currentArticleId) {
      showToast("文章ID不存在，请重新开始", "danger")
      return
    }
    
    // Check if at least one brainstorm content exists
    const hasAnyBrainstorm = Object.values(this.responseContents).some(content => content.length > 0)
    if (!hasAnyBrainstorm) {
      showToast("请先完成AI脑爆", "warning")
      return
    }
    
    // CRITICAL: Check if we're coming from a loaded historical article
    // If yes, create a NEW article instead of reusing the current one
    const urlParams = new URLSearchParams(window.location.search)
    const isFromHistory = urlParams.has('article_id')
    
    if (isFromHistory) {
      console.log('Creating new article from historical article:', this.currentArticleId)
      showToast("正在创建新文章并生成初稿...", "info")
      
      // Clear current article_id to force creation of new article
      this.currentArticleId = null
      
      // Hide the button after clicking
      if (this.generateAllDraftsButtonTarget) {
        this.generateAllDraftsButtonTarget.style.display = "none"
      }
      
      // Reset UI state for new article generation
      this.completedModels.clear()
      this.completedDrafts.clear()
      
      // Trigger backend to create new article and generate brainstorm + drafts
      if (this.commandSubscription) {
        this.commandSubscription.perform("create_new_from_existing", {
          transcript: this.originalTranscript,
          writing_style: this.writingStyleValue,
          thinking_framework: this.getSelectedThinkingFramework()
        })
      }
    } else {
      // Normal flow: generate drafts for current article
      console.log('Generating all drafts for article:', this.currentArticleId)
      showToast("开始生成所有初稿...", "info")
      
      // Hide the button after clicking
      if (this.generateAllDraftsButtonTarget) {
        this.generateAllDraftsButtonTarget.style.display = "none"
      }
      
      // Call the existing triggerAllDraftsGeneration method
      this.triggerAllDraftsGeneration()
    }
  }

  // Update progress bar for a specific provider
  private updateProgress(provider: string, progress: number): void {    
    this.modelProgress[provider] = progress
    
    // Update progress bar width
    const progressBar = this.getProgressBarTarget(provider)
    const progressText = this.getProgressTextTarget(provider)
    
    if (progressBar) {
      progressBar.style.width = `${progress}%`
    }
    
    if (progressText) {
      progressText.textContent = `${Math.floor(progress)}%`
    }
    
    // Check if this model reached 100% and trigger fireworks
    if (progress >= 100) {
      this.launchFireworks(provider)
    }
  }
  
  // Start smooth progress animation
  private startSmoothProgress(provider: string): void {
    // Clear any existing interval
    this.stopSmoothProgress(provider)
    
    const targetProgress = this.progressTargets[provider]
    const currentProgress = this.modelProgress[provider]
    
    // Don't start if already at or above target
    if (currentProgress >= targetProgress) return
    
    // Random duration between 15-30 seconds to reach target
    const duration = 15000 + Math.random() * 15000
    const steps = duration / 100 // Update every 100ms
    const increment = (targetProgress - currentProgress) / steps
    
    this.progressIntervals[provider] = window.setInterval(() => {
      const current = this.modelProgress[provider]
      const target = this.progressTargets[provider]
      
      if (current < target) {
        // Add some randomness to make it look more natural
        const randomIncrement = increment * (0.8 + Math.random() * 0.4)
        const newProgress = Math.min(current + randomIncrement, target)
        this.updateProgress(provider, newProgress)
      } else {
        // Stop when reaching target
        this.stopSmoothProgress(provider)
      }
    }, 100)
  }
  
  // Stop smooth progress animation
  private stopSmoothProgress(provider: string): void {
    if (this.progressIntervals[provider]) {
      window.clearInterval(this.progressIntervals[provider]!)
      this.progressIntervals[provider] = null
    }
  }
  
  // Get progress bar target for a specific provider
  private getProgressBarTarget(provider: string): HTMLElement | null {
    switch (provider) {
      case 'grok': return this.progressBarGrokTarget
      case 'qwen': return this.progressBarQwenTarget
      case 'deepseek': return this.progressBarDeepseekTarget
      case 'gemini': return this.progressBarGeminiTarget
      case 'doubao': return this.progressBarDoubaoTarget
      default: return null
    }
  }
  
  // Get progress text target for a specific provider
  private getProgressTextTarget(provider: string): HTMLElement | null {
    switch (provider) {
      case 'grok': return this.progressTextGrokTarget
      case 'qwen': return this.progressTextQwenTarget
      case 'deepseek': return this.progressTextDeepseekTarget
      case 'gemini': return this.progressTextGeminiTarget
      case 'doubao': return this.progressTextDoubaoTarget
      default: return null
    }
  }
  
  // Launch fireworks animation when a model reaches 100%
  private launchFireworks(provider: string): void {
    const modelNames: { [key: string]: string } = {
      grok: "Grok",
      qwen: "千问",
      deepseek: "DeepSeek",
      gemini: "Gemini",
      doubao: "豆包"
    }
    
    console.log(`🎆 Fireworks for ${modelNames[provider]}!`)
    
    // Create fireworks container
    const fireworksContainer = document.createElement('div')
    fireworksContainer.className = 'fixed inset-0 pointer-events-none z-50'
    fireworksContainer.style.overflow = 'hidden'
    document.body.appendChild(fireworksContainer)
    
    // Create multiple firework particles
    const colors = [
      '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff',
      '#ff8800', '#88ff00', '#0088ff', '#ff0088', '#8800ff', '#00ff88'
    ]
    
    const particleCount = 50
    const centerX = Math.random() * window.innerWidth
    const centerY = Math.random() * (window.innerHeight * 0.6) + window.innerHeight * 0.1
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div')
      particle.className = 'absolute w-2 h-2 rounded-full'
      particle.style.left = `${centerX}px`
      particle.style.top = `${centerY}px`
      particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)]
      particle.style.transition = 'all 1s ease-out'
      
      fireworksContainer.appendChild(particle)
      
      // Animate particle
      setTimeout(() => {
        const angle = (Math.PI * 2 * i) / particleCount
        const velocity = 100 + Math.random() * 100
        const tx = Math.cos(angle) * velocity
        const ty = Math.sin(angle) * velocity
        
        particle.style.transform = `translate(${tx}px, ${ty}px)`
        particle.style.opacity = '0'
      }, 10)
    }
    
    // Remove fireworks container after animation
    setTimeout(() => {
      document.body.removeChild(fireworksContainer)
    }, 1500)
    
    // Show toast notification
    showToast(`🎉 ${modelNames[provider]} 生成完成！`, "success")
  }
}
