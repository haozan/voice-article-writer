class Article < ApplicationRecord
  def status_label
    return '定稿' if final_content.present?
    return '初稿' if draft.present?
    return '脑爆' if has_brainstorm?
    '未开始'
  end
  
  # Return badge color class for status
  # 红色(danger) = 脑爆, 黄色(warning) = 初稿, 绿色(success) = 定稿
  def status_badge_class
    return 'badge-success' if final_content.present?  # 绿色 - 定稿
    return 'badge-warning' if draft.present?          # 黄色 - 初稿
    return 'badge-danger' if has_brainstorm?          # 红色 - 脑爆
    'badge-secondary'                                  # 灰色 - 未开始
  end
  
  def has_brainstorm?
    brainstorm_grok.present? || 
    brainstorm_qwen.present? || 
    brainstorm_deepseek.present? || 
    brainstorm_gemini.present? || 
    brainstorm_zhipu.present?
  end
end
