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
  
  def build_luo_zhenyu_framework
    <<~FRAMEWORK
      
      ℹ️ 【罗振宇口语化表达框架】
      
      📌 【核心原则：对象化思维 + 线性交付】
      
      **1. 对象化思维（以使用者为中心）**
      - 不是写给自己看，而是**为对方交付知识**
      - 每句话都要问：“对方能听懂吗？”
      - 不能自说自话，要让对方**全程跟上你的节奏**
      - 像导游带路：“你现在在A点，我要带你去B点”
      
      **2. 线性交付（有起点和终点）**
      - 必须有**明确的起点**：从对方熟悉的东西开始
      - 必须有**明确的终点**：到底要交付什么？
      - 中间过程必须**一步步递进**，不能跳跃
      - 像爬山：从山脚到山顶，中间不能空降
      
      🔥 【四种信息势能模型】
      
      选择其中一种作为主线，贯穿全文：
      
      **模型1：难→易（复杂问题简单化）**
      - 起点：对方觉得“这事太难了”
      - 终点：“原来这么简单！”
      - 过程：把复杂概念**拆解成大白话**
      - 例子：“量子力学很难？其实就像...”
      
      **模型2：低→高（从现象到本质）**
      - 起点：对方熟悉的**零散现象**
      - 终点：提升到**抽象概念/规律**
      - 过程：从多个例子中总结共性
      - 例子：“你看这几个例子，背后其实是同一个道理...”
      
      **模型3：无→有（从已知到未知）**
      - 起点：对方**已经知道的事**
      - 终点：对方**从来不知道的新知识**
      - 过程：像搭桥，从旧知识过渡到新知识
      - 例子：“你知道A吧？B其实和A一样...”
      
      **模型4：非→是（颠覆认知）**
      - 起点：对方的**旧认知/误解**
      - 终点：新的、正确的认知
      - 过程：先承认旧认知，再打破它
      - 例子：“我以前也这么想，直到我发现...”
      
      ✏️ 【三大写作心法】
      
      **心法1：弹幕（自我评论 + 引导）**
      - 像视频弹幕一样，给自己加注解
      - “你注意看”、“这里很关键”、“等会我们再说”
      - **不是废话**，而是**引导注意力**
      - 让对方知道：“现在在哪，接下来去哪”
      
      **心法2：投影（做知识的幕布）**
      - 不是“我有知识”，而是“我是知识的显示器”
      - 把复杂概念**投影到具体场景**
      - 用比喻、故事、例子让抽象变具体
      - “就像...”、“比如说...”、“你想象一下...”
      
      **心法3：欲望（真诚的交付欲）**
      - 不是炎示，而是**真的想让对方懂**
      - 必须有**真情实感**：“这事我真的想让你知道”
      - 不能是任务，要是**发自内心的分享**
      - 如果你自己都不兴奋，对方也不会兴奋
      
      🚫 【罗式表达禁忌】
      
      1. **禁止书面语结构**
         - ❌ “首先、其次、最后” → ✅ “第一个是...然后...还有...”
         - ❌ “综上所述” → ✅ “所以你看”
         - ❌ “基于/通过/针对” → ✅ “因为/用/对于”
      
      2. **禁止空洞表达**
         - ❌ “具有重要意义” → ✅ 说清楚到底怎么重要
         - ❌ “具有显著优势” → ✅ 说出具体优势是什么
      
      3. **禁止无效过渡**
         - ❌ “接下来我们来谈谈...” → ✅ 直接说
         - ❌ “关于这个问题” → ✅ 直接说问题
      
      4. **禁止第三方视角**
         - ❌ “有人说/专家认为” → ✅ “我发现”
         - ❌ “根据XX” → ✅ “我试了一下”
      
      ✅ 【罗式表达黄金句型】
      
      **开场句型：**
      - “我最近发现一个事儿...”
      - “你知道吗，有一个事特别有意思...”
      - “说一个我的观察...”
      
      **过渡句型：**
      - “你注意看，这里很关键...”
      - “然后呢，我就发现...”
      - “这时候问题来了...”
      - “所以你看，关键就在于...”
      
      **强调句型：**
      - “这事特别重要，为什么呢？”
      - “你发现没，这里有个关键点...”
      - “记住这个，非常关键...”
      
      **比喻句型：**
      - “就像...一样”
      - “比如说...”
      - “你想象一下...”
      
      **结尾句型：**
      - “所以你看，其实就是...”
      - “这就是我想说的...”
      - “记住这一点，非常重要”
      
      ✅ 【罗式验证标准】
      
      用这些问题检验你的文章：
      
      1. **对象化：**每句话都能让对方听懂吗？
      2. **线性：**起点和终点明确吗？中间有跳跃吗？
      3. **势能：**用了哪个信息势能模型？贯穿全文了吗？
      4. **弹幕：**有引导词帮助对方跟上节奏吗？
      5. **投影：**抽象概念有具体化吗？
      6. **欲望：**你自己读了会兴奋吗？
      7. **口语化：**有没有书面语、学术腔？
      
      ---
      
      ⚠️ **应用要求：**
      - 在原有提示词基础上，**叠加**罗振宇框架
      - 选择一个最适合的信息势能模型
      - 全文贯穿三大心法：弹幕、投影、欲望
      - 使用罗式黄金句型，避免所有禁忌
      - 最后用验证标准自检
    FRAMEWORK
  end
  
  def build_draft_prompt(transcript, brainstorm_content, model_display_name, writing_style = 'original')
    <<~PROMPT
      ⚠️ 【核心任务】
      你现在是作者本人，要将自己的初步想法和深度思考融合成一篇**口语化、线性表达**的文章。
      想象你在跟朋友面对面聊天，用说话的方式写出来。
      
      🎯 【最重要的要求：口语化表达】
      **什么是口语化、线性表达？**
      - 像说话一样写：想到哪说到哪，自然流动，不追求严谨的逻辑结构
      - 用短句、碎片化表达：避免长篇大论和复杂句式
      - 带有停顿和转折：用"然后呢"、"但是"、"你知道吗"、"所以说"等连接词
      - 有情绪和语气：可以用"哇"、"真的"、"其实"、"说实话"等口语化词汇
      - 不完美的表达：可以有省略、重复、自我纠正（像真实对话）
      
      **口语化 vs 书面语对比：**
      - ❌ 书面语："通过深入分析，我们可以得出以下结论..."
      - ✅ 口语化："我琢磨了半天，发现一个事儿..."
      
      - ❌ 书面语："该系统具有以下三个核心特点：首先...其次...最后..."
      - ✅ 口语化："这东西有意思的地方呢，主要是三点。第一个是...然后第二个...还有就是..."
      
      - ❌ 书面语："基于上述观察，本文将阐述..."
      - ✅ 口语化："我就想聊聊这个事儿..."
      
      - ❌ 书面语："综上所述，我们可以认为..."
      - ✅ 口语化："所以你看，其实就是..."
      
      🚫 【绝对禁止】（违反任何一条都算失败）
      1. 禁止书面语结构：不要用"首先、其次、最后"、"综上所述"、"基于"、"通过"等书面表达
      2. 禁止学术腔：不要用"本文"、"笔者"、"阐述"、"论证"、"分析表明"等学术词汇
      3. 禁止第三方视角：不能出现"有人说"、"根据XX"、"XX提到"、"分析认为"等旁观者表述
      4. 禁止介绍性语气：不能用"这个系统"、"这套方法"等介绍已有事物的口吻
      5. 禁止正式标题：不要用"引言"、"背景"、"核心要点"、"总结"这类章节标题
      6. 禁止可见拼接：不能让读者感觉是两段内容拼在一起
      7. 禁止引用原文：不能直接引用下面素材的原话，要彻底消化后重新表达
      8. **禁止内容扩展**：不能添加素材中没有的信息、案例、细节（这是最严重的违规！）
      9. **禁止详细展开**：如果素材只是提到，就不要详细描述
      
      ✅ 【必须做到】
      1. **纯口语化表达**：像在播客、Vlog、语音消息中说话一样写
      2. **线性思维流**：想到哪写到哪，不刻意组织结构，自然过渡
      3. **短句为主**：多用短句，避免复杂从句，像说话时的停顿
      4. **口语化连接词**：多用"然后"、"但是"、"所以"、"你看"、"其实"、"说白了"等
      5. **直接对话感**：用"你想啊"、"你知道吗"、"对吧"、"是不是"等拉近距离
      6. **情绪化表达**：可以用"哇"、"真的"、"挺有意思"、"超级"、"特别"等带情绪的词
      7. **保持 #{model_display_name} 风格**：直接、深刻、有洞见、不套话
      8. **严格控制长度**：融合结果应该在（素材1字数 + 素材2字数）× 1.5 倍以内，绝不超过
      9. **只整合已有信息**：素材提到什么就写什么，不提到的一律不写，不脑补，不举例
      
      ⚡ 【关键原则：口语化 ≠ 不专业】
      - ✅ 口语化 = 说话的方式表达专业内容（轻松但有深度）
      - ❌ 口语化 ≠ 啰嗦、废话、没重点
      - 举例说明：
        - ❌ 书面语："通过对比分析发现，该方法在实际应用中展现出显著优势"
        - ✅ 口语化："我试了一下，发现这方法确实好用"
      
      📝 【格式要求 - 轻量化 Markdown】
      你**必须**使用 Markdown 格式，但要保持口语化：
      - **标题**：用 ## 和 ### 标题，但标题也要口语化（如：## 我最近发现的一个事儿）
      - **重点强调**：用 **加粗** 标记关键词
      - **列表**：少用列表，多用自然段落；必须用列表时也要口语化
      - **段落分隔**：多分段，一段话不要太长，像说话时的停顿
      
      示例格式：
      ```
      ## 我最近在想一个问题
      
      就是那种...你知道吗，我发现了一个挺有意思的事儿。
      
      就是这样的，最近我在做XX的时候，突然意识到一个问题。然后我就开始琢磨，为什么会这样呢？
      
      你可能也遇到过类似的情况，对吧？就是那种...怎么说呢，**特别矛盾**的感觉。
      
      ### 后来我就尝试了一下
      
      然后呢，我就试了几个办法。第一个是...但是发现不太行。后来又换了个思路，这次好多了。
      
      所以你看，其实关键就在于...
      ```
      
      📝 【写作指南】
      - **语气**：像在录播客、录Vlog、发语音消息，想到什么说什么
      - **节奏**：快慢结合，重要的地方慢下来说，过渡的地方快速带过
      - **真实感**：可以有犹豫、自我纠正、补充说明（如："不对，应该说是..."、"或者说..."）
      - **互动感**：经常用"你"来称呼读者，像在对话
      - **情绪起伏**：可以有惊讶、疑惑、恍然大悟的情绪变化
      - **内容取舍**：只能删减、重组、换说法，绝不能扩展、举例、详述
      - **长度控制**：写完立即停止，不要为了凑字数而啰嗦
      
      ⚠️ 【特别提醒：避免这些书面语痕迹】
      - ❌ 不要用："本文"、"笔者"、"我们"、"读者"
      - ❌ 不要用："首先、其次、再次、最后"
      - ❌ 不要用："综上所述"、"总而言之"、"由此可见"
      - ❌ 不要用："基于"、"通过"、"关于"、"针对"
      - ❌ 不要用："具有"、"呈现"、"展现"、"体现"
      - ✅ 改用："我"、"你"、"然后"、"但是"、"所以"、"其实"、"说白了"、"就是"
      
      ─────────────────────────
      【素材1：初步想法】
      #{transcript}
      
      【素材2：深度思考】
      #{brainstorm_content}
      ─────────────────────────
      
      现在，以第一人称、使用 Markdown 格式写出融合后的完整文章（直接开始，不要前言）：
      
      #{writing_style == 'luo_style' ? build_luo_zhenyu_framework : ''}
      
      ⚠️ 【最终提醒】
      - 想象你在录播客或发语音，想到哪说到哪，自然流动
      - 多用短句、口语词、情绪词，少用书面语、复杂句
      - 只整合素材中的信息，不扩展，不详述，不举例
      - 字数控制在素材总字数的1.5倍以内
      - 写完立即停止，不要为了达到某个字数而继续
      - **必须使用 Markdown 格式**：标题、加粗、列表等
    PROMPT
  end
  
  # Generate drafts for all providers concurrently
  def generate_all_drafts(data)
    article_id = data['article_id']
    writing_style = data['writing_style'] || 'original'
    
    article = Article.find(article_id)
    
    # List of all available providers (5 models displayed)
    providers = ['grok', 'qwen', 'deepseek', 'gemini', 'doubao']
    
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
      when 'doubao' then '豆包'
      else provider.capitalize
      end
      
      # Build draft prompt with writing style
      draft_prompt = build_draft_prompt(article.transcript, brainstorm_content, model_display_name, writing_style)
      
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
    writing_style = data['writing_style'] || 'original'
    
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
    when 'doubao' then '豆包'
    else provider.capitalize
    end
    
    # Build draft prompt with writing style
    draft_prompt = build_draft_prompt(article.transcript, brainstorm_content, model_display_name, writing_style)
    
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
    
    # Check credits before creating article
    Rails.logger.info "[DEBUG] current_user: #{current_user.inspect}"
    Rails.logger.info "[DEBUG] current_user.credits: #{current_user&.credits}"
    if current_user && current_user.credits <= 0
      Rails.logger.error "[CREDITS] User #{current_user.id} has insufficient credits: #{current_user.credits}"
      ActionCable.server.broadcast(
        @stream_name,
        {
          type: 'error',
          message: '文章配额不足，请购买套餐后再继续创作。'
        }
      )
      return
    end
    
    # Create or update article with transcript and thinking_framework
    article = if article_id.present?
                Article.find(article_id)
              else
                # Associate with current_user if authenticated
                article_attrs = { transcript: transcript, thinking_framework: thinking_framework }
                article_attrs[:user_id] = current_user.id if current_user
                article = Article.create!(article_attrs)
                
                # Deduct credit after article creation
                if current_user
                  current_user.decrement!(:credits, 1)
                  Rails.logger.info "User #{current_user.id} credits decreased by 1 (remaining: #{current_user.credits})"
                end
                
                article
              end
    
    # List of all available providers (5 models displayed)
    providers = ['grok', 'qwen', 'deepseek', 'gemini', 'doubao']
    
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
  
  # Create a new article from existing transcript and generate both brainstorm AND drafts
  # This is used when user clicks "一键生成所有脑报" from a loaded historical article
  def create_new_from_existing(data)
    transcript = data['transcript']
    writing_style = data['writing_style'] || 'original'
    thinking_framework = data['thinking_framework'] || 'original'
    
    unless transcript.present?
      Rails.logger.error "Missing transcript for create_new_from_existing"
      return
    end
    
    # Check credits before creating article
    if current_user && current_user.credits <= 0
      ActionCable.server.broadcast(
        @stream_name,
        {
          type: 'error',
          message: '文章配额不足，请购买套餐后再继续创作。'
        }
      )
      return
    end
    
    # Create new article with transcript, thinking_framework, and writing_style
    article_attrs = { transcript: transcript, thinking_framework: thinking_framework, writing_style: writing_style }
    article_attrs[:user_id] = current_user.id if current_user
    article = Article.create!(article_attrs)
    
    # Deduct credit after article creation
    if current_user
      current_user.decrement!(:credits, 1)
      Rails.logger.info "User #{current_user.id} credits decreased by 1 (remaining: #{current_user.credits})"
    end
    
    Rails.logger.info "Created new article #{article.id} from existing transcript"
    
    # Broadcast new article_id to frontend
    ActionCable.server.broadcast(
      @stream_name,
      {
        type: 'article-created',
        article_id: article.id
      }
    )
    
    # List of all available providers
    providers = ['grok', 'qwen', 'deepseek', 'gemini', 'doubao']
    
    # Step 1: Generate brainstorm for all providers
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
        streaming: false
      )
    end
    
    # Step 2: Drafts will be triggered automatically when each provider's brainstorm completes
    # See LlmStreamJob#perform for auto-draft trigger logic
    
    Rails.logger.info "Triggered brainstorm for article #{article.id} (drafts will auto-generate after each brainstorm completes)"
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
    when 'doubao' then '豆包'
    else 'Grok'
    end
    
    # 优化后的融合 prompt（口语化、线性表达）
    draft_prompt = <<~PROMPT
      ⚠️ 【核心任务】
      你现在是作者本人，要将自己的初步想法和深度思考融合成一篇**口语化、线性表达**的文章。
      想象你在跟朋友面对面聊天，用说话的方式写出来。
      
      🎯 【最重要的要求：口语化表达】
      **什么是口语化、线性表达？**
      - 像说话一样写：想到哪说到哪，自然流动，不追求严谨的逻辑结构
      - 用短句、碎片化表达：避免长篇大论和复杂句式
      - 带有停顿和转折：用"然后呢"、"但是"、"你知道吗"、"所以说"等连接词
      - 有情绪和语气：可以用"哇"、"真的"、"其实"、"说实话"等口语化词汇
      - 不完美的表达：可以有省略、重复、自我纠正（像真实对话）
      
      **口语化 vs 书面语对比：**
      - ❌ 书面语："通过深入分析，我们可以得出以下结论..."
      - ✅ 口语化："我琢磨了半天，发现一个事儿..."
      
      - ❌ 书面语："该系统具有以下三个核心特点：首先...其次...最后..."
      - ✅ 口语化："这东西有意思的地方呢，主要是三点。第一个是...然后第二个...还有就是..."
      
      - ❌ 书面语："基于上述观察，本文将阐述..."
      - ✅ 口语化："我就想聊聊这个事儿..."
      
      - ❌ 书面语："综上所述，我们可以认为..."
      - ✅ 口语化："所以你看，其实就是..."
      
      🚫 【绝对禁止】（违反任何一条都算失败）
      1. 禁止书面语结构：不要用"首先、其次、最后"、"综上所述"、"基于"、"通过"等书面表达
      2. 禁止学术腔：不要用"本文"、"笔者"、"阐述"、"论证"、"分析表明"等学术词汇
      3. 禁止第三方视角：不能出现"有人说"、"根据XX"、"XX提到"、"分析认为"等旁观者表述
      4. 禁止介绍性语气：不能用"这个系统"、"这套方法"等介绍已有事物的口吻
      5. 禁止正式标题：不要用"引言"、"背景"、"核心要点"、"总结"这类章节标题
      6. 禁止可见拼接：不能让读者感觉是两段内容拼在一起
      7. 禁止引用原文：不能直接引用下面素材的原话，要彻底消化后重新表达
      8. **禁止内容扩展**：不能添加素材中没有的信息、案例、细节（这是最严重的违规！）
      9. **禁止详细展开**：如果素材只是提到，就不要详细描述
      
      ✅ 【必须做到】
      1. **纯口语化表达**：像在播客、Vlog、语音消息中说话一样写
      2. **线性思维流**：想到哪写到哪，不刻意组织结构，自然过渡
      3. **短句为主**：多用短句，避免复杂从句，像说话时的停顿
      4. **口语化连接词**：多用"然后"、"但是"、"所以"、"你看"、"其实"、"说白了"等
      5. **直接对话感**：用"你想啊"、"你知道吗"、"对吧"、"是不是"等拉近距离
      6. **情绪化表达**：可以用"哇"、"真的"、"挺有意思"、"超级"、"特别"等带情绪的词
      7. **保持 #{model_display_name} 风格**：直接、深刻、有洞见、不套话
      8. **严格控制长度**：融合结果应该在（素材1字数 + 素材2字数）× 1.5 倍以内，绝不超过
      9. **只整合已有信息**：素材提到什么就写什么，不提到的一律不写，不脑补，不举例
      
      ⚡ 【关键原则：口语化 ≠ 不专业】
      - ✅ 口语化 = 说话的方式表达专业内容（轻松但有深度）
      - ❌ 口语化 ≠ 啰嗦、废话、没重点
      - 举例说明：
        - ❌ 书面语："通过对比分析发现，该方法在实际应用中展现出显著优势"
        - ✅ 口语化："我试了一下，发现这方法确实好用"
      
      📝 【格式要求 - 轻量化 Markdown】
      你**必须**使用 Markdown 格式，但要保持口语化：
      - **标题**：用 ## 和 ### 标题，但标题也要口语化（如：## 我最近发现的一个事儿）
      - **重点强调**：用 **加粗** 标记关键词
      - **列表**：少用列表，多用自然段落；必须用列表时也要口语化
      - **段落分隔**：多分段，一段话不要太长，像说话时的停顿
      
      示例格式：
      ```
      ## 我最近在想一个问题
      
      就是那种...你知道吗，我发现了一个挺有意思的事儿。
      
      就是这样的，最近我在做XX的时候，突然意识到一个问题。然后我就开始琢磨，为什么会这样呢？
      
      你可能也遇到过类似的情况，对吧？就是那种...怎么说呢，**特别矛盾**的感觉。
      
      ### 后来我就尝试了一下
      
      然后呢，我就试了几个办法。第一个是...但是发现不太行。后来又换了个思路，这次好多了。
      
      所以你看，其实关键就在于...
      ```
      
      📝 【写作指南】
      - **语气**：像在录播客、录Vlog、发语音消息，想到什么说什么
      - **节奏**：快慢结合，重要的地方慢下来说，过渡的地方快速带过
      - **真实感**：可以有犹豫、自我纠正、补充说明（如："不对，应该说是..."、"或者说..."）
      - **互动感**：经常用"你"来称呼读者，像在对话
      - **情绪起伏**：可以有惊讶、疑惑、恍然大悟的情绪变化
      - **内容取舍**：只能删减、重组、换说法，绝不能扩展、举例、详述
      - **长度控制**：写完立即停止，不要为了凑字数而啰嗦
      
      ⚠️ 【特别提醒：避免这些书面语痕迹】
      - ❌ 不要用："本文"、"笔者"、"我们"、"读者"
      - ❌ 不要用："首先、其次、再次、最后"
      - ❌ 不要用："综上所述"、"总而言之"、"由此可见"
      - ❌ 不要用："基于"、"通过"、"关于"、"针对"
      - ❌ 不要用："具有"、"呈现"、"展现"、"体现"
      - ✅ 改用："我"、"你"、"然后"、"但是"、"所以"、"其实"、"说白了"、"就是"
      
      ─────────────────────────
      【素材1：初步想法】
      #{article.transcript}
      
      【素材2：深度思考】
      #{selected_brainstorm}
      ─────────────────────────
      
      现在，用**说话的方式**、以第一人称、使用轻量 Markdown 格式写出融合后的口语化文章（直接开始，像开始一段对话）：
      
      ⚠️ 【最终提醒】
      - 想象你在录播客或发语音，想到哪说到哪，自然流动
      - 多用短句、口语词、情绪词，少用书面语、复杂句
      - 只整合素材中的信息，不扩展，不详述，不举例
      - 字数控制在素材总字数的1.5倍以内
      - 写完立即停止，不要为了达到某个字数而继续
      - **必须口语化**：像说话一样，不是写论文！
    PROMPT
    
    llm_config = get_llm_config(selected_model)
    
    # CRITICAL: Draft generation needs longer timeout due to long prompt and content fusion
    # - Long prompt: ~180 lines of detailed instructions
    # - Content fusion: transcript + brainstorm content (can be 2000+ characters)
    # - Default 120s often causes timeout, especially for slower models
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
