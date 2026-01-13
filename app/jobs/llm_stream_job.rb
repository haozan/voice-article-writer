class LlmStreamJob < ApplicationJob
  queue_as :llm

  # Retry strategy configuration
  retry_on Net::ReadTimeout, wait: 5.seconds, attempts: 3
  retry_on LlmService::TimeoutError, wait: 5.seconds, attempts: 3
  retry_on LlmService::ApiError, wait: 10.seconds, attempts: 2

  # Streaming LLM responses via ActionCable for article generation
  # This job handles single-step Grok response:
  # - User provides original thoughts
  # - Grok shares his thinking, ideas, and suggestions (no expansion)
  #
  # Usage:
  #   LlmStreamJob.perform_later(
  #     stream_name: 'article_123',
  #     prompt: "user's original text"
  #   )
  def perform(stream_name:, prompt:, **options)
    # Grok shares his raw thinking and response
    system_prompt = <<~PROMPT.strip
      你是 Grok，来自 xAI。用户会分享他的想法、观点或内容。
      
      请你：
      1. 原汁原味地理解用户的表达
      2. 分享你的真实想法、思路、观点、建议
      3. 保持 Grok 的风格：直接、深刻、有洞见、不废话
      4. 不要扩写、不要改写、不要帮用户写文章
      5. 就像朋友之间的思想交流，说出你真实的思考
      
      直接输出你的回应，不要加任何解释或套话。
    PROMPT
    
    generate_and_stream(stream_name, prompt, system_prompt, **options)
  end
  
  private
  
  def detect_provider(llm_config)
    base_url = llm_config[:base_url] || llm_config['base_url']
    return 'Qwen' if base_url&.include?('dashscope')
    'Grok'
  end
  
  def build_system_prompt(provider_name)
    case provider_name
    when 'Qwen'
      <<~PROMPT.strip
        你是千问，来自阿里云。用户会分享他的想法、观点或内容。
        
        请你：
        1. 原汁原味地理解用户的表达
        2. 分享你的真实想法、思路、观点、建议
        3. 保持专业、友好、有洞见的风格
        4. 不要扩写、不要改写、不要帮用户写文章
        5. 就像朋友之间的思想交流，说出你真实的思考
        
        直接输出你的回应，不要加任何解释或套话。
      PROMPT
    else # Grok or default
      <<~PROMPT.strip
        你是 Grok，来自 xAI。用户会分享他的想法、观点或内容。
        
        请你：
        1. 原汁原味地理解用户的表达
        2. 分享你的真实想法、思路、观点、建议
        3. 保持 Grok 的风格：直接、深刻、有洞见、不废话
        4. 不要扩写、不要改写、不要帮用户写文章
        5. 就像朋友之间的思想交流，说出你真实的思考
        
        直接输出你的回应，不要加任何解释或套话。
      PROMPT
    end
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
