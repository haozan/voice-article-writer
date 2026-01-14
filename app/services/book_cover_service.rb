class BookCoverService < ApplicationService
  STYLES = {
    minimal: {
      bg_colors: ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#2d4059'],
      text_color: '#ffffff',
      accent_color: '#eaeaea'
    },
    gradient: {
      gradients: [
        ['#667eea', '#764ba2'],
        ['#f093fb', '#f5576c'],
        ['#4facfe', '#00f2fe'],
        ['#43e97b', '#38f9d7'],
        ['#fa709a', '#fee140']
      ],
      text_color: '#ffffff',
      accent_color: '#ffffff'
    },
    literary: {
      bg_colors: ['#f4e8d8', '#e8d5c4', '#f5f0e8', '#ede3d8', '#f0e6dc'],
      text_color: '#3e2723',
      accent_color: '#8d6e63',
      pattern: true
    },
    modern: {
      bg_colors: ['#000000', '#1a1a1a', '#2c2c2c', '#0a0e27', '#1b1b2f'],
      text_color: '#ffffff',
      accent_color: '#00d4ff',
      geometric: true
    },
    academic: {
      bg_colors: ['#ffffff', '#f9f9f9', '#fafafa', '#f5f5f5', '#fcfcfc'],
      text_color: '#212121',
      accent_color: '#757575',
      border: true
    }
  }

  def initialize(book)
    @book = book
    @style = book.cover_style.to_sym
    @config = STYLES[@style]
  end

  def call
    generate_svg
  end

  private

  def generate_svg
    width = 400
    height = 560
    
    svg = <<~SVG
      <svg width="100%" height="100%" viewBox="0 0 #{width} #{height}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          #{generate_defs}
        </defs>
        #{generate_background(width, height)}
        #{generate_decorations(width, height)}
        #{generate_text(width, height)}
      </svg>
    SVG

    svg
  end

  def generate_defs
    case @style
    when :gradient
      gradient = @config[:gradients][hash_value % @config[:gradients].length]
      <<~DEFS
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#{gradient[0]};stop-opacity:1" />
          <stop offset="100%" style="stop-color:#{gradient[1]};stop-opacity:1" />
        </linearGradient>
      DEFS
    when :literary
      <<~DEFS
        <pattern id="dots" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#{@config[:accent_color]}" opacity="0.2"/>
        </pattern>
      DEFS
    else
      ''
    end
  end

  def generate_background(width, height)
    case @style
    when :gradient
      %(<rect width="#{width}" height="#{height}" fill="url(#bgGradient)"/>)
    when :literary
      bg_color = @config[:bg_colors][hash_value % @config[:bg_colors].length]
      <<~BG
        <rect width="#{width}" height="#{height}" fill="#{bg_color}"/>
        <rect width="#{width}" height="#{height}" fill="url(#dots)"/>
      BG
    when :academic
      bg_color = @config[:bg_colors][hash_value % @config[:bg_colors].length]
      <<~BG
        <rect width="#{width}" height="#{height}" fill="#{bg_color}"/>
        <rect x="20" y="20" width="#{width - 40}" height="#{height - 40}" 
              fill="none" stroke="#{@config[:accent_color]}" stroke-width="2"/>
      BG
    else
      bg_color = @config[:bg_colors][hash_value % @config[:bg_colors].length]
      %(<rect width="#{width}" height="#{height}" fill="#{bg_color}"/>)
    end
  end

  def generate_decorations(width, height)
    case @style
    when :modern
      <<~DECO
        <circle cx="#{width - 50}" cy="50" r="30" fill="#{@config[:accent_color]}" opacity="0.3"/>
        <rect x="30" y="#{height - 100}" width="60" height="60" fill="#{@config[:accent_color]}" opacity="0.2"/>
        <line x1="0" y1="#{height / 2}" x2="100" y2="#{height / 2}" 
              stroke="#{@config[:accent_color]}" stroke-width="2" opacity="0.5"/>
      DECO
    when :literary
      <<~DECO
        <line x1="50" y1="80" x2="#{width - 50}" y2="80" 
              stroke="#{@config[:accent_color]}" stroke-width="1" opacity="0.5"/>
        <line x1="50" y1="#{height - 80}" x2="#{width - 50}" y2="#{height - 80}" 
              stroke="#{@config[:accent_color]}" stroke-width="1" opacity="0.5"/>
      DECO
    else
      ''
    end
  end

  def generate_text(width, height)
    title = escape_xml(@book.title || '未命名')
    subtitle = escape_xml(@book.subtitle)
    author = escape_xml(@book.author || '佚名')
    
    # 标题字号根据长度调整
    title_font_size = title.length > 10 ? 32 : 42
    
    text_elements = []
    
    # 标题
    text_elements << <<~TITLE
      <text x="#{width / 2}" y="#{height / 2 - 40}" 
            font-family="Arial, sans-serif" 
            font-size="#{title_font_size}" 
            font-weight="bold" 
            fill="#{@config[:text_color]}" 
            text-anchor="middle" 
            dominant-baseline="middle">
        #{wrap_text(title, 12)}
      </text>
    TITLE

    # 副标题
    if subtitle.present?
      text_elements << <<~SUBTITLE
        <text x="#{width / 2}" y="#{height / 2 + 20}" 
              font-family="Arial, sans-serif" 
              font-size="18" 
              fill="#{@config[:text_color]}" 
              opacity="0.8"
              text-anchor="middle">
          #{wrap_text(subtitle, 15)}
        </text>
      SUBTITLE
    end

    # 作者
    text_elements << <<~AUTHOR
      <text x="#{width / 2}" y="#{height - 60}" 
            font-family="Arial, sans-serif" 
            font-size="20" 
            fill="#{@config[:accent_color]}" 
            text-anchor="middle">
        #{author}
      </text>
    AUTHOR

    text_elements.join("\n")
  end

  def wrap_text(text, max_length)
    return text if text.length <= max_length
    
    # 简单截断并添加省略号
    text[0...max_length] + '...'
  end

  def escape_xml(text)
    return '' if text.blank?
    
    text.gsub('&', '&amp;')
        .gsub('<', '&lt;')
        .gsub('>', '&gt;')
        .gsub('"', '&quot;')
        .gsub("'", '&apos;')
  end

  def hash_value
    @hash_value ||= @book.title.to_s.bytes.sum
  end
end
