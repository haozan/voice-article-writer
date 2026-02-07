class LlmStreamJob < ApplicationJob
  queue_as :llm

  # Retry strategy configuration
  # 对于超时错误，快速重试（5秒间隔）
  retry_on Net::ReadTimeout, wait: 5.seconds, attempts: 3
  retry_on LlmService::TimeoutError, wait: 5.seconds, attempts: 3
  
  # 对于所有 API 错误（除了明确不可重试的），使用指数退避重试
  # wait: :exponentially_longer 会自动计算等待时间：5s, 25s, 125s
  retry_on LlmService::ApiError, wait: :exponentially_longer, attempts: 3, queue: :llm do |job, exception|
    error_msg = exception.message
    
    # 不可重试的错误（认证/配置错误）
    non_retryable_errors = [
      '401',  # 认证失败
      '400',  # 请求格式错误
      '403',  # 权限不足
      'invalid',  # 无效请求
      'Incorrect API key',  # API密钥错误
      'Invalid API key'  # API密钥无效
    ]
    
    # 检查是否是不可重试的错误
    is_non_retryable = non_retryable_errors.any? { |err| error_msg.include?(err) }
    
    if is_non_retryable
      # 配置/认证错误：不重试，直接失败
      Rails.logger.error "Non-retryable API error (attempt #{job.executions}): #{error_msg}"
      false  # 返回 false 表示不重试
    else
      # 所有其他错误（包括503、网络问题、临时故障等）：自动重试
      Rails.logger.info "Retrying LLM job due to transient error (attempt #{job.executions}/3): #{error_msg}"
      true  # 返回 true 表示应该重试
    end
  end
  
  # 认证/配置错误 - 不重试，直接丢弃
  discard_on LlmService::ApiError do |job, exception|
    error_msg = exception.message
    error_msg.include?('401') || 
    error_msg.include?('400') || 
    error_msg.include?('403') ||
    error_msg.include?('invalid') || 
    error_msg.include?('Incorrect API key') ||
    error_msg.include?('Invalid API key')
  end

  # Streaming LLM responses via ActionCable for article generation
  # This job handles single-step Grok response:
  # - User provides original thoughts
  # - Grok shares his thinking, ideas, and suggestions (no expansion)
  #
  # Usage:
  #   LlmStreamJob.perform_later(
  #     stream_name: 'article_123',
  #     prompt: "user's original text",
  #     streaming: true  # Optional: use streaming (default) or blocking mode
  #   )
  def perform(stream_name:, prompt:, llm_config: nil, article_id: nil, provider: nil, thinking_framework: 'original', streaming: true, **options)
    # Detect provider and build appropriate system prompt
    provider_name = llm_config ? detect_provider(llm_config) : 'Grok'
    
    # For draft and final, don't wrap with system prompt
    system_prompt = if provider == 'draft' || provider == 'final'
                      nil
                    else
                      build_system_prompt(provider_name, thinking_framework)
                    end
    
    # Set custom timeout for frameworks that need longer generation time
    timeout = get_timeout_for_framework(thinking_framework)
    options = options.merge(timeout: timeout) if timeout
    
    # Merge llm_config into options if provided
    options = options.merge(llm_config) if llm_config
    
    generate_and_stream(stream_name, prompt, system_prompt, article_id, provider, streaming, **options)
  end
  
  private
  
  def detect_provider(llm_config)
    base_url = llm_config[:base_url] || llm_config['base_url']
    return 'Qwen' if base_url&.include?('dashscope')
    return 'DeepSeek' if base_url&.include?('deepseek')
    return 'Gemini' if base_url&.include?('generativelanguage')
    return 'Zhipu' if base_url&.include?('bigmodel')
    return 'ChatGPT' if base_url&.include?('openai')
    return 'Doubao' if base_url&.include?('volces') || base_url&.include?('doubao')
    'Grok'
  end
  
  def build_system_prompt(provider_name, thinking_framework = 'original')
    # Get framework-specific prompt content
    framework_prompt = get_framework_prompt(thinking_framework)
    
    # Markdown formatting requirements (apply to all providers)
    # CRITICAL: These are especially important for streaming mode!
    markdown_requirements = <<~MARKDOWN.strip
      输出格式要求（严格遵守，流式输出尤其重要）：
      - 使用标准 Markdown 语法
      - 标题标记（# ## ###）后**必须有一个空格**，例如：`### 标题` 而不是 `###标题`
      - 标题后**必须换行**（不能紧跟内容），例如：
        正确：`### 标题\n内容`
        错误：`###标题内容` 或 `### 标题内容`
      - 列表标记（- * +）必须在行首，前面不能有空格
      - 列表项前的符号（如 `**粗体**:` ）后面需要加空格
      - 不要在同一行输出多个标题
      - 每个语义单元之间保持适当换行，提高可读性
    MARKDOWN
    
    # Build provider-specific system prompt with framework content
    case provider_name
    when 'Qwen'
      <<~PROMPT.strip
        你是千问，来自阿里云。用户会分享他的想法、观点或内容。
        
        #{framework_prompt}
        
        #{markdown_requirements}
        
        直接输出你的回应，不要加任何解释或套话。
      PROMPT
    when 'DeepSeek'
      <<~PROMPT.strip
        你是 DeepSeek，一个专注于深度思考的 AI 助手。用户会分享他的想法、观点或内容。
        
        #{framework_prompt}
        
        #{markdown_requirements}
        
        直接输出你的回应，不要加任何解释或套话。
      PROMPT
    when 'Gemini'
      <<~PROMPT.strip
        你是 Gemini，来自 Google。用户会分享他的想法、观点或内容。
        
        #{framework_prompt}
        
        #{markdown_requirements}
        
        直接输出你的回应，不要加任何解释或套话。
      PROMPT
    when 'Zhipu'
      <<~PROMPT.strip
        你是智谱 GLM，来自智谱 AI。用户会分享他的想法、观点或内容。
        
        #{framework_prompt}
        
        #{markdown_requirements}
        
        直接输出你的回应，不要加任何解释或套话。
      PROMPT
    when 'ChatGPT'
      <<~PROMPT.strip
        你是 ChatGPT，来自 OpenAI。用户会分享他的想法、观点或内容。
        
        #{framework_prompt}
        
        #{markdown_requirements}
        
        直接输出你的回应，不要加任何解释或套话。
      PROMPT
    when 'Doubao'
      <<~PROMPT.strip
        你是豆包，来自字节跳动。用户会分享他的想法、观点或内容。
        
        #{framework_prompt}
        
        #{markdown_requirements}
        
        直接输出你的回应，不要加任何解释或套话。
      PROMPT
    else # Grok or default
      <<~PROMPT.strip
        你是 Grok，来自 xAI。用户会分享他的想法、观点或内容。
        
        #{framework_prompt}
        
        #{markdown_requirements}
        
        直接输出你的回应，不要加任何解释或套话。
      PROMPT
    end
  end
  
  def get_timeout_for_framework(framework)
    # Frameworks that need longer generation time (2000-3000+ characters)
    case framework
    when 'bezos_memo', 'regret_minimization', 'systems_thinking'
      240 # 4 minutes for long-form content
    when 'omnithink', 'first_principles'
      210  # 3.5 minutes for multi-step analysis
    when 'mimeng_nlp', 'rapid_decision'
      180  # 3 minutes for structured frameworks
    else
      180 # Default: 3 minutes (increased from 120s to handle longer content)
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
    when 'omnithink'
      <<~PROMPT.strip
        你现在是OmniThink写作引擎：模拟人类顶级作者的"扩展→反思→迭代"全过程。
        
        严格执行以下流程（一步步输出可见思考）：
        1. 信息扩展：brainstorm 所有相关知识点、案例、数据、反例、二阶影响（用 bullet points）。
        2. 反思整合：MECE分类 + 找出信息熵最高（最稀缺/最有洞见）的点；删除低价值内容。
        3. 构建信息树：Why（为什么重要） → How（怎么做） → Warning（坑/风险） → Metric（量化指标）。
        4. 大纲生成：极简大纲（3-7层标题）。
        5. 撰写：每段信息密度最大化（知识点/字数比高），用短句 + 编号 + 表格增强可读性。
        6. Self-Check：输出前打分（好奇心/深度/节奏/干货密度，满分10），低于8分重写。
        
        输出格式：
        - 先思考链（可见）
        - 然后最终文章（Markdown）
        
        注意：不要扩写、不要改写，只需按照OmniThink流程分享你的思考。
      PROMPT
    when 'mimeng_nlp'
      <<~PROMPT.strip
        你是顶级情绪操控文案大师，风格像咈蒙巅峰期：模式中断 → 植入心锤 → 路径引导 → 情绪闭环。
        
        必须包含：
        - 开头用“所有”“永远”“99%”“你一定也”“我当年也”泛化制造共鸣
        - 中间读心 + 重新定义（“你以为是努力不够，其实是……”）
        - 情绪层层递进：愤怒/扎心 → 共情 → 希望 → 行动冲动
        - 结尾强收束：一句话金句 + CTA
        
        注意：不要扩写、不要改写，只需按照咈蒙式NLP情绪操控框架分享你的思考。
      PROMPT
    when 'first_principles'
      <<~PROMPT.strip
        你现在是Elon Musk级别的第一性原理思考大师。严格使用第一性原理（First Principles Thinking）来分析和解决这个问题。
        
        必须一步步执行以下流程，不要跳步，不要废话：
        
        1. **拆解到最基本的事实**：把问题彻底分解成最底层、不可再分的物理/逻辑/经济/人性真理（像物理学定律一样，不能再质疑的原子级事实）。列出所有核心组成部分，用bullet points。
        
        2. **质疑所有假设**：列出人们通常对这个问题的默认假设（包括我自己可能有的），然后一个个用第一性原理证明或证伪。哪些是类比/传统智慧导致的错误？哪些是当前环境的表象？
        
        3. **从零重构**：只用上面确认的底层真理，从头构建最优解。忽略行业惯例、别人怎么做。追求极端效率、极端简化、极端创新。
        
        4. **极端场景推演**：考虑最坏情况（物理极限失败）、最佳情况（指数级放大），给出二阶/三阶影响。
        
        5. **输出结构**：
           - 第一性事实清单（bullet）
           - 被证伪的常见假设（带理由）
           - 从零重构的最优路径（编号步骤，越具体越好）
           - 潜在风险 & 如何规避
           - 一句金句总结（像马斯克推文一样犁利）
        
        用中文输出，逻辑极致清晰，每步用**粗体**小标题分隔。
        
        注意：不要扩写、不要改写，只需按照第一性原理方法分享你的思考。
      PROMPT
    when 'rapid_decision'
      <<~PROMPT.strip
        用第一性原理暴力破局当前困境。
        
        必须执行以下4步，冷酷、直接、无安慰：
        
        1. **拆到物理/经济/人性最底层事实**：把当前问题拆到物理/经济/人性最底层事实（列5-8条不可辩驳真理）。用bullet points列出，每条必须是不可再质疑的原子级事实。
        
        2. **识别局部熵减陷阱**：哪些"局部熵减路径"在骗你？列出行业神话、认知偏差、看似正确实则浪费资源的做法。一一拆穿。
        
        3. **重新组装反脆弱路径**：从底层事实重新组装一条"反脆弱、高杠杆"的新路径。必须具备：
           - 失败了也能获得收益（反脆弱）
           - 小投入大产出（高杠杆）
           - 可复利叠加（指数增长）
        
        4. **立即行动方案**：给出立即可执行的3步行动 + 量化指标：
           - 步骤1：[具体动作] - 指标：[可量化的成功标准]
           - 步骤2：[具体动作] - 指标：[可量化的成功标准]
           - 步骤3：[具体动作] - 指标：[可量化的成功标准]
        
        输出风格：冷酷、直接、无安慰。不要励志鸡汤，只要可执行方案。
        
        注意：不要扩写、不要改写，只需按照快速决策破局方法分享你的思考。
      PROMPT
    when 'bezos_memo'
      <<~PROMPT.strip
        你现在是亚马逊前高管级别的叙事备忘录专家，严格遵循Jeff Bezos的"6-Page Narrative Memo"原则：禁止PPT式 bullet points 和浅层总结，强制用连贯的叙事文本（narrative text）写作。写作目标是迫使思考清晰、逻辑严密、数据驱动、避免模糊。
        
        任务：为当前主题写一份完整的亚马逊风格6页备忘录（目标字数约2000-3000中文字符，相当于真实6页单倍行距Calibri 10号字体）。
        
        严格遵守亚马逊6-Pager核心结构（用## Markdown小标题分隔，每节长度均衡，不要列表化，要写成流畅段落）：
        
        1. ## 引言与背景（Introduction & Context）
           用故事或场景开头（像Bezos股东信常用轶事），快速说明问题/机会的背景，为什么现在必须解决/抓住。设置叙事钩子，让读者立即理解重要性。长度约1页。
        
        2. ## 客户/问题深度剖析（Customer/Problem Deep Dive）
           描述真实客户痛点（用数据、引用、场景具象化），避免泛泛而谈。解释当前解决方案为什么失败（包括竞争对手的短板）。用数据支持（如果没有，合理推断或标注假设）。
        
        3. ## 提出的解决方案（Proposed Solution）
           详细叙述你的方案：它是什么？如何工作？为什么从第一性原理看它优于现有方案？用叙事描述用户旅程/工作流变化。强调创新点和杠杆效应。
        
        4. ## 执行计划与时间表（Execution Plan & Timeline）
           一步步说明如何落地：关键里程碑、资源需求、团队分工、风险点 & 缓解措施。量化指标（OKRs、成功度量）必须明确。
        
        5. ## 财务/影响评估（Financials / Impact Analysis）
           预估成本、收入、ROI、二阶影响（对公司/用户/市场的长期效应）。用数据或模型支持（保守 vs 乐观场景）。如果不确定，明确标注假设。
        
        6. ## 附录：常见问题 & 答案（FAQs / Appendix）
           预判读者（Bezos式）会在页边写的问题，并逐一回答。包括最坏情况、替代方案比较、数据来源等。
        
        写作规范（100%遵守）：
        - 全部用叙述性段落写作，像讲故事一样连贯（禁止大量bullet points、表格，除非附录必要数据）。
        - 语言清晰、简洁、数据驱动、逻辑严密、无废话。
        - 每段聚焦一个核心想法，过渡自然。
        - 用Calibri 10号字体思维：句子精炼，段落短（3-6行）。
        - 像Bezos要求：写得像"truth-seeking"而非"selling"。
        
        标题格式：用“[提案名称] - 6-Page Narrative Memo”开头。
        
        注意：不要扩写、不要改写，只需按照亚马逊6页备忘录格式分享你的思考。
      PROMPT
    when 'regret_minimization'
      <<~PROMPT.strip
        你现在是Jeff Bezos级别的遗憾最小化决策教练。严格使用Bezos的"Regret Minimization Framework"来帮助分析这个人生/职业/创业/关系等重大决策。
        
        请一步步应用遗憾最小化框架（不要跳步，逻辑清晰）：
        
        1. **投影到80岁视角**（或临终床边）：想象已经80岁（或躺在病床上回顾一生），从那个老年/终末视角回看现在这个决策点。
           - 对于每个选项，会最遗憾什么？（重点是“没尝试”的遗憾 vs “尝试但失败”的遗憾）
           - 哪个选择会让未来说：“当时为什么不勇敢点？” 或 “幸好我试了，哪怕失败了”
        
        2. **短期 vs 长期遗憾对比**（1-5年 vs 10年以上）：
           - 短期（1-5年）：哪个选项可能让后悔（经济/生活压力/错过机会）？
           - 长期（10+年/一生）：哪个选项更可能让后悔没走？为什么？（考虑 compounding effect：不行动的遗憾会指数级放大）
        
        3. **反事实思考（Counterfactual）**：
           - 如果知道自己不会彻底失败（或失败也能东山再起），会选哪个？
           - 80岁的自己会给什么建议？（用第一人称写出“老年的我”对现在的直接对话）
           - 最坏情况：如果选了冒险路径失败了，会后悔吗？ vs 如果选了安全路径但一生平庸，会后悔吗？
        
        4. **恐惧 vs 成长评估**：
           - 在回避哪个选项主要是因为恐惧（怕穷/怕丢脸/怕不确定），而不是理性风险？
           - 哪个选项更能让成长、扩展人生可能性、符合核心价值观？
        
        5. **最终推荐 & 行动路径**：
           - 根据遗憾最小化原则，哪个选项最可能让未来悔恨最小？
           - 给出量化遗憾概率（主观打分：0-100%，哪个更高悔恨）
           - 立即可执行的3-5步行动（包括风险对冲、测试小步、设定退出机制）
           - 一句扎心金句总结（像Bezos风格：简短、深刻、励志但现实）
        
        输出结构：用## Markdown小标题分隔每步，语言冷酷直接、无鸡汤安慰、truth-seeking（追求真相而非讨好）。
        
        注意：不要扩写、不要改写，只需按照遗憾最小化框架分享你的思考。
      PROMPT
    when 'systems_thinking'
      <<~PROMPT.strip
        你现在是Systems Thinking Architect：一位拥有15年混沌数学、金融系统崩溃研究经验的系统思考大师。你曾亲眼见证市场崩盘如何因忽略互联而酿成灾难，因此开发出一套革命性方法，帮助任何人从线性思维转向多维系统觉察。你能揭示隐藏的互联、反馈回路、涌现模式、杠杆点和二阶/三阶影响。
        
        你的核心使命：引导用户通过系统镜头看清任何问题、项目、决策或人生困境的隐形结构，避免"头痛医头"陷阱。
        
        严格适应性规则（先内部评估，不要输出）：
        - 分析用户问题复杂度：简单（3-5阶段） / 中等（6-8） / 复杂（9-12） / 转型级（13-15）
        - 根据用户盲点、涉众数量、时间跨度、反馈回路密度动态调整阶段深度
        - 始终步步CoT：先识别系统类型 → 评估分析深度 → 设计定制旅程
        
        输出结构（用## Markdown分隔阶段，语言精准、直接、无废话，像资深导师对话）：
        - ## 阶段1: 系统发现与初始边界（欢迎 + 澄清问题 + 收集关键元素：谁/什么涉及？为什么现在重要？边界在哪里？）
        - 后续阶段动态生成（典型包括）：
          ## 组件识别 & 边界定义
          ## 关系映射 & 反馈回路（强化/平衡回路、延迟）
          ## 模式识别 & 时间动态（历史重复、延迟效应、反脆弱点）
          ## 多视角整合（不同涉众/利益方盲点）
          ## 杠杆点识别（Donella Meadows 12杠杆点中最适用的，优先高杠杆）
          ## 二阶/三阶效应 & 非意图后果模拟
          ## 干预策略 & 优化路径（最小干预最大影响）
          ## 韧性构建 & 涌现准备
          ## 行动路线图（短期实验 + 中期监控 + 长期转型）
          ## 系统健康指标 & 持续实践
        
        规则：
        - 每阶段结束问用户输入/反思，推动互动发现而非灌输
        - 用类比/真实案例具象化抽象概念（金融崩溃、生态、组织、个人习惯等）
        - 强调：小变化在大杠杆点可指数放大；忽略回路常导致系统崩溃
        - 输出冷酷truth-seeking，无鸡汤，但带洞见金句
        - 如果用户卡住，Socratic提问引导自发现
        
        注意：不要扩写、不要改写，只需按照系统思考框架分享你的思考。
      PROMPT
    when 'minimal_reader_load'
      <<~PROMPT.strip
        你是顶级内容创作者，专注“读者第一”原则：每句话都让读者觉得“爽/有用/被懂/想继续读”。
        
        核心约束（必须100%遵守）：
        1. 最小脑力消耗：短句为主（平均8-12字），中长句交替制造节奏；每段≤4行。
        2. 每段给“小奖励”：微幽默 / 反差 / 金句 / 扎心共鸣 / 意外数据。
        3. 具象化表达：多用例子、场景、比喻、画面感，少抽象概念。
        4. FOMO制造：用“99%人不知道”“我后悔没早知道”“普通人别再踩坑”。
        
        注意：不要扩写、不要改写，只需按照“读者第一”原则分享你的思考。
      PROMPT
    else
      # Default to 'original' if framework is unknown
      get_framework_prompt('original')
    end
  end
  
  def generate_and_stream(stream_name, prompt, system, article_id, provider, streaming = true, **options)
    full_content = ""
    
    begin
      if streaming
        # Streaming mode: chunks are broadcasted in real-time
        LlmService.call(prompt: prompt, system: system, **options) do |chunk|
          full_content += chunk
          ActionCable.server.broadcast(stream_name, {
            type: 'chunk',
            chunk: chunk
          })
        end
      else
        # Blocking mode: get complete content first, then broadcast once
        full_content = LlmService.call_blocking(prompt: prompt, system: system, **options)
        
        # Broadcast complete content as single chunk
        ActionCable.server.broadcast(stream_name, {
          type: 'chunk',
          chunk: full_content
        })
      end
    rescue LlmService::TimeoutError => e
      # 超时错误：特殊处理（增加超时时间或显示友好提示）
      error_message = "#{get_provider_display_name(provider)} 生成超时（可能内容较长），系统将自动重试..."
      
      # 广播错误到前端
      ActionCable.server.broadcast(stream_name, {
        type: 'error',
        message: error_message
      })
      
      # 保存错误状态到数据库
      if article_id && provider
        article = Article.find_by(id: article_id)
        if article
          # Handle brainstorm providers
          if Article::BRAINSTORM_PROVIDERS.include?(provider.to_s)
            article.set_brainstorm_status(provider, 'error', error_message)
          # Handle draft_xxx providers
          elsif provider.to_s.match(/^draft_(.+)$/)
            provider_name = $1
            article.set_draft_status(provider_name, 'error', error_message)
          end
        end
      end
      
      # 记录错误日志
      Rails.logger.error "LLM Timeout Error (#{provider}): #{e.message}"
      
      # 重新抛出让 retry_on 处理
      raise e
    rescue LlmService::ApiError => e
      # 友好的错误消息
      error_message = parse_error_message(e, provider)
      
      # 广播错误到前端
      ActionCable.server.broadcast(stream_name, {
        type: 'error',
        message: error_message
      })
      
      # 保存错误状态到数据库
      if article_id && provider
        article = Article.find_by(id: article_id)
        if article
          # Handle brainstorm providers
          if Article::BRAINSTORM_PROVIDERS.include?(provider.to_s)
            article.set_brainstorm_status(provider, 'error', error_message)
          # Handle draft_xxx providers
          elsif provider.to_s.match(/^draft_(.+)$/)
            provider_name = $1
            article.set_draft_status(provider_name, 'error', error_message)
          end
        end
      end
      
      # 记录错误日志（包含完整堆栈）
      Rails.logger.error "LLM Stream Error (#{provider}): #{e.message}\n#{e.backtrace.first(10).join("\n")}"
      
      # 检查是否是不可重试的错误（认证/配置错误）
      non_retryable_errors = ['401', '400', '403', 'invalid', 'Incorrect API key', 'Invalid API key']
      is_non_retryable = non_retryable_errors.any? { |err| e.message.include?(err) }
      
      if is_non_retryable
        # 认证/配置错误：不重试，直接失败
        Rails.logger.error "Non-retryable API error, job will not retry: #{e.message}"
        # 不抛出异常，任务标记为完成但失败
      else
        # 可重试的错误（包括503、网络问题、临时故障等）：重新抛出让 retry_on 处理
        Rails.logger.info "Transient error detected, will retry automatically (up to 3 times): #{e.message}"
        raise e
      end
    end
    
    # Save to database based on provider
    if article_id && provider
      article = Article.find_by(id: article_id)
      if article
        case provider
        when 'grok'
          article.update!(brainstorm_grok: full_content)
          article.set_brainstorm_status('grok', 'success')
          # Auto-trigger draft generation if writing_style is set (from create_new_from_existing)
          trigger_draft_after_brainstorm(article, 'grok', stream_name) if article.writing_style.present?
        when 'qwen'
          article.update!(brainstorm_qwen: full_content)
          article.set_brainstorm_status('qwen', 'success')
          trigger_draft_after_brainstorm(article, 'qwen', stream_name) if article.writing_style.present?
        when 'deepseek'
          article.update!(brainstorm_deepseek: full_content)
          article.set_brainstorm_status('deepseek', 'success')
          trigger_draft_after_brainstorm(article, 'deepseek', stream_name) if article.writing_style.present?
        when 'gemini'
          article.update!(brainstorm_gemini: full_content)
          article.set_brainstorm_status('gemini', 'success')
          trigger_draft_after_brainstorm(article, 'gemini', stream_name) if article.writing_style.present?
        when 'zhipu'
          article.update!(brainstorm_zhipu: full_content)
          article.set_brainstorm_status('zhipu', 'success')
          trigger_draft_after_brainstorm(article, 'zhipu', stream_name) if article.writing_style.present?
        when 'doubao'
          article.update!(brainstorm_doubao: full_content)
          article.set_brainstorm_status('doubao', 'success')
          trigger_draft_after_brainstorm(article, 'doubao', stream_name) if article.writing_style.present?
        when 'draft'
          article.update!(draft: full_content)
        when /^draft_(.+)$/
          # Handle draft_grok, draft_qwen, draft_deepseek, draft_gemini, draft_zhipu
          provider_name = $1
          article.update!("draft_#{provider_name}" => full_content)
          article.set_draft_status(provider_name, 'success')
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
  
  def parse_error_message(error, provider)
    message = error.message
    
    # API密钥错误
    if message.include?('Incorrect API key') || message.include?('Invalid API key') || message.include?('invalid') || message.include?('401')
      return "#{get_provider_display_name(provider)} API密钥配置错误，请联系管理员检查配置"
    end
    
    # 权限不足
    if message.include?('403')
      return "#{get_provider_display_name(provider)} 权限不足，请联系管理员检查配置"
    end
    
    # 请求格式错误
    if message.include?('400')
      return "#{get_provider_display_name(provider)} 请求格式错误，请联系管理员"
    end
    
    # 服务过载 - 显示自动重试信息
    if message.include?('503') || message.include?('overloaded')
      return "#{get_provider_display_name(provider)} 服务繁忙，系统将自动重试（最多3次，请稍候）..."
    end
    
    # 速率限制 - 自动重试
    if message.include?('429') || message.include?('rate limit')
      return "#{get_provider_display_name(provider)} 请求过于频繁，系统将自动重试..."
    end
    
    # 通用临时错误 - 自动重试
    "#{get_provider_display_name(provider)} 服务暂时不可用，系统将自动重试（最多3次）..."
  end
  
  def get_provider_display_name(provider)
    # Handle draft_xxx providers
    if provider.to_s.match(/^draft_(.+)$/)
      provider_name = $1
      return case provider_name
      when 'grok' then 'Grok'
      when 'qwen' then '千问'
      when 'deepseek' then 'DeepSeek'
      when 'gemini' then 'Gemini'
      when 'zhipu' then '智谱'
      when 'doubao' then '豆包'
      when 'chatgpt' then 'ChatGPT'
      else provider_name.capitalize
      end
    end
    
    case provider
    when 'grok' then 'Grok'
    when 'qwen' then '千问'
    when 'deepseek' then 'DeepSeek'
    when 'gemini' then 'Gemini'
    when 'zhipu' then '智谱'
    when 'doubao' then '豆包'
    when 'chatgpt' then 'ChatGPT'
    else provider.to_s.capitalize
    end
  end
  
  # Trigger draft generation after brainstorm completes
  # This is called when writing_style is set (from create_new_from_existing)
  def trigger_draft_after_brainstorm(article, provider, stream_name)
    Rails.logger.info "Auto-triggering draft generation for #{provider} after brainstorm completion (article_id: #{article.id})"
    
    # Get brainstorm content
    brainstorm_content = article.send("brainstorm_#{provider}")
    return if brainstorm_content.blank?
    
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
    
    # Build draft prompt with writing style from article
    draft_prompt = build_draft_prompt(article.transcript, brainstorm_content, model_display_name, article.writing_style)
    
    # Get LLM config for this provider
    llm_config = get_llm_config(provider)
    llm_config_with_timeout = llm_config.merge(timeout: 240, max_tokens: 8000)
    
    # Extract base stream name (remove provider suffix if exists)
    base_stream_name = stream_name.sub(/_#{provider}$/, '')
    
    # Trigger draft generation job
    LlmStreamJob.perform_later(
      stream_name: "#{base_stream_name}_draft_#{provider}",
      prompt: draft_prompt,
      llm_config: llm_config_with_timeout,
      article_id: article.id,
      provider: "draft_#{provider}",
      streaming: false
    )
    
    Rails.logger.info "Draft generation job queued for #{provider} (article_id: #{article.id})"
  end
  
  # Build draft prompt (copied from ArticlesChannel for reuse)
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
  
  # Build Luo Zhenyu framework prompt
  def build_luo_zhenyu_framework
    # NOTE: This is identical to the version in CreateDraftsAfterBrainstormJob
    # We keep a copy here to avoid circular dependencies
    <<~FRAMEWORK
      
      ℹ️ 【罗振宇口语化表达框架】
      
      📌 【核心原则：对象化思维 + 线性交付】
      
      **1. 对象化思维（以使用者为中心）**
      - 不是写给自己看，而是**为对方交付知识**
      - 每句话都要问："对方能听懂吗？"
      - 不能自说自话，要让对方**全程跟上你的节奏**
      - 像导游带路："你现在在A点，我要带你去B点"
      
      **2. 线性交付（有起点和终点）**
      - 必须有**明确的起点**：从对方熟悉的东西开始
      - 必须有**明确的终点**：到底要交付什么？
      - 中间过程必须**一步步递进**，不能跳跃
      - 像爬山：从山脚到山顶，中间不能空降
      
      🔥 【四种信息势能模型】
      
      选择其中一种作为主线，贯穿全文：
      
      **模型1：难→易（复杂问题简单化）**
      - 起点：对方觉得"这事太难了"
      - 终点："原来这么简单！"
      - 过程：把复杂概念**拆解成大白话**
      - 例子："量子力学很难？其实就像..."
      
      **模型2：低→高（从现象到规律）**
      - 起点：对方看到的零散现象
      - 终点：背后的**底层逻辑**
      - 过程：从具体案例→抽象规律
      - 例子："你看这三个事儿，背后其实是同一个道理"
      
      **模型3：无→有（从已知到未知）**
      - 起点：对方已经知道的东西
      - 终点：对方不知道的新知识
      - 过程：用**熟悉的事物**类比新概念
      - 例子："你知道XX吧？这个其实和那个很像"
      
      **模型4：非→是（颠覆认知）**
      - 起点：对方的固有认知
      - 终点：**推翻旧认知**，建立新认知
      - 过程：先认同→再质疑→最后颠覆
      - 例子："大家都觉得XX，但其实恰恰相反"
      
      💡 【三大写作心法】
      
      **心法1：弹幕（自我解说）**
      - 像直播时的弹幕，**给自己的内容加注释**
      - 用"你注意看"、"这里很关键"、"划重点"等提示
      - 不断提醒读者："现在讲到哪了？接下来要讲什么？"
      - 例子："接下来这个例子，特别能说明问题"
      
      **心法2：投影（故事和比喻）**
      - 不是直接讲抽象概念，而是**投影到具体故事上**
      - 用类比、比喻、案例让抽象变具体
      - 像电影屏幕：把知识**投影**给观众看
      - 例子："这就像你去超市买东西..."
      
      **心法3：欲望（真情实感）**
      - 必须有**真实的交付欲望**，不能为写而写
      - 要有"我必须让你懂"的紧迫感
      - 文字要带着情绪和温度
      - 禁忌：机械堆砌、无病呻吟、空洞说教
      
      🎯 【罗式黄金句型】
      
      多用这些口语化连接词：
      - **铺垫**："你想啊"、"你想想看"、"咱们假设"
      - **转折**："但问题是"、"关键在于"、"有意思的来了"
      - **强调**："注意啊"、"划重点"、"这个很重要"
      - **类比**："就像"、"比如说"、"打个比方"
      - **总结**："说白了"、"换句话说"、"简单来说"
      - **推进**："那接下来"、"再往下看"、"然后呢"
      
      🚫 【罗式禁忌】
      
      绝对不能出现：
      1. 学术腔："本文"、"笔者"、"综上所述"
      2. 官方话："据悉"、"有关部门"、"相关人士"
      3. 空话套话："众所周知"、"不言而喻"、"显而易见"
      4. 自嗨式排比：连续三个以上"是...是...是..."
      5. 跳跃式论述：没有过渡直接跳到下一个话题
      6. 第三方视角："有人说"、"XX认为"（要用第一人称）
      
      ✅ 【验证标准】
      
      写完后自检：
      1. ✅ 是否有明确的起点和终点？
      2. ✅ 每句话读者能否跟上？
      3. ✅ 是否像在跟朋友聊天？
      4. ✅ 是否用了具体故事/比喻？
      5. ✅ 是否有"弹幕式"提示？
      6. ✅ 是否体现真实的交付欲望？
      
      ⚠️ **应用要求：**
      - 在原有提示词基础上，**叠加**罗振宇框架
      - 选择一个最适合的信息势能模型
      - 全文贯穿三大心法：弹幕、投影、欲望
      - 使用罗式黄金句型，避免所有禁忌
      - 最后用验证标准自检
    FRAMEWORK
  end
  
  # Get LLM config for a provider
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
    when 'doubao'
      {
        base_url: ENV.fetch('DOUBAO_BASE_URL_OPTIONAL'),
        api_key: ENV.fetch('DOUBAO_API_KEY_OPTIONAL'),
        model: ENV.fetch('DOUBAO_MODEL_OPTIONAL')
      }
    when 'chatgpt'
      {
        base_url: ENV.fetch('CHATGPT_BASE_URL_OPTIONAL'),
        api_key: ENV.fetch('CHATGPT_API_KEY_OPTIONAL'),
        model: ENV.fetch('CHATGPT_MODEL_OPTIONAL')
      }
    else # grok or default
      {
        base_url: ENV.fetch('LLM_BASE_URL'),
        api_key: ENV.fetch('LLM_API_KEY'),
        model: ENV.fetch('LLM_MODEL')
      }
    end
  end
end
