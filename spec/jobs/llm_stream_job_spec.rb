require 'rails_helper'

RSpec.describe LlmStreamJob, type: :job do
  it 'does not raise error with required parameters for thinking step' do
    expect {
      described_class.perform_now(
        stream_name: 'test_channel',
        step: 'thinking',
        prompt: 'Test prompt'
      )
    }.not_to raise_error
  end

  it 'does not raise error with required parameters for article step' do
    expect {
      described_class.perform_now(
        stream_name: 'test_channel',
        step: 'article',
        prompt: 'Test prompt',
        grok_thinking: 'Test thinking'
      )
    }.not_to raise_error
  end

  it 'raises error when grok_thinking is missing for article step' do
    expect {
      described_class.perform_now(
        stream_name: 'test_channel',
        step: 'article',
        prompt: 'Test prompt'
      )
    }.to raise_error(ArgumentError, /grok_thinking is required/)
  end

  it 'raises error with unknown step' do
    expect {
      described_class.perform_now(
        stream_name: 'test_channel',
        step: 'invalid_step',
        prompt: 'Test prompt'
      )
    }.to raise_error(ArgumentError, /Unknown step/)
  end
end
