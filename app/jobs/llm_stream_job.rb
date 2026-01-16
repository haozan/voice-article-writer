class LlmStreamJob < ApplicationJob
  queue_as :llm

  # Retry strategy configuration
  retry_on Net::ReadTimeout, wait: 5.seconds, attempts: 3
  retry_on LlmService::TimeoutError, wait: 5.seconds, attempts: 3
  # 503 (服务过载) - 等待更长时间后重试
  retry_on LlmService::ApiError, wait: :exponentially_longer, attempts: 3 do |job, exception|
    # 只对 503 错误重试
    exception.message.include?('503') || exception.message.include?('overloaded')
  end
  # 401/400 (认证错误) - 不重试，直接失败
  discard_on LlmService::ApiError do |job, exception|
    exception.message.include?('401') || exception.message.include?('400') || exception.message.include?('invalid') || exception.message.include?('Incorrect API key')
  end

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
    
    # Set custom timeout for frameworks that need longer generation time
    timeout = get_timeout_for_framework(thinking_framework)
    options = options.merge(timeout: timeout) if timeout
    
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
    return 'Doubao' if base_url&.include?('volces') || base_url&.include?('doubao')
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
    when 'Doubao'
      <<~PROMPT.strip
        你是豆包，来自字节跳动。用户会分享他的想法、观点或内容。
        
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
  
  def get_timeout_for_framework(framework)
    # Frameworks that need longer generation time (2000-3000+ characters)
    case framework
    when 'bezos_memo', 'regret_minimization', 'systems_thinking'
      120 # 2 minutes for long-form content
    when 'omnithink', 'first_principles'
      90  # 1.5 minutes for multi-step analysis
    when 'mimeng_nlp', 'rapid_decision'
      60  # 1 minute for structured frameworks
    else
      nil # Use default 30s timeout
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
  
  def generate_and_stream(stream_name, prompt, system, article_id, provider, **options)
    full_content = ""
    
    begin
      LlmService.call(prompt: prompt, system: system, **options) do |chunk|
        full_content += chunk
        ActionCable.server.broadcast(stream_name, {
          type: 'chunk',
          chunk: chunk
        })
      end
    rescue LlmService::ApiError => e
      # 友好的错误消息
      error_message = parse_error_message(e, provider)
      
      # 广播错误到前端
      ActionCable.server.broadcast(stream_name, {
        type: 'error',
        message: error_message
      })
      
      # 记录错误日志
      Rails.logger.error "LLM Stream Error (#{provider}): #{e.message}"
      
      # 重新抛出异常让 retry_on 处理
      raise e
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
        when 'doubao'
          article.update!(brainstorm_doubao: full_content)
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
  
  def parse_error_message(error, provider)
    message = error.message
    
    # API密钥错误
    if message.include?('Incorrect API key') || message.include?('invalid') || message.include?('401')
      return "#{get_provider_display_name(provider)} API密钥配置错误，请联系管理员检查配置"
    end
    
    # 服务过载
    if message.include?('503') || message.include?('overloaded')
      return "#{get_provider_display_name(provider)} 服务繁忙，正在自动重试..."
    end
    
    # 速率限制
    if message.include?('429') || message.include?('rate limit')
      return "#{get_provider_display_name(provider)} 请求过于频繁，请稍后再试"
    end
    
    # 通用错误
    "#{get_provider_display_name(provider)} 服务暂时不可用，请稍后再试"
  end
  
  def get_provider_display_name(provider)
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
end
