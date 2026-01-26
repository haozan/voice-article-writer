class ArticlesChannel < ApplicationCable::Channel
  def subscribed
    # Stream name follows "resource_id" pattern (e.g., "post_123", "user_456")
    @stream_name = params[:stream_name]
    reject unless @stream_name

    # TODO: Add stream validation if needed (pattern check, ownership, etc.)
    stream_from @stream_name
  rescue StandardError => e
    handle_channel_error(e)
    reject
  end
  
  def build_draft_prompt(transcript, brainstorm_content, model_display_name)
    <<~PROMPT
      ⚠️ 【核心任务】
      你现在是作者本人，要将自己的初步想法和深度思考融合成一篇完整文章。
      
      🚫 【绝对禁止】（违反任何一条都算失败）
      1. 禁止第三方视角：不能出现"有人说"、"根据XX"、"XX提到"、"分析认为"等旁观者表述
      2. 禁止介绍性语气：不能用"这个系统"、"这套方法"等介绍已有事物的口吻
      3. 禁止可见拼接：不能让读者感觉是两段内容拼在一起
      4. 禁止引用原文：不能直接引用下面素材的原话，要彻底消化后重新表达
      5. **禁止内容扩展**：不能添加素材中没有的信息、案例、细节（这是最严重的违规！）
      6. **禁止详细展开**：如果素材只是提到，就不要详细描述（如：素材说"6个模型"，你不能展开写每个模型的内容）
      
      ✅ 【必须做到】
      1. 纯第一人称："我最近..."、"我发现..."、"我试了..."（像日记或博客）
      2. 自然流畅：像自己思考后一气呵成写出来的，不是整理他人观点
      3. 保持 #{model_display_name} 风格：直接、深刻、有洞见、口语化、不套话
      4. 面向读者：像跟朋友面对面聊天，有互动感（如："你试过吗？"、"关键是..."）
      5. **严格控制长度**：融合结果应该在（素材1字数 + 素材2字数）× 1.5 倍以内，绝不超过
      6. **只整合已有信息**：素材提到什么就写什么，不提到的一律不写，不脑补，不举例
      
      ⚡ 【关键原则：融合 ≠ 扩展】
      - ✅ 融合 = 把两段话用统一口吻重新说一遍（信息总量不变）
      - ❌ 扩展 = 基于两段话创造新内容（严重违规！）
      - 举例说明：
        - 素材说"提供了6个模型" → 融合："我搞了6个模型"（✅ 正确）
        - 素材说"提供了6个模型" → 扩展："第一个是XX，第二个是XX..."（❌ 严重违规！）
        - 素材说"针对不同场景" → 融合："每个针对不同场景"（✅ 正确）
        - 素材说"针对不同场景" → 扩展："比如通勤时、早上醒来时..."（❌ 严重违规！）
      
      📝 【格式要求 - 必须使用 Markdown】
      你**必须**使用 Markdown 格式输出，包括：
      - **标题结构**：使用 ## 二级标题 和 ### 三级标题来组织内容（不要使用 # 一级标题）
      - **重点强调**：用 **加粗** 标记关键词和重要观点
      - **列表**：用 - 或数字列表来呈现要点
      - **段落分隔**：段落之间空一行
      - **逻辑清晰**：用标题和列表让文章结构一目了然
      
      示例格式：
      ```
      ## 我的发现
      
      最近我在思考一个问题...
      
      ### 关键要点
      
      - **第一点**：重要内容
      - **第二点**：另一个要点
      
      ### 具体实践
      
      我尝试了以下方法：
      
      1. 首先做了...
      2. 然后发现...
      ```
      
      📝 【写作指南】
      - 角色：你就是作者本人，正在写一篇个人博客/公众号文章
      - 素材用法：下面的内容是你的笔记和草稿，现在要整理成正式文章
      - **内容取舍**：只能删减、重组、换说法，绝不能扩展、举例、详述
      - 输出要求：直接输出 Markdown 格式的文章正文，不要加文章总标题、解释或任何多余内容
      - **长度控制**：写完立即停止，不要为了凑字数而啰嗦
      
      ─────────────────────────
      【素材1：初步想法】
      #{transcript}
      
      【素材2：深度思考】
      #{brainstorm_content}
      ─────────────────────────
      
      现在，以第一人称、使用 Markdown 格式写出融合后的完整文章（直接开始，不要前言）：
      
      ⚠️ 【最终提醒】
      - 只整合素材中的信息，不扩展，不详述，不举例
      - 字数控制在素材总字数的1.5倍以内
      - 写完立即停止，不要为了达到某个字数而继续
      - **必须使用 Markdown 格式**：标题、加粗、列表等
    PROMPT
  end
  
  # Generate drafts for all providers concurrently
  def generate_all_drafts(data)
    article_id = data['article_id']
    
    article = Article.find(article_id)
    
    # List of all available providers (5 models displayed)
    providers = ['grok', 'qwen', 'deepseek', 'gemini', 'zhipu']
    
    # Trigger draft generation for all providers concurrently
    providers.each do |provider|
      # Check if brainstorm exists for this provider
      brainstorm_content = article.send("brainstorm_#{provider}")
      
      # Skip if no brainstorm content
      next if brainstorm_content.blank?
      
      # Set draft status to pending
      article.set_draft_status(provider, 'pending')
      
      # Get model display name
      model_display_name = case provider
      when 'grok' then 'Grok'
      when 'qwen' then 'Qwen'
      when 'deepseek' then 'DeepSeek'
      when 'gemini' then 'Gemini'
      when 'zhipu' then '智谱'
      when 'doubao' then '豆包'
      else provider.capitalize
      end
      
      # Build draft prompt
      draft_prompt = build_draft_prompt(article.transcript, brainstorm_content, model_display_name)
      
      llm_config = get_llm_config(provider)
      llm_config_with_timeout = llm_config.merge(timeout: 240, max_tokens: 8000)
      
      LlmStreamJob.perform_later(
        stream_name: "#{@stream_name}_draft_#{provider}",
        prompt: draft_prompt,
        llm_config: llm_config_with_timeout,
        article_id: article.id,
        provider: "draft_#{provider}",
        streaming: false
      )
    end
    
    # Broadcast that draft generation started
    ActionCable.server.broadcast(
      @stream_name,
      {
        type: 'all-drafts-started',
        article_id: article.id
      }
    )
  end
  
  # Regenerate a single provider's draft
  def regenerate_draft(data)
    article_id = data['article_id']
    provider = data['provider']
    
    unless article_id && provider
      Rails.logger.error "Missing article_id or provider for draft regeneration"
      return
    end
    
    article = Article.find_by(id: article_id)
    unless article
      Rails.logger.error "Article not found: #{article_id}"
      return
    end
    
    # Check if brainstorm exists
    brainstorm_content = article.send("brainstorm_#{provider}")
    if brainstorm_content.blank?
      Rails.logger.error "No brainstorm content for provider: #{provider}"
      return
    end
    
    # Clear previous error and set to pending
    article.set_draft_status(provider, 'pending')
    
    # Get model display name
    model_display_name = case provider
    when 'grok' then 'Grok'
    when 'qwen' then 'Qwen'
    when 'deepseek' then 'DeepSeek'
    when 'gemini' then 'Gemini'
    when 'zhipu' then '智谱'
    when 'doubao' then '豆包'
    else provider.capitalize
    end
    
    # Build draft prompt
    draft_prompt = build_draft_prompt(article.transcript, brainstorm_content, model_display_name)
    
    llm_config = get_llm_config(provider)
    llm_config_with_timeout = llm_config.merge(timeout: 240, max_tokens: 8000)
    
    LlmStreamJob.perform_later(
      stream_name: "#{@stream_name}_draft_#{provider}",
      prompt: draft_prompt,
      llm_config: llm_config_with_timeout,
      article_id: article.id,
      provider: "draft_#{provider}",
      streaming: false
    )
    
    # Broadcast regeneration started
    ActionCable.server.broadcast(
      @stream_name,
      {
        type: 'draft-regeneration-started',
        provider: provider,
        article_id: article.id
      }
    )
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  rescue StandardError => e
    handle_channel_error(e)
  end

  # 📨 CRITICAL: ALL broadcasts MUST have 'type' field (auto-routes to handleType method)
  #
  # EXAMPLE: Send new message
  # def send_message(data)
  #   message = Message.create!(content: data['content'])
  #
  #   ActionCable.server.broadcast(
  #     @stream_name,
  #     {
  #       type: 'new-message',  # REQUIRED: routes to handleNewMessage() in frontend
  #       id: message.id,
  #       content: message.content,
  #       user_name: message.user.name,
  #       created_at: message.created_at
  #     }
  #   )
  # end

  # EXAMPLE: Send status update
  # def update_status(data)
  #   ActionCable.server.broadcast(
  #     @stream_name,
  #     {
  #       type: 'status-update',  # Routes to handleStatusUpdate() in frontend
  #       status: data['status']
  #     }
  #   )
  # end
  # Generate response with ALL available LLM providers concurrently
  def generate_response(data)
    transcript = data['transcript']
    article_id = data['article_id']
    thinking_framework = data['thinking_framework'] || 'original'
    # Use blocking (non-streaming) mode by default to fix Markdown format issues
    streaming = data['streaming'] || false
    
    # Create or update article with transcript and thinking_framework
    article = if article_id.present?
                Article.find(article_id)
              else
                # Associate with current_user if authenticated
                article_attrs = { transcript: transcript, thinking_framework: thinking_framework }
                article_attrs[:user_id] = current_user.id if current_user
                Article.create!(article_attrs)
              end
    
    # List of all available providers (Doubao hidden)
    providers = ['grok', 'qwen', 'deepseek', 'gemini', 'zhipu']
    
    # Trigger jobs for all providers concurrently
    providers.each do |provider|
      llm_config = get_llm_config(provider)
      
      # Set pending status before triggering job
      article.set_brainstorm_status(provider, 'pending')
      
      LlmStreamJob.perform_later(
        stream_name: "#{@stream_name}_#{provider}",
        prompt: transcript,
        llm_config: llm_config,
        article_id: article.id,
        provider: provider,
        thinking_framework: thinking_framework,
        streaming: streaming
      )
    end
    
    # Broadcast article_id back to frontend
    ActionCable.server.broadcast(
      @stream_name,
      {
        type: 'article-created',
        article_id: article.id
      }
    )
  end
  
  # Regenerate a single provider's brainstorm
  def regenerate_provider(data)
    article_id = data['article_id']
    provider = data['provider']
    
    unless article_id && provider
      Rails.logger.error "Missing article_id or provider for regeneration"
      return
    end
    
    article = Article.find_by(id: article_id)
    unless article
      Rails.logger.error "Article not found: #{article_id}"
      return
    end
    
    # Clear previous error and set to pending
    article.set_brainstorm_status(provider, 'pending')
    
    # Get LLM config for provider
    llm_config = get_llm_config(provider)
    
    # Trigger job for this provider
    LlmStreamJob.perform_later(
      stream_name: "#{@stream_name}_#{provider}",
      prompt: article.transcript,
      llm_config: llm_config,
      article_id: article.id,
      provider: provider,
      thinking_framework: article.thinking_framework || 'original',
      streaming: data['streaming'] || false
    )
    
    # Broadcast regeneration started
    ActionCable.server.broadcast(
      @stream_name,
      {
        type: 'regeneration-started',
        provider: provider,
        article_id: article.id
      }
    )
  end
  
  # Generate draft by combining transcript + all brainstorm results
  def generate_draft(data)
    article_id = data['article_id']
    selected_model = data['selected_model']
    
    article = Article.find(article_id)
    article.update!(selected_model: selected_model)
    
    # 根据选中的模型获取对应的脑爆内容
    selected_brainstorm = case selected_model.to_s
    when 'grok'
      article.brainstorm_grok
    when 'qwen'
      article.brainstorm_qwen
    when 'deepseek'
      article.brainstorm_deepseek
    when 'gemini'
      article.brainstorm_gemini
    when 'zhipu'
      article.brainstorm_zhipu
    when 'doubao'
      article.brainstorm_doubao
    else
      article.brainstorm_grok # 默认使用 Grok
    end
    
    # 获取模型的显示名称
    model_display_name = case selected_model.to_s
    when 'grok' then 'Grok'
    when 'qwen' then 'Qwen'
    when 'deepseek' then 'DeepSeek'
    when 'gemini' then 'Gemini'
    when 'zhipu' then '智谱'
    when 'doubao' then '豆包'
    else 'Grok'
    end
    
    # 优化后的融合 prompt（严格控制内容边界）
    draft_prompt = <<~PROMPT
      ⚠️ 【核心任务】
      你现在是作者本人，要将自己的初步想法和深度思考融合成一篇完整文章。
      
      🚫 【绝对禁止】（违反任何一条都算失败）
      1. 禁止第三方视角：不能出现"有人说"、"根据XX"、"XX提到"、"分析认为"等旁观者表述
      2. 禁止介绍性语气：不能用"这个系统"、"这套方法"等介绍已有事物的口吻
      3. 禁止可见拼接：不能让读者感觉是两段内容拼在一起
      4. 禁止引用原文：不能直接引用下面素材的原话，要彻底消化后重新表达
      5. **禁止内容扩展**：不能添加素材中没有的信息、案例、细节（这是最严重的违规！）
      6. **禁止详细展开**：如果素材只是提到，就不要详细描述（如：素材说"6个模型"，你不能展开写每个模型的内容）
      
      ✅ 【必须做到】
      1. 纯第一人称："我最近..."、"我发现..."、"我试了..."（像日记或博客）
      2. 自然流畅：像自己思考后一气呵成写出来的，不是整理他人观点
      3. 保持 #{model_display_name} 风格：直接、深刻、有洞见、口语化、不套话
      4. 面向读者：像跟朋友面对面聊天，有互动感（如："你试过吗？"、"关键是..."）
      5. **严格控制长度**：融合结果应该在（素材1字数 + 素材2字数）× 1.5 倍以内，绝不超过
      6. **只整合已有信息**：素材提到什么就写什么，不提到的一律不写，不脑补，不举例
      
      ⚡ 【关键原则：融合 ≠ 扩展】
      - ✅ 融合 = 把两段话用统一口吻重新说一遍（信息总量不变）
      - ❌ 扩展 = 基于两段话创造新内容（严重违规！）
      - 举例说明：
        - 素材说"提供了6个模型" → 融合："我搞了6个模型"（✅ 正确）
        - 素材说"提供了6个模型" → 扩展："第一个是XX，第二个是XX..."（❌ 严重违规！）
        - 素材说"针对不同场景" → 融合："每个针对不同场景"（✅ 正确）
        - 素材说"针对不同场景" → 扩展："比如通勤时、早上醒来时..."（❌ 严重违规！）
      
      📝 【格式要求 - 必须使用 Markdown】
      你**必须**使用 Markdown 格式输出，包括：
      - **标题结构**：使用 ## 二级标题 和 ### 三级标题来组织内容（不要使用 # 一级标题）
      - **重点强调**：用 **加粗** 标记关键词和重要观点
      - **列表**：用 - 或数字列表来呈现要点
      - **段落分隔**：段落之间空一行
      - **逻辑清晰**：用标题和列表让文章结构一目了然
      
      示例格式：
      ```
      ## 我的发现
      
      最近我在思考一个问题...
      
      ### 关键要点
      
      - **第一点**：重要内容
      - **第二点**：另一个要点
      
      ### 具体实践
      
      我尝试了以下方法：
      
      1. 首先做了...
      2. 然后发现...
      ```
      
      📝 【写作指南】
      - 角色：你就是作者本人，正在写一篇个人博客/公众号文章
      - 素材用法：下面的内容是你的笔记和草稿，现在要整理成正式文章
      - **内容取舍**：只能删减、重组、换说法，绝不能扩展、举例、详述
      - 输出要求：直接输出 Markdown 格式的文章正文，不要加文章总标题、解释或任何多余内容
      - **长度控制**：写完立即停止，不要为了凑字数而啰嗦
      
      ─────────────────────────
      【素材1：初步想法】
      #{article.transcript}
      
      【素材2：深度思考】
      #{selected_brainstorm}
      ─────────────────────────
      
      现在，以第一人称、使用 Markdown 格式写出融合后的完整文章（直接开始，不要前言）：
      
      ⚠️ 【最终提醒】
      - 只整合素材中的信息，不扩展，不详述，不举例
      - 字数控制在素材总字数的1.5倍以内
      - 写完立即停止，不要为了达到某个字数而继续
      - **必须使用 Markdown 格式**：标题、加粗、列表等
    PROMPT
    
    llm_config = get_llm_config(selected_model)
    
    # CRITICAL: Draft generation needs longer timeout due to long prompt and content fusion
    # - Long prompt: ~180 lines of detailed instructions
    # - Content fusion: transcript + brainstorm content (can be 2000+ characters)
    # - Default 120s often causes timeout, especially for slower models like Zhipu
    # Also increase max_tokens to allow longer output (fusion of multiple contents)
    llm_config_with_timeout = llm_config.merge(timeout: 240, max_tokens: 8000)
    
    LlmStreamJob.perform_later(
      stream_name: "#{@stream_name}_draft",
      prompt: draft_prompt,
      llm_config: llm_config_with_timeout,
      article_id: article.id,
      provider: 'draft',
      streaming: false  # 使用非流式输出，等待完整内容生成后一次性显示
    )
  end
  
  private
  
  def get_llm_config(provider)
    case provider.to_s
    when 'qwen'
      {
        base_url: ENV.fetch('QWEN_BASE_URL_OPTIONAL'),
        api_key: ENV.fetch('QWEN_API_KEY_OPTIONAL'),
        model: ENV.fetch('QWEN_MODEL_OPTIONAL')
      }
    when 'deepseek'
      {
        base_url: ENV.fetch('DEEPSEEK_BASE_URL_OPTIONAL'),
        api_key: ENV.fetch('DEEPSEEK_API_KEY_OPTIONAL'),
        model: ENV.fetch('DEEPSEEK_MODEL_OPTIONAL')
      }
    when 'gemini'
      {
        base_url: ENV.fetch('GEMINI_BASE_URL_OPTIONAL'),
        api_key: ENV.fetch('GEMINI_API_KEY_OPTIONAL'),
        model: ENV.fetch('GEMINI_MODEL_OPTIONAL')
      }
    when 'zhipu'
      {
        base_url: ENV.fetch('ZHIPU_BASE_URL_OPTIONAL'),
        api_key: ENV.fetch('ZHIPU_API_KEY_OPTIONAL'),
        model: ENV.fetch('ZHIPU_MODEL_OPTIONAL')
      }
    when 'chatgpt'
      {
        base_url: ENV.fetch('CHATGPT_BASE_URL_OPTIONAL'),
        api_key: ENV.fetch('CHATGPT_API_KEY_OPTIONAL'),
        model: ENV.fetch('CHATGPT_MODEL_OPTIONAL')
      }
    when 'doubao'
      {
        base_url: ENV.fetch('DOUBAO_BASE_URL_OPTIONAL'),
        api_key: ENV.fetch('DOUBAO_API_KEY_OPTIONAL'),
        model: ENV.fetch('DOUBAO_MODEL_OPTIONAL')
      }
    when 'grok'
      {
        base_url: ENV.fetch('LLM_BASE_URL'),
        api_key: ENV.fetch('LLM_API_KEY'),
        model: ENV.fetch('LLM_MODEL')
      }
    else
      # Default to Grok
      {
        base_url: ENV.fetch('LLM_BASE_URL'),
        api_key: ENV.fetch('LLM_API_KEY'),
        model: ENV.fetch('LLM_MODEL')
      }
    end
  end

  
  # def current_user
  #   @current_user ||= connection.current_user
  # end
end
