class LlmStreamJob < ApplicationJob
  queue_as :llm

  # Retry strategy configuration
  retry_on Net::ReadTimeout, wait: 5.seconds, attempts: 3
  retry_on LlmService::TimeoutError, wait: 5.seconds, attempts: 3
  retry_on LlmService::ApiError, wait: 10.seconds, attempts: 2

  # Streaming LLM responses via ActionCable for article generation
  # This job handles the two-step article generation process:
  # 1. Generate AI's thinking/analysis
  # 2. Generate the final article by fusing user's original text + AI's thinking
  #
  # Usage:
  #   LlmStreamJob.perform_later(
  #     stream_name: 'article_123',
  #     step: 'thinking',           # 'thinking' or 'article'
  #     prompt: "user's voice text",
  #     grok_thinking: "..."        # only for step='article'
  #     model: 'anthropic/claude-3.5-sonnet',  # optional, defaults to ENV['LLM_MODEL']
  #     provider: 'anthropic'       # optional, auto-detected from model name
  #   )
  def perform(stream_name:, step:, prompt:, grok_thinking: nil, model: nil, provider: nil, **options)
    # Add model and provider to options if provided
    options[:model] = model if model.present?
    options[:provider] = provider if provider.present?
    
    case step
    when 'thinking'
      # Step 1: No system prompt - let AI respond freely to user's raw input
      system_prompt = ""
      generate_and_stream(stream_name, prompt, system_prompt, **options)
      
    when 'article'
      # Step 2: Generate final article by fusing user's original text + AI's thinking
      raise ArgumentError, "grok_thinking is required for step='article'" if grok_thinking.blank?
      
      # Determine AI name based on model/provider
      ai_name = determine_ai_name(options[:model], options[:provider])
      
      system_prompt = <<~PROMPT.strip
        你是 #{ai_name}。现在有两部分素材：
        '我的原始表达：#{prompt}'
        '我的深层思考：#{grok_thinking}'
        
        请将这两部分**完全融为一体**，从我的第一人称视角，写成一篇面向第三方读者的文章。
        
        要求：
        1. **绝对不能出现**："#{ai_name} 提到"、"有人说"、"根据分析"等第三方引用
        2. **完全用我的口吻**：就像我自己消化思考后写出来的，看不出任何拼接痕迹
        3. **保持 #{ai_name} 风格**：直接、深刻、有洞见、不废话、不套话
        4. **长度控制**：1300 字以内（根据内容自然决定，不要为了凑字数而啰嗦）
        5. **结构自由**：不强制开头/正文/结尾，跟随内容自然展开
        6. **面向读者**：像在跟朋友分享，不是自言自语，有沟通感
        
        直接输出文章正文，不要加标题、解释、引号或任何多余内容。
      PROMPT
      
      # For article step, use a generic prompt asking for article generation
      article_prompt = "请根据上述系统提示中的两部分内容，生成一篇完整的文章。"
      generate_and_stream(stream_name, article_prompt, system_prompt, **options)
      
    else
      raise ArgumentError, "Unknown step: #{step}. Must be 'thinking' or 'article'"
    end
  end
  
  private
  
  def determine_ai_name(model, provider)
    # Provider-based detection
    case provider.to_s.downcase
    when 'anthropic' then return 'Claude'
    when 'openai' then return 'GPT'
    when 'google' then return 'Gemini'
    when 'xai' then return 'Grok'
    when 'meta' then return 'Llama'
    when 'mistral' then return 'Mistral'
    when 'cohere' then return 'Command'
    when 'perplexity' then return 'Sonar'
    when 'deepseek' then return 'DeepSeek'
    when 'qwen' then return 'Qwen'
    when 'microsoft' then return 'WizardLM'
    when 'ai21' then return 'Jamba'
    end
    
    # Fallback: detect from model name
    model_lower = model.to_s.downcase
    return 'Claude' if model_lower.include?('claude')
    return 'GPT' if model_lower.include?('gpt') || model_lower.include?('o1')
    return 'Gemini' if model_lower.include?('gemini')
    return 'Grok' if model_lower.include?('grok')
    return 'Llama' if model_lower.include?('llama')
    return 'Mistral' if model_lower.include?('mistral') || model_lower.include?('mixtral')
    return 'Command' if model_lower.include?('command')
    return 'Sonar' if model_lower.include?('sonar')
    return 'DeepSeek' if model_lower.include?('deepseek')
    return 'Qwen' if model_lower.include?('qwen')
    return 'WizardLM' if model_lower.include?('wizard')
    return 'Jamba' if model_lower.include?('jamba')
    
    'AI' # generic fallback
  end
  
  def generate_and_stream(stream_name, prompt, system, **options)
    full_content = ""
    
    LlmService.call(prompt: prompt, system: system, **options) do |chunk|
      full_content += chunk
      ActionCable.server.broadcast(stream_name, {
        type: 'chunk',
        chunk: chunk
      })
    end
    
    ActionCable.server.broadcast(stream_name, {
      type: 'complete',
      content: full_content
    })
  end
end
