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
  def perform(stream_name:, prompt:, llm_config: nil, article_id: nil, provider: nil, thinking_framework: 'original', **options)
    # Detect provider and build appropriate system prompt
    provider_name = llm_config ? detect_provider(llm_config) : 'Grok'
    
    # For draft and final, don't wrap with system prompt
    system_prompt = if provider == 'draft' || provider == 'final'
                      nil
                    else
                      build_system_prompt(provider_name, thinking_framework)
                    end
    
    # Merge llm_config into options if provided
    options = options.merge(llm_config) if llm_config
    
    generate_and_stream(stream_name, prompt, system_prompt, article_id, provider, **options)
  end
  
  private
  
  def detect_provider(llm_config)
    base_url = llm_config[:base_url] || llm_config['base_url']
    return 'Qwen' if base_url&.include?('dashscope')
    return 'DeepSeek' if base_url&.include?('deepseek')
    return 'Gemini' if base_url&.include?('generativelanguage')
    return 'Zhipu' if base_url&.include?('bigmodel')
    return 'ChatGPT' if base_url&.include?('openai')
    'Grok'
  end
  
  def build_system_prompt(provider_name, thinking_framework = 'original')
    # Get framework-specific prompt content
    framework_prompt = get_framework_prompt(thinking_framework)
    
    # Build provider-specific system prompt with framework content
    case provider_name
    when 'Qwen'
      <<~PROMPT.strip
        你是千问，来自阿里云。用户会分享他的想法、观点或内容。
        
        #{framework_prompt}
        
        直接输出你的回应，不要加任何解释或套话。
      PROMPT
    when 'DeepSeek'
      <<~PROMPT.strip
        你是 DeepSeek，一个专注于深度思考的 AI 助手。用户会分享他的想法、观点或内容。
        
        #{framework_prompt}
        
        直接输出你的回应，不要加任何解释或套话。
      PROMPT
    when 'Gemini'
      <<~PROMPT.strip
        你是 Gemini，来自 Google。用户会分享他的想法、观点或内容。
        
        #{framework_prompt}
        
        直接输出你的回应，不要加任何解释或套话。
      PROMPT
    when 'Zhipu'
      <<~PROMPT.strip
        你是智谱 GLM，来自智谱 AI。用户会分享他的想法、观点或内容。
        
        #{framework_prompt}
        
        直接输出你的回应，不要加任何解释或套话。
      PROMPT
    when 'ChatGPT'
      <<~PROMPT.strip
        你是 ChatGPT，来自 OpenAI。用户会分享他的想法、观点或内容。
        
        #{framework_prompt}
        
        直接输出你的回应，不要加任何解释或套话。
      PROMPT
    else # Grok or default
      <<~PROMPT.strip
        你是 Grok，来自 xAI。用户会分享他的想法、观点或内容。
        
        #{framework_prompt}
        
        直接输出你的回应，不要加任何解释或套话。
      PROMPT
    end
  end
  
  def get_framework_prompt(framework)
    case framework
    when 'original'
      <<~PROMPT.strip
        请你：
        1. 原汁原味地理解用户的表达
        2. 分享你的真实想法、思路、观点、建议
        3. 保持专业、友好、有洞见的风格
        4. 不要扩写、不要改写、不要帮用户写文章
        5. 就像朋友之间的思想交流，说出你真实的思考
      PROMPT
    when 'experience'
      <<~PROMPT.strip
        请你按照「见感思行」框架回应：
        1. 【见】- 你看到了什么？（客观观察）
        2. 【感】- 你有什么感受？（主观体验）
        3. 【思】- 你思考到什么？（深度分析）
        4. 【行】- 你建议怎么做？（具体行动）
        
        注意：不要扩写、不要改写，只需按这四个维度分享你的思考。
      PROMPT
    when 'golden_circle'
      <<~PROMPT.strip
        请你按照「黄金圈」框架回应：
        1. 【Why】- 为什么这个话题重要？核心意义是什么？
        2. 【How】- 怎样实现或理解这个想法？方法论是什么？
        3. 【What】- 具体是什么？有哪些实际例子或应用？
        
        注意：不要扩写、不要改写，只需按这三个层次分享你的思考。
      PROMPT
    when 'colloquial'
      <<~PROMPT.strip
        请你用「口语化写作」风格回应：
        1. 用口语化的方式表达，像聊天一样自然
        2. 多用短句、常用词汇，避免书面语
        3. 可以用“你知道吗”、“我觉得”、“比如说”等口语化表达
        4. 多用故事、例子、比喻，让内容更生动
        5. 保持亲切、轻松的语气
        
        注意：不要扩写、不要改写，只需用口语化的方式分享你的思考。
      PROMPT
    else
      # Default to 'original' if framework is unknown
      get_framework_prompt('original')
    end
  end
  
  def generate_and_stream(stream_name, prompt, system, article_id, provider, **options)
    full_content = ""
    
    LlmService.call(prompt: prompt, system: system, **options) do |chunk|
      full_content += chunk
      ActionCable.server.broadcast(stream_name, {
        type: 'chunk',
        chunk: chunk
      })
    end
    
    # Save to database based on provider
    if article_id && provider
      article = Article.find_by(id: article_id)
      if article
        case provider
        when 'grok'
          article.update!(brainstorm_grok: full_content)
        when 'qwen'
          article.update!(brainstorm_qwen: full_content)
        when 'deepseek'
          article.update!(brainstorm_deepseek: full_content)
        when 'gemini'
          article.update!(brainstorm_gemini: full_content)
        when 'zhipu'
          article.update!(brainstorm_zhipu: full_content)
        when 'draft'
          article.update!(draft: full_content)
        when 'final'
          article.update!(final_content: full_content)
        end
      end
    end
    
    ActionCable.server.broadcast(stream_name, {
      type: 'complete',
      content: full_content
    })
  end
end
