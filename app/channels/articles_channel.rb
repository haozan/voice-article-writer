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
  # Generate Grok's thinking (step 1)
  def generate_thinking(data)
    transcript = data['transcript']
    model = data['model']
    provider = data['provider']
    
    LlmStreamJob.perform_later(
      stream_name: @stream_name,
      step: 'thinking',
      prompt: transcript,
      model: model,
      provider: provider
    )
  end

  # Generate final article (step 2)
  def generate_article(data)
    transcript = data['transcript']
    thinking = data['thinking']
    model = data['model']
    provider = data['provider']
    
    LlmStreamJob.perform_later(
      stream_name: @stream_name,
      step: 'article',
      prompt: transcript,
      grok_thinking: thinking,
      model: model,
      provider: provider
    )
  end

  private

  # def current_user
  #   @current_user ||= connection.current_user
  # end
end
