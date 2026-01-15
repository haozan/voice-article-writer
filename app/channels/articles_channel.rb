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
    thinking_framework = data['thinking_framework'] || 'original'
    
    # Create or update article with transcript and thinking_framework
    article = if article_id.present?
                Article.find(article_id)
              else
                # Associate with current_user if authenticated
                article_attrs = { transcript: transcript, thinking_framework: thinking_framework }
                article_attrs[:user_id] = current_user.id if current_user
                Article.create!(article_attrs)
              end
    
    # List of all available providers
    providers = ['grok', 'qwen', 'deepseek', 'gemini', 'zhipu', 'doubao']
    
    # Trigger jobs for all providers concurrently
    providers.each do |provider|
      llm_config = get_llm_config(provider)
      
      LlmStreamJob.perform_later(
        stream_name: "#{@stream_name}_#{provider}",
        prompt: transcript,
        llm_config: llm_config,
        article_id: article.id,
        provider: provider,
        thinking_framework: thinking_framework
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
    
    # 只融合【我的原始想法】和【选中模型的脑爆】
    combined_content = <<~CONTENT
      【我的原始想法】
      #{article.transcript}
      
      【#{model_display_name} 的脑爆】
      #{selected_brainstorm}
    CONTENT
    
    draft_prompt = <<~PROMPT
      你是 #{model_display_name}。现在有两部分素材需要融合：
      
      请将这两部分**完全融为一体**，从我的第一人称视角，写成一篇面向第三方读者的文章。
      
      要求：
      1. **绝对不能出现**："#{model_display_name} 提到"、"有人说"、"根据分析"等第三方引用
      2. **完全用我的口吻**：就像我自己消化思考后写出来的，看不出任何拼接痕迹
      3. **保持 #{model_display_name} 风格**：直接、深刻、有洞见、不废话、不套话
      4. **长度控制**：1300 字以内（根据内容自然决定，不要为了凑字数而啰嗦）
      5. **结构自由**：不强制开头/正文/结尾，跟随内容自然展开
      6. **面向读者**：像在跟朋友分享，不是自言自语，有沟通感
      
      直接输出文章正文，不要加标题、解释、引号或任何多余内容。
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
  
  def save_final(data)
    article_id = data['article_id']
    final_content = data['final_content']
    
    article = Article.find(article_id)
    article.update!(final_content: final_content)
    
    ActionCable.server.broadcast(
      @stream_name,
      { type: 'final-saved', success: true }
    )
  end
  
  def save_draft(data)
    article_id = data['article_id']
    draft_content = data['draft_content']
    
    article = Article.find(article_id)
    article.update!(draft: draft_content)
    
    ActionCable.server.broadcast(
      @stream_name,
      { type: 'draft-saved', success: true }
    )
  end
  
  # Generate viral title with selected style
  def generate_title(data)
    article_id = data['article_id']
    final_content = data['final_content']
    style = data['style']
    
    article = Article.find(article_id)
    article.update!(final_content: final_content, title_style: style)
    
    style_prompt = get_title_style_prompt(style)
    title_prompt = style_prompt + "\n\n【文章内容】\n" + final_content
    
    llm_config = get_llm_config(article.selected_model)
    
    LlmStreamJob.perform_later(
      stream_name: "#{@stream_name}_title",
      prompt: title_prompt,
      llm_config: llm_config,
      article_id: article.id,
      provider: 'title'
    )
  end
  
  def save_title(data)
    article_id = data['article_id']
    title_content = data['title_content']
    
    article = Article.find(article_id)
    article.update!(title: title_content)
    
    ActionCable.server.broadcast(
      @stream_name,
      { type: 'title-saved', success: true }
    )
  end
  
  # Generate variant with selected style (xiaolvshu / xiaohongshu)
  def generate_variant(data)
    article_id = data['article_id']
    style = data['style']
    
    article = Article.find(article_id)
    
    # 从数据库读取完整的定稿文章，确保内容完整
    final_content = article.final_content
    
    if final_content.blank?
      ActionCable.server.broadcast(
        "#{@stream_name}_variant",
        { type: 'error', message: '定稿文章不存在，请先完成定稿步骤' }
      )
      return
    end
    
    # 更新风格标记
    article.update!(variant_style: style)
    
    style_prompt = get_variant_style_prompt(style)
    
    # 明确告诉 AI：这是完整的定稿文章，需要完整输出
    variant_prompt = <<~PROMPT
      #{style_prompt}
      
      【重要提醒】
      - 以下是用户完成的完整定稿文章，请仔细阅读全文
      - 你需要将这篇完整的文章按照上述风格要求进行润色
      - 必须保持文章的完整性，不要截断或省略内容
      - 如果原文较长，你也要输出完整的润色版本
      
      【原文内容】（请完整阅读并完整输出）
      #{final_content}
      
      现在开始输出完整的润色版本：
    PROMPT
    
    llm_config = get_llm_config(article.selected_model)
    
    LlmStreamJob.perform_later(
      stream_name: "#{@stream_name}_variant",
      prompt: variant_prompt,
      llm_config: llm_config,
      article_id: article.id,
      provider: 'variant'
    )
  end
  
  def save_variant(data)
    article_id = data['article_id']
    variant_content = data['variant_content']
    
    article = Article.find(article_id)
    article.update!(variant: variant_content)
    
    ActionCable.server.broadcast(
      @stream_name,
      { type: 'variant-saved', success: true }
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
  
  def get_title_style_prompt(style)
    case style
    when 'mimeng'
      <<~PROMPT
        你是爆款文章标题专家。请根据以下文章内容，生成一个迷蒙体风格的爆款标题。
        
        【迷蒙体标题特征】
        - 情绪共鸣：触及读者痛点、焦虑、欲望或情感需求
        - 制造对比：用"vs"、"却"、"竟然"等词制造反差感
        - 身份代入："你"、"我"、"那些"等人称词让读者有代入感
        - 价值承诺：暗示文章能解决问题或提供洞察
        - 数字锚点：适当使用具体数字增强可信度（如"3年"、"27岁"）
        - 悬念设置：留白、省略号、疑问句激发好奇心
        
        【标题公式】（选择最适合的一种）
        1. 痛点型：《那些[具体行为]的人，后来都[结果]了》
        2. 对比型：《[A类人]和[B类人]的区别，就是[核心差异]》
        3. 颠覆型：《你以为[常识]，其实[真相]》
        4. 共鸣型：《[年龄/身份]的我，终于明白了[道理]》
        5. 悬念型：《关于[话题]，我必须说点什么了》
        6. 数字型：《[数字]岁那年，我[关键转折]》
        
        【注意事项】
        - 标题长度：15-30字为佳
        - 避免过度标题党，与文章内容相符
        - 不使用粗俗、低俗词汇
        - 直接输出标题，不需要序号或选项
        
        请仔细阅读文章内容，生成1款个最能吸引读者点击的迷蒙体标题。只输出标题文本，不要有任何额外说明。
      PROMPT
    else
      <<~PROMPT
        请根据以下文章内容，生成一个简洁、有吸引力的标题。
        标题要求：
        - 长度：15-25字
        - 准确概括文章核心观点
        - 有一定吸引力和可读性
        - 直接输出标题，不要有任何额外说明
      PROMPT
    end
  end
  
  def get_variant_style_prompt(style)
    case style
    when 'xiaolvshu'
      <<~PROMPT
        你是小绿书内容创作专家。用户已经完成了文章定稿，现在需要你将这篇定稿文章润色为小绿书风格的内容变体。
        
        【核心任务说明】
        - 这是对用户完整定稿文章的风格转换和润色，绝对不是重新创作新内容
        - 你必须基于下方提供的完整原文进行润色，保留所有核心观点和逻辑结构
        - 只需要调整表达方式和呈现风格，精简语言但不删减关键信息
        
        【必须遵守的原则】
        1. 完整性原则：原文的每个重要观点都要在润色版中体现
        2. 忠实性原则：不改变原文的核心意思和逻辑链条
        3. 精简化原则：用最简洁的语言表达，但不省略重要信息
        4. 字数控制：如果原文较长，优先精简表达而非删减内容，力争在1000字内完整呈现
        
        【小绿书风格特征】
        - 字数控制：严格控制在1000字以内（通过精简表达，而非删减内容）
        - 纯文本输出：不使用任何 Markdown 格式（无标题、无加粗、无列表、无分隔符）
        - 简洁直白：用最简单的语言表达核心观点
        - 分段清晰：每段3-5句话，段落间用空行分隔
        - 口语化表达：像朋友聊天一样自然
        - 去掉华丽辞藻：只保留核心信息和关键观点
        
        【内容要求】
        1. 开头：1-2句话直接点明主题
        2. 正文：保持原文逻辑，用精简语言表达每个观点
        3. 结尾：1-2句话总结或升华
        4. 全文：不超过1000字（如原文很长，用更精练的表达方式）
        
        【绝对禁止】
        - 不要使用 # 标题符号
        - 不要使用 ** 加粗符号
        - 不要使用 - 或 * 列表符号
        - 不要使用 --- 分隔线
        - 不要使用任何 Markdown 语法
        - 不要直接删除原文段落，要用精简方式表达
        
        【特别提醒】
        - 请完整阅读下方的原文内容
        - 确保润色后的版本覆盖原文的所有核心要点
        - 如果原文有5个观点，润色版也要有5个观点（用更简洁的小绿书风格表达）
        - 1000字限制是通过精简表达达成的，不是通过删减内容
        
        请将以下完整定稿文章润色为小绿书风格，纯文本输出，在1000字内完整呈现所有要点。
      PROMPT
    when 'xiaohongshu'
      <<~PROMPT
        你是小红书爆款内容创作专家。用户已经完成了文章定稿，现在需要你将这篇定稿文章润色为小红书风格的笔记变体。
        
        【核心任务说明】
        - 这是对用户完整定稿文章的风格转换和润色，绝对不是重新创作新内容
        - 你必须基于下方提供的完整原文进行润色，保留所有核心观点和逻辑结构
        - 原文有多长，润色后的小红书版本就应该有多完整
        - 只需要调整表达方式、增加emoji、优化呈现风格，不要删减或概括内容
        
        【必须遵守的原则】
        1. 完整性原则：原文的每个重要观点都要在润色版中体现
        2. 忠实性原则：不改变原文的核心意思和逻辑链条
        3. 风格化原则：用小红书的语言风格重新表达，但不丢失信息
        4. 长度适配：如果原文较长，润色版也应该完整呈现，不要halfway截断
        
        【小红书风格特征】
        - 标题吸睛：用emoji + 关键词 + 悬念/利益点
        - 分段明确：每段2-3句话，段落间用空行
        - emoji点缀：适当使用emoji增强视觉效果和情绪表达
        - 口语化："姐妹们"、"真的"、"绝了"等口语表达
        - 干货标签：用【】标注重点内容
        - 互动感：提问、反问增强代入感
        
        【结构模板】
        1. 开头：emoji + 引起共鸣的场景或问题
        2. 正文：保持原文的完整逻辑，每段加入emoji点缀和口语化表达
        3. 总结：用【重点】或【划重点】强调核心要点
        4. 结尾：互动提问 + emoji
        
        【常用emoji】
        ✨💡🔥💪🎯⭐️👀💫🌟📝💰🎁🎈🌈☀️
        
        【语言风格】
        - 多用感叹号表达情绪
        - "真的"、"超级"、"巨"等强调词
        - "姐妹们"、"宝子们"等亲切称呼
        - 数字 + 具体案例增强可信度
        
        【特别提醒】
        - 请完整阅读下方的原文内容
        - 确保润色后的版本覆盖原文的所有要点
        - 不要因为追求简洁而省略重要信息
        - 如果原文有5个观点，润色版也要有5个观点（用小红书风格表达）
        
        请将以下完整定稿文章润色为小红书爆款笔记风格，保持内容的完整性。
      PROMPT
    else
      <<~PROMPT
        用户已经完成了文章定稿，现在需要你将这篇定稿文章润色为更适合社交媒体传播的版本。
        
        【重要说明】
        - 这是对定稿文章的风格转换和润色，不是重新创作
        - 保持原文的核心观点、逻辑结构和关键信息不变
        
        【润色要求】
        - 语言更口语化、更有感染力
        - 适当使用emoji和互动元素
        - 增强可读性和传播性
        - 直接输出润色后的内容
      PROMPT
    end
  end
  
  # def current_user
  #   @current_user ||= connection.current_user
  # end
end
