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
    
    # Create or update article with transcript
    article = if article_id.present?
                Article.find(article_id)
              else
                Article.create!(transcript: transcript)
              end
    
    # List of all available providers
    providers = ['grok', 'qwen', 'deepseek', 'gemini', 'zhipu']
    
    # Trigger jobs for all providers concurrently
    providers.each do |provider|
      llm_config = get_llm_config(provider)
      
      LlmStreamJob.perform_later(
        stream_name: "#{@stream_name}_#{provider}",
        prompt: transcript,
        llm_config: llm_config,
        article_id: article.id,
        provider: provider
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
  
  # Generate draft by combining transcript + all brainstorm results
  def generate_draft(data)
    article_id = data['article_id']
    selected_model = data['selected_model']
    
    article = Article.find(article_id)
    article.update!(selected_model: selected_model)
    
    # Combine transcript and all brainstorm results
    combined_content = <<~CONTENT
      【我的原始想法】
      #{article.transcript}
      
      【Grok 的脑爆】
      #{article.brainstorm_grok}
      
      【Qwen 的脑爆】
      #{article.brainstorm_qwen}
      
      【DeepSeek 的脑爆】
      #{article.brainstorm_deepseek}
      
      【Gemini 的脑爆】
      #{article.brainstorm_gemini}
      
      【智谱 的脑爆】
      #{article.brainstorm_zhipu}
    CONTENT
    
    draft_prompt = <<~PROMPT
      请将以上内容融合成一篇连贯的文章草稿。
      
      要求：
      1. 以第一人称（作者视角）向第三人听众讲述
      2. 融合我的原始想法和5个AI模型的脑爆内容
      3. 保持逻辑清晰，语言流畅
      4. 字数控制在800-1500字
    PROMPT
    
    llm_config = get_llm_config(selected_model)
    
    LlmStreamJob.perform_later(
      stream_name: "#{@stream_name}_draft",
      prompt: combined_content + "\n\n" + draft_prompt,
      llm_config: llm_config,
      article_id: article.id,
      provider: 'draft'
    )
  end
  
  # Generate final article with selected style
  def generate_final(data)
    article_id = data['article_id']
    draft_content = data['draft_content']
    style = data['style']
    
    article = Article.find(article_id)
    article.update!(draft: draft_content, final_style: style)
    
    style_prompt = get_style_prompt(style)
    final_prompt = style_prompt + "\n\n【草稿内容】\n" + draft_content
    
    llm_config = get_llm_config(article.selected_model)
    
    LlmStreamJob.perform_later(
      stream_name: "#{@stream_name}_final",
      prompt: final_prompt,
      llm_config: llm_config,
      article_id: article.id,
      provider: 'final'
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

  def get_style_prompt(style)
    case style
    when 'pinker'
      <<~PROMPT
        你是认知科学家史蒂芬·平克。请用他的写作风格改写以下内容：
        
        【风格特征】
        - 理性清晰：用科学思维解构复杂概念，层层递进论证
        - 类比大师：善用生动比喻和日常场景类比抽象理论
        - 数据支撑：引用研究、实验、统计数据增强说服力（可虚构合理数据）
        - 优雅幽默：在严谨论证中穿插机智俏皮话，让学术变有趣
        - 结构清晰：先抛问题，再拆解分析，最后得出结论
        
        【语言特点】
        - 长短句交替，节奏感强
        - 使用"想象一下..."、"让我们看看..."等引导句
        - 避免空洞概念，每个观点都有具体例子支撑
        
        请将以下草稿改写为史蒂芬·平克风格的文章，保持第一人称视角。
      PROMPT
    when 'luozhenyu'
      <<~PROMPT
        你是知识传播者罗振宇。请用他的"得到"风格改写以下内容：
        
        【风格特征】
        - 开门见山：第一句就点明核心观点或冲突
        - 故事化表达：把概念包装成故事，用场景代替说教
        - 金句频出：每段都有可摘抄的精炼观点
        - 实用导向：强调"对你有什么用"、"怎么用"
        - 降维打击：用简单词汇讲复杂道理，让小学生都能听懂
        
        【语言特点】
        - 短句为主，节奏紧凑
        - 大量使用"你看"、"这就是"、"换句话说"等口语化衔接
        - 爱用"三段论"结构：是什么 → 为什么 → 怎么办
        - 结尾升华：从具体事例上升到人生哲理
        
        请将以下草稿改写为罗振宇风格的文章，保持第一人称视角，像在跟朋友讲故事。
      PROMPT
    when 'wangxiaobo'
      <<~PROMPT
        你是作家王小波。请用他的杂文风格改写以下内容：
        
        【风格特征】
        - 荒诞幽默：用反讽、自嘲、黑色幽默解构严肃话题
        - 理性反叛：质疑权威和常识，展现独立思考
        - 生活化哲思：从日常琐事引出深刻洞察
        - 真诚直白：不装腔作势，用大白话说真心话
        - 跳跃思维：看似闲聊，实则暗藏逻辑线
        
        【语言特点】
        - 大量使用"我觉得"、"说实话"、"有意思的是"
        - 爱举荒诞例子对比（"就像..."）
        - 突然插入个人经历或假设场景
        - 句式随意，像跟读者聊天
        - 结尾往往出人意料，留下回味
        
        请将以下草稿改写为王小波风格的文章，保持第一人称视角，带着玩世不恭的智慧。
      PROMPT
    else
      ""
    end
  end
  
  # def current_user
  #   @current_user ||= connection.current_user
  # end
end
