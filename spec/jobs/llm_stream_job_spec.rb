require 'rails_helper'

RSpec.describe LlmStreamJob, type: :job do
  let(:llm_config) do
    {
      base_url: 'https://api.x.ai/v1',
      api_key: 'test-key',
      model: 'grok-4-1-fast-reasoning'
    }
  end

  describe 'brainstorm generation' do
    it 'does not raise error with required parameters for brainstorm' do
      expect {
        described_class.perform_now(
          stream_name: 'test_channel_grok',
          prompt: 'Test prompt',
          llm_config: llm_config,
          article_id: 1,
          provider: 'grok'
        )
      }.not_to raise_error
    end

    it 'accepts nil provider for backward compatibility' do
      expect {
        described_class.perform_now(
          stream_name: 'test_channel',
          prompt: 'Test prompt',
          llm_config: llm_config
        )
      }.not_to raise_error
    end
  end

  describe 'draft generation' do
    it 'does not raise error with draft provider' do
      expect {
        described_class.perform_now(
          stream_name: 'test_channel_draft',
          prompt: 'Draft prompt with combined content',
          llm_config: llm_config,
          article_id: 1,
          provider: 'draft'
        )
      }.not_to raise_error
    end
  end

  describe 'final generation' do
    it 'does not raise error with final provider' do
      expect {
        described_class.perform_now(
          stream_name: 'test_channel_final',
          prompt: 'Final prompt with style',
          llm_config: llm_config,
          article_id: 1,
          provider: 'final'
        )
      }.not_to raise_error
    end
  end

  describe 'provider detection' do
    it 'detects Qwen provider from base_url' do
      qwen_config = llm_config.merge(base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1')
      expect {
        described_class.perform_now(
          stream_name: 'test_channel_qwen',
          prompt: 'Test prompt',
          llm_config: qwen_config,
          provider: 'qwen'
        )
      }.not_to raise_error
    end

    it 'detects DeepSeek provider from base_url' do
      deepseek_config = llm_config.merge(base_url: 'https://api.deepseek.com')
      expect {
        described_class.perform_now(
          stream_name: 'test_channel_deepseek',
          prompt: 'Test prompt',
          llm_config: deepseek_config,
          provider: 'deepseek'
        )
      }.not_to raise_error
    end
  end
end
