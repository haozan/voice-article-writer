# LLM Service - Unified LLM API wrapper with Tool Call & MCP support
# Default streaming API with blocking fallback
# call(&block) - streaming by default, blocking if no block given
#
# Tool Call Support:
#   - Pass tools: [...] to enable function calling
#   - Pass tool_choice: 'auto'|'required'|{type: 'function', function: {name: 'foo'}}
#   - Pass tool_handler: ->(tool_name, args) { ... } to handle tool execution
#
# MCP Support:
#   - Pass mcp_server_url: 'http://...' to load tools from MCP server
#   - MCP tools are automatically converted to OpenAI function format
class LlmService < ApplicationService
  class LlmError < StandardError; end
  class TimeoutError < LlmError; end
  class ApiError < LlmError; end
  class ToolExecutionError < LlmError; end

  def initialize(prompt:, system: nil, **options)
    @prompt = prompt
    @system = system
    @options = options
    @model = options[:model] || ENV.fetch('LLM_MODEL')
    @temperature = options[:temperature]&.to_f || 0.7
    @max_tokens = options[:max_tokens] || 4000
    @timeout = options[:timeout] || 30
    @images = normalize_images(options[:images])

    # OpenRouter specific headers
    @site_url = options[:site_url] || ENV.fetch('OPENROUTER_SITE_URL', '')
    @app_name = options[:app_name] || ENV.fetch('OPENROUTER_APP_NAME', 'Rails App')

    # Tool call support
    @tools = options[:tools] || []
    @tool_choice = options[:tool_choice] # 'auto', 'required', 'none', or {type: 'function', function: {name: 'foo'}}
    @tool_handler = options[:tool_handler] # Proc to execute tools: ->(tool_name, args) { ... }
    @max_tool_iterations = options[:max_tool_iterations] || 5

    # MCP support
    @mcp_server_url = options[:mcp_server_url]
    load_mcp_tools if @mcp_server_url.present?

    # If MCP is used but no handler provided, use default MCP handler
    if @mcp_server_url.present? && @tool_handler.nil?
      @tool_handler = build_mcp_tool_handler
    end

    # Conversation history for multi-turn tool calls
    @messages = []
  end

  # Default call - streaming if block given, blocking otherwise
  def call(&block)
    if block_given?
      call_stream(&block)
    else
      call_blocking
    end
  end

  # Explicit blocking call (returns full response)
  # Automatically handles tool calls if tools are provided
  def call_blocking
    raise LlmError, "Prompt cannot be blank" if @prompt.blank?

    # Build initial messages
    build_initial_messages

    # If tools are available, use multi-turn loop to handle tool calls
    if @tools.present?
      call_blocking_with_tools
    else
      call_blocking_simple
    end
  rescue => e
    Rails.logger.error("LLM Error: #{e.class} - #{e.message}")
    raise
  end

  # Simple blocking call without tool support (backward compatible)
  def call_blocking_simple
    response = make_http_request(stream: false)
    content = response.dig("choices", 0, "message", "content")

    raise LlmError, "No content in response" if content.blank?

    content
  end

  # Blocking call with automatic tool execution
  def call_blocking_with_tools
    iteration = 0
    final_content = nil

    loop do
      iteration += 1
      raise LlmError, "Max tool iterations (#{@max_tool_iterations}) exceeded" if iteration > @max_tool_iterations

      response = make_http_request(stream: false)
      message = response.dig("choices", 0, "message")

      # Add assistant message to history
      @messages << message

      # Check if tool calls are requested
      tool_calls = message["tool_calls"]

      if tool_calls.present?
        # Execute tools and add results to messages
        handle_tool_calls(tool_calls)
      else
        # No more tool calls, return final content
        final_content = message["content"]
        break
      end
    end

    raise LlmError, "No content in final response" if final_content.blank?

    final_content
  end

  # Explicit streaming call (yields chunks as they arrive)
  # Supports tool calls in streaming mode
  def call_stream(&block)
    raise LlmError, "Prompt cannot be blank" if @prompt.blank?
    raise LlmError, "Block required for streaming" unless block_given?

    build_initial_messages

    if @tools.present?
      call_stream_with_tools(&block)
    else
      call_stream_simple(&block)
    end
  rescue => e
    Rails.logger.error("LLM Stream Error: #{e.class} - #{e.message}")
    raise
  end

  # Simple streaming without tools (backward compatible)
  def call_stream_simple(&block)
    full_content = ""

    make_http_request(stream: true) do |chunk_data|
      # Extract content from chunk_data (backward compatible)
      content = chunk_data.is_a?(Hash) ? chunk_data[:content] : chunk_data
      if content.present?
        full_content += content
        block.call(content)
      end
    end

    full_content
  end

  # Streaming with tool call support
  def call_stream_with_tools(&block)
    iteration = 0
    final_content = ""

    loop do
      iteration += 1
      raise LlmError, "Max tool iterations (#{@max_tool_iterations}) exceeded" if iteration > @max_tool_iterations

      tool_calls_buffer = {}
      content_buffer = ""
      has_tool_calls = false

      # Stream response and accumulate tool calls
      make_http_request(stream: true) do |chunk_data|
        # chunk_data includes both content and tool_call deltas
        if chunk_data[:content]
          content_buffer += chunk_data[:content]
          block.call(chunk_data[:content])
        end

        if chunk_data[:tool_calls]
          has_tool_calls = true
          # Accumulate tool call deltas
          chunk_data[:tool_calls].each do |tc|
            idx = tc["index"]
            tool_calls_buffer[idx] ||= {
              "id" => "",
              "type" => "function",
              "function" => {"name" => "", "arguments" => ""}
            }

            tool_calls_buffer[idx]["id"] = tc["id"] if tc["id"]
            if tc["function"]
              tool_calls_buffer[idx]["function"]["name"] += tc["function"]["name"].to_s
              tool_calls_buffer[idx]["function"]["arguments"] += tc["function"]["arguments"].to_s
            end
          end
        end
      end

      # Build complete message
      message = {"role" => "assistant"}
      message["content"] = content_buffer if content_buffer.present?
      if has_tool_calls
        message["tool_calls"] = tool_calls_buffer.values
      end

      @messages << message

      if has_tool_calls
        # Execute tools and continue loop
        handle_tool_calls(message["tool_calls"])
      else
        # No tool calls, we're done
        final_content = content_buffer
        break
      end
    end

    final_content
  end

  # Class method shortcuts
  class << self
    # Default: streaming if block, blocking otherwise
    def call(prompt:, system: nil, **options, &block)
      new(prompt: prompt, system: system, **options).call(&block)
    end

    # Explicit blocking call
    def call_blocking(prompt:, system: nil, **options)
      new(prompt: prompt, system: system, **options).call_blocking
    end

    # Explicit streaming call
    def call_stream(prompt:, system: nil, **options, &block)
      new(prompt: prompt, system: system, **options).call_stream(&block)
    end
  end

  private

  def make_http_request(stream: false, &block)
    # Auto-mock in test environment to avoid slow API calls
    return mock_http_response(stream: stream, &block) if Rails.env.test?

    require 'net/http'
    require 'uri'
    require 'json'

    http, request = prepare_http_request(stream)

    if stream
      handle_stream_response(http, request, &block)
    else
      handle_blocking_response(http, request)
    end
  rescue Net::ReadTimeout
    raise TimeoutError, "Request timed out after #{@timeout}s"
  rescue JSON::ParserError => e
    raise ApiError, "Invalid JSON response: #{e.message}"
  end

  def prepare_http_request(stream)
    base_url = ENV.fetch('LLM_BASE_URL', 'https://openrouter.ai/api/v1')
    api_key = ENV.fetch('LLM_API_KEY')
    
    uri = URI.parse("#{base_url}/chat/completions")

    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == 'https')
    http.read_timeout = @timeout
    http.open_timeout = 10

    request = Net::HTTP::Post.new(uri.path)
    request["Content-Type"] = "application/json"
    request["Authorization"] = "Bearer #{api_key}"
    
    # OpenRouter specific headers
    request["HTTP-Referer"] = @site_url if @site_url.present?
    request["X-Title"] = @app_name if @app_name.present?

    body = build_request_body(stream)
    request.body = body.to_json

    [http, request]
  end

  def build_request_body(stream)
    body = {
      model: @model,
      messages: @messages,
      temperature: @temperature,
      max_tokens: @max_tokens,
      stream: stream
    }

    # Add tools if present
    if @tools.present?
      body[:tools] = @tools
      body[:tool_choice] = @tool_choice if @tool_choice.present?
    end

    body
  end

  def handle_stream_response(http, request, &block)
    buffer = ""

    http.request(request) do |response|
      unless response.code.to_i == 200
        handle_error_response(response)
      end

      response.read_body do |chunk|
        buffer += chunk
        lines = buffer.split("\n")
        buffer = lines.pop || ""

        lines.each do |line|
          next if line.strip.empty?
          next unless line.start_with?("data: ")

          data = line.sub("data: ", "").strip
          next if data == "[DONE]"

          begin
            json = JSON.parse(data)
            delta = json.dig("choices", 0, "delta")
            next unless delta

            # Build chunk_data with both content and tool_calls
            chunk_data = {}
            
            if delta["content"]
              chunk_data[:content] = delta["content"]
            end

            if delta["tool_calls"]
              chunk_data[:tool_calls] = delta["tool_calls"]
            end

            block.call(chunk_data) if chunk_data.present?
          rescue JSON::ParserError => e
            Rails.logger.warn("Skipping invalid JSON chunk: #{e.message}")
          end
        end
      end
    end
  end

  def handle_blocking_response(http, request)
    response = http.request(request)

    unless response.code.to_i == 200
      handle_error_response(response)
    end

    JSON.parse(response.body)
  end

  def handle_error_response(response)
    case response.code.to_i
    when 429
      raise ApiError, "Rate limit exceeded"
    when 500..599
      raise ApiError, "Server error: #{response.code}"
    else
      raise ApiError, "API error: #{response.code} - #{response.body}"
    end
  end

  def build_initial_messages
    @messages = []
    @messages << { role: "system", content: @system } if @system.present?

    if @images.present?
      content = [{ type: "text", text: @prompt.to_s }]
      @images.each do |img|
        content << { type: "image_url", image_url: { url: img } }
      end
      @messages << { role: "user", content: content }
    else
      @messages << { role: "user", content: @prompt }
    end
  end

  def handle_tool_calls(tool_calls)
    raise ToolExecutionError, "No tool handler provided" unless @tool_handler

    tool_calls.each do |tool_call|
      tool_name = tool_call.dig("function", "name")
      args_json = tool_call.dig("function", "arguments")

      begin
        args = JSON.parse(args_json)
        result = @tool_handler.call(tool_name, args)

        @messages << {
          role: "tool",
          tool_call_id: tool_call["id"],
          content: result.to_json
        }
      rescue => e
        Rails.logger.error("Tool execution failed: #{e.message}")
        @messages << {
          role: "tool",
          tool_call_id: tool_call["id"],
          content: { error: e.message }.to_json
        }
      end
    end
  end

  def load_mcp_tools
    # Load tools from MCP server
    require 'net/http'
    require 'uri'
    require 'json'

    uri = URI.parse("#{@mcp_server_url}/tools/list")
    response = Net::HTTP.get_response(uri)

    if response.code.to_i == 200
      tools_data = JSON.parse(response.body)
      @tools = tools_data["tools"] || []
    else
      Rails.logger.error("Failed to load MCP tools: #{response.code}")
    end
  rescue => e
    Rails.logger.error("MCP tools loading error: #{e.message}")
  end

  def build_mcp_tool_handler
    ->(tool_name, args) do
      require 'net/http'
      require 'uri'
      require 'json'

      uri = URI.parse("#{@mcp_server_url}/tools/call")
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == 'https')

      request = Net::HTTP::Post.new(uri.path)
      request["Content-Type"] = "application/json"
      request.body = { name: tool_name, arguments: args }.to_json

      response = http.request(request)
      JSON.parse(response.body)
    end
  end

  def normalize_images(images)
    return [] if images.blank?
    list = images.is_a?(Array) ? images.compact : [images].compact
    list.map(&:to_s).reject(&:blank?)
  end

  def mock_http_response(stream: false, &block)
    mock_content = "Mock LLM response for testing"

    if stream && block_given?
      mock_content.split(" ").each do |word|
        block.call({ content: word + " " })
      end
      mock_content
    else
      {
        "choices" => [
          {
            "message" => {
              "role" => "assistant",
              "content" => mock_content
            }
          }
        ]
      }
    end
  end
end
