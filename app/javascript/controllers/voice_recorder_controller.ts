import { Controller } from "@hotwired/stimulus"
import { showToast } from "../toast"

/**
 * Voice Recorder Controller - Handles voice recording with Web Speech API
 *
 * Targets:
 * - micButton: The microphone button (long press to record)
 * - transcript: Display area for recognized text
 * - statusText: Status indicator text
 *
 * Actions:
 * - data-action="mousedown->voice-recorder#startRecording touchstart->voice-recorder#startRecording"
 * - data-action="mouseup->voice-recorder#stopRecording touchend->voice-recorder#stopRecording"
 */
export default class extends Controller<HTMLElement> {
  static targets = ["micButton", "transcript", "statusText"]

  declare readonly micButtonTarget: HTMLElement
  declare readonly transcriptTarget: HTMLElement
  declare readonly statusTextTarget: HTMLElement
  declare readonly hasTranscriptTarget: boolean
  declare readonly hasStatusTextTarget: boolean

  private recognition: any = null
  private isRecording: boolean = false
  private isStopping: boolean = false
  private finalTranscript: string = ""
  private interimTranscript: string = ""

  connect(): void {
    console.log("[Voice] VoiceRecorder controller connected")
    this.setupSpeechRecognition()
  }

  disconnect(): void {
    console.log("VoiceRecorder disconnected")
    if (this.recognition) {
      this.recognition.stop()
    }
  }

  private setupSpeechRecognition(): void {
    // Check if browser supports Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    
    if (!SpeechRecognition) {
      console.error("[Voice] Web Speech API not supported in this browser")
      this.updateStatus("您的浏览器不支持语音识别")
      return
    }

    console.log("[Voice] Setting up speech recognition with zh-CN")
    this.recognition = new SpeechRecognition()
    this.recognition.lang = "zh-CN" // Chinese language
    this.recognition.continuous = true // Continue listening even after user pauses
    this.recognition.interimResults = true // Get interim results as user speaks
    this.recognition.maxAlternatives = 1
    console.log("[Voice] Recognition configured:", {
      lang: this.recognition.lang,
      continuous: this.recognition.continuous,
      interimResults: this.recognition.interimResults
    })

    // Handle results
    this.recognition.onresult = (event: any) => {
      console.log("[Voice] Recognition result received:", event.results.length, "results")
      let interim = ""
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        const isFinal = event.results[i].isFinal
        console.log(`[Voice] Result ${i}: "${transcript}" (final: ${isFinal})`)
        
        if (isFinal) {
          this.finalTranscript += transcript
        } else {
          interim += transcript
        }
      }
      
      this.interimTranscript = interim
      console.log(`[Voice] Final transcript so far: "${this.finalTranscript}"`)
      console.log(`[Voice] Interim transcript: "${this.interimTranscript}"`)
      this.updateTranscript()
    }

    // Handle errors
    this.recognition.onerror = (event: any) => {
      // Ignore 'aborted' errors - they are expected when manually stopping
      if (event.error === "aborted") {
        console.log("Speech recognition aborted (expected during stop)")
        return
      }
      
      console.error("Speech recognition error:", event.error)
      
      let errorMessage = "识别错误"
      switch (event.error) {
        case "no-speech":
          errorMessage = "未检测到语音，请重试"
          break
        case "audio-capture":
          errorMessage = "无法访问麦克风"
          break
        case "not-allowed":
          errorMessage = "麦克风权限被拒绝"
          break
        case "network":
          errorMessage = "网络错误"
          break
        default:
          errorMessage = `识别错误: ${event.error}`
      }
      
      this.updateStatus(errorMessage)
      this.stopRecording()
    }

    // Handle start
    this.recognition.onstart = () => {
      console.log("[Voice] ✓ Recognition started successfully")
      this.updateStatus("正在录音... 再次点击结束")
    }

    // Handle end
    this.recognition.onend = () => {
      console.log("[Voice] Recognition ended, isRecording:", this.isRecording, "isStopping:", this.isStopping)
      // Only restart if still recording AND not in the process of stopping
      if (this.isRecording && !this.isStopping) {
        console.log("[Voice] Auto-restarting recognition for continuous mode")
        try {
          this.recognition.start()
        } catch (error) {
          console.error("[Voice] Failed to restart recognition:", error)
          this.stopRecording()
        }
      }
    }
  }

  async startRecording(event: Event): Promise<void> {
    event.preventDefault()
    console.log("[Voice] startRecording called")
    
    if (!this.recognition) {
      console.error("[Voice] Recognition not available")
      this.updateStatus("语音识别不可用")
      return
    }

    // If already recording, stop it
    if (this.isRecording) {
      console.log("[Voice] Already recording, stopping...")
      this.stopRecording()
      return
    }

    // Request microphone permission first
    console.log("[Voice] Requesting microphone permission...")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log("[Voice] ✓ Microphone permission granted")
      // Stop the test stream immediately
      stream.getTracks().forEach(track => track.stop())
    } catch (error) {
      console.error("[Voice] Microphone permission denied:", error)
      this.updateStatus("请允许使用麦克风")
      showToast("请在浏览器中允许使用麦克风，然后刷新页面重试", "danger")
      return
    }

    console.log("[Voice] Starting new recording...")
    this.isRecording = true
    this.finalTranscript = ""
    this.interimTranscript = ""
    this.updateTranscript()
    
    // Update UI
    this.micButtonTarget.classList.add("recording")
    this.updateStatus("正在启动...")

    // Dispatch custom event to notify other controllers
    this.dispatch("started", { detail: {} })

    try {
      this.recognition.start()
      console.log("[Voice] Recognition.start() called, waiting for onstart event...")
    } catch (error) {
      console.error("[Voice] Failed to start recognition:", error)
      this.updateStatus("启动录音失败")
      this.isRecording = false
      this.micButtonTarget.classList.remove("recording")
    }
  }

  stopRecording(event?: Event): void {
    if (event) {
      event.preventDefault()
    }

    console.log("[Voice] stopRecording called, isRecording:", this.isRecording)

    if (!this.isRecording) {
      return
    }

    // Set stopping flag to prevent restart in onend handler
    this.isStopping = true
    this.isRecording = false
    
    if (this.recognition) {
      this.recognition.stop()
      console.log("[Voice] Recognition.stop() called")
    }
    
    // Reset stopping flag after a short delay
    setTimeout(() => {
      this.isStopping = false
    }, 100)

    // Update UI
    this.micButtonTarget.classList.remove("recording")
    this.updateStatus("录音完成")

    // Add any remaining interim results to final
    if (this.interimTranscript) {
      console.log(`[Voice] Adding interim to final: "${this.interimTranscript}"`)
      this.finalTranscript += this.interimTranscript
      this.interimTranscript = ""
      this.updateTranscript()
    }

    console.log(`[Voice] Final transcript at stop: "${this.finalTranscript}"`)

    // Dispatch custom event with final transcript
    if (this.finalTranscript.trim()) {
      console.log("[Voice] Dispatching completed event with transcript")
      this.dispatch("completed", { 
        detail: { 
          transcript: this.finalTranscript.trim() 
        } 
      })
    } else {
      console.log("[Voice] No transcript content, showing error message")
      this.updateStatus("未识别到语音内容")
    }
  }

  private updateTranscript(): void {
    if (!this.hasTranscriptTarget) return

    const fullText = this.finalTranscript + this.interimTranscript
    this.transcriptTarget.textContent = fullText || "点击麦克风开始说话..."
    
    // Update data attribute for other controllers to access
    this.element.dataset.transcript = this.finalTranscript
  }

  private updateStatus(message: string): void {
    if (this.hasStatusTextTarget) {
      this.statusTextTarget.textContent = message
    }
  }

  // Public method to get current transcript
  getTranscript(): string {
    return this.finalTranscript.trim()
  }

  // Public method to clear transcript
  clearTranscript(): void {
    this.finalTranscript = ""
    this.interimTranscript = ""
    this.updateTranscript()
  }
}
