# Image Generation Service - Uses OpenRouter for unified multi-model support
class ImageGenerationService < ApplicationService
  class ImageGenerationError < StandardError; end
  class TimeoutError < ImageGenerationError; end
  class ApiError < ImageGenerationError; end

  def initialize(prompt:, **options)
    @prompt = prompt
    @options = options
    @model = options[:model] || ENV.fetch('IMAGE_GEN_MODEL')
    @size = options[:size] || ENV.fetch('IMAGE_GEN_SIZE', '1024x1024')
    @timeout = options[:timeout] || 60
    @images = normalize_images(options[:images])
    
    # OpenRouter specific headers
    @site_url = options[:site_url] || ENV.fetch('OPENROUTER_SITE_URL', '')
    @app_name = options[:app_name] || ENV.fetch('OPENROUTER_APP_NAME', 'Rails App')
  end

  # Generate image(s) and return result
  # Returns: { images: [base64_data_urls] }
  def call
    raise ImageGenerationError, "Prompt cannot be blank" if @prompt.blank?

    response = make_http_request
    images = extract_images(response)

    raise ImageGenerationError, "No images in response" if images.empty?

    { images: images }
  rescue => e
    Rails.logger.error("Image Generation Error: #{e.class} - #{e.message}")
    raise
  end

  # Class method shortcut
  class << self
    def call(prompt:, **options)
      new(prompt: prompt, **options).call
    end
  end

  private

  def make_http_request
    require 'net/http'
    require 'uri'
    require 'json'

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

    messages = []
    if @images.present?
      content = [{ type: "text", text: @prompt.to_s }]
      @images.each do |img|
        content << { type: "image_url", image_url: { url: img } }
      end
      messages << { role: "user", content: content }
    else
      messages << { role: "user", content: @prompt }
    end

    body = {
      model: @model,
      messages: messages,
      size: @size,
      modalities: ["text", "image"]
    }

    request.body = body.to_json

    response = http.request(request)

    case response.code.to_i
    when 200
      JSON.parse(response.body)
    when 429
      raise ApiError, "Rate limit exceeded"
    when 500..599
      raise ApiError, "Server error: #{response.code}"
    else
      raise ApiError, "API error: #{response.code} - #{response.body}"
    end
  rescue Net::ReadTimeout
    raise TimeoutError, "Request timed out after #{@timeout}s"
  rescue JSON::ParserError => e
    raise ApiError, "Invalid JSON response: #{e.message}"
  end

  def extract_images(response)
    message = response.dig("choices", 0, "message")
    return [] unless message

    if message["images"] && message["images"].is_a?(Array)
      message["images"]
        .map { |img| img.dig("image_url", "url") }
        .compact
    elsif message["content"].is_a?(String)
      message["content"].scan(%r{data:image/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+}) rescue []
    else
      []
    end
  end

  def normalize_images(images)
    return [] if images.blank?
    list = images.is_a?(Array) ? images.compact : [images].compact
    list.map(&:to_s).reject(&:blank?)
  end
end
