class ArticlesController < ApplicationController

  def index
    # Main article generation page
    @stream_name = "article_#{SecureRandom.hex(8)}"
    
    # Available models for user selection (OpenRouter supports 100+ models)
    # Visit https://openrouter.ai/models for complete list
    @available_models = [
      # Anthropic Models (Best for reasoning and analysis)
      { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', provider: 'anthropic' },
      { value: 'anthropic/claude-3-opus', label: 'Claude 3 Opus', provider: 'anthropic' },
      { value: 'anthropic/claude-3-sonnet', label: 'Claude 3 Sonnet', provider: 'anthropic' },
      { value: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku', provider: 'anthropic' },
      
      # OpenAI Models (Most popular)
      { value: 'openai/gpt-4-turbo', label: 'GPT-4 Turbo', provider: 'openai' },
      { value: 'openai/gpt-4o', label: 'GPT-4o', provider: 'openai' },
      { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini', provider: 'openai' },
      { value: 'openai/gpt-4', label: 'GPT-4', provider: 'openai' },
      { value: 'openai/gpt-3.5-turbo', label: 'GPT-3.5 Turbo', provider: 'openai' },
      { value: 'openai/o1-preview', label: 'OpenAI o1 Preview', provider: 'openai' },
      { value: 'openai/o1-mini', label: 'OpenAI o1 Mini', provider: 'openai' },
      
      # Google Models (Multimodal capabilities)
      { value: 'google/gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Exp', provider: 'google' },
      { value: 'google/gemini-pro-1.5', label: 'Gemini Pro 1.5', provider: 'google' },
      { value: 'google/gemini-flash-1.5', label: 'Gemini Flash 1.5', provider: 'google' },
      { value: 'google/gemini-pro', label: 'Gemini Pro', provider: 'google' },
      
      # xAI Models (Latest from X/Twitter)
      { value: 'x-ai/grok-beta', label: 'Grok Beta', provider: 'xai' },
      { value: 'x-ai/grok-vision-beta', label: 'Grok Vision Beta', provider: 'xai' },
      
      # Meta Llama Models (Open source leader)
      { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', provider: 'meta' },
      { value: 'meta-llama/llama-3.1-405b-instruct', label: 'Llama 3.1 405B', provider: 'meta' },
      { value: 'meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B', provider: 'meta' },
      { value: 'meta-llama/llama-3.1-8b-instruct', label: 'Llama 3.1 8B', provider: 'meta' },
      
      # Mistral Models (European AI leader)
      { value: 'mistralai/mistral-large', label: 'Mistral Large', provider: 'mistral' },
      { value: 'mistralai/mistral-medium', label: 'Mistral Medium', provider: 'mistral' },
      { value: 'mistralai/mistral-small', label: 'Mistral Small', provider: 'mistral' },
      { value: 'mistralai/mixtral-8x7b-instruct', label: 'Mixtral 8x7B', provider: 'mistral' },
      { value: 'mistralai/mixtral-8x22b-instruct', label: 'Mixtral 8x22B', provider: 'mistral' },
      
      # Cohere Models (Enterprise-focused)
      { value: 'cohere/command-r-plus', label: 'Command R+', provider: 'cohere' },
      { value: 'cohere/command-r', label: 'Command R', provider: 'cohere' },
      { value: 'cohere/command', label: 'Command', provider: 'cohere' },
      
      # Perplexity Models (Search-optimized)
      { value: 'perplexity/llama-3.1-sonar-large-128k-online', label: 'Sonar Large (Online)', provider: 'perplexity' },
      { value: 'perplexity/llama-3.1-sonar-small-128k-online', label: 'Sonar Small (Online)', provider: 'perplexity' },
      
      # DeepSeek Models (Cost-effective Chinese models)
      { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat', provider: 'deepseek' },
      { value: 'deepseek/deepseek-coder', label: 'DeepSeek Coder', provider: 'deepseek' },
      
      # Qwen Models (Alibaba's models)
      { value: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B', provider: 'qwen' },
      { value: 'qwen/qwen-2-72b-instruct', label: 'Qwen 2 72B', provider: 'qwen' },
      
      # Microsoft Models
      { value: 'microsoft/wizardlm-2-8x22b', label: 'WizardLM 2 8x22B', provider: 'microsoft' },
      
      # AI21 Models
      { value: 'ai21/jamba-instruct', label: 'Jamba Instruct', provider: 'ai21' }
    ]
  end

  private
  # Write your private methods here
end
