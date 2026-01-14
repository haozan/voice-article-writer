module ApplicationHelper
  # Define your helper methods here
  
  def book_cover_svg(book)
    BookCoverService.new(book).call
  end
  
  def book_cover_data_url(book)
    svg = book_cover_svg(book)
    "data:image/svg+xml;base64,#{Base64.strict_encode64(svg)}"
  end

  def markdown(text)
    return '' if text.blank?
    
    options = {
      filter_html: false,
      hard_wrap: true,
      link_attributes: { rel: 'nofollow', target: "_blank" },
      space_after_headers: true,
      fenced_code_blocks: true
    }

    extensions = {
      autolink: true,
      superscript: true,
      disable_indented_code_blocks: false,
      fenced_code_blocks: true,
      strikethrough: true,
      tables: true
    }

    renderer = Redcarpet::Render::HTML.new(options)
    markdown = Redcarpet::Markdown.new(renderer, extensions)

    markdown.render(text).html_safe
  end
end
