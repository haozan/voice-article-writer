class Persona < ApplicationRecord
  # LLM Provider validation
  validates :llm_provider, inclusion: { in: %w[grok qwen deepseek], message: "%{value} is not a valid LLM provider" }, allow_nil: false
  
  # Get LLM configuration based on provider
  def llm_config
    case llm_provider
    when 'qwen'
      {
        base_url: ENV.fetch('QWEN_BASE_URL'),
        api_key: ENV.fetch('QWEN_API_KEY'),
        model: ENV.fetch('QWEN_MODEL')
      }
    when 'deepseek'
      {
        base_url: ENV.fetch('DEEPSEEK_BASE_URL'),
        api_key: ENV.fetch('DEEPSEEK_API_KEY'),
        model: ENV.fetch('DEEPSEEK_MODEL')
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
  
  # Get LLM provider display name
  def llm_provider_name
    case llm_provider
    when 'qwen'
      '阿里云千问'
    when 'deepseek'
      'DeepSeek'
    when 'grok'
      'Grok AI'
    else
      'Unknown'
    end
  end
end
