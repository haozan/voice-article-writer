class Persona < ApplicationRecord
  # LLM Provider validation
  validates :llm_provider, inclusion: { in: %w[grok qwen deepseek gemini zhipu chatgpt doubao], message: "%{value} is not a valid LLM provider" }, allow_nil: false
  
  # Get LLM configuration based on provider
  def llm_config
    case llm_provider
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
  
  # Get LLM provider display name
  def llm_provider_name
    case llm_provider
    when 'qwen'
      '阿里云千问'
    when 'deepseek'
      'DeepSeek'
    when 'gemini'
      'Google Gemini'
    when 'zhipu'
      '智谱 GLM'
    when 'chatgpt'
      'ChatGPT'
    when 'doubao'
      '豆包'
    when 'grok'
      'Grok AI'
    else
      'Unknown'
    end
  end
end
