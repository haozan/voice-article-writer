class BookCoverService < ApplicationService
  # 30套精选配色方案（高级感 / 现代感 / 干净耐看）
  COLOR_SCHEMES = [
    { name: '晨雾蓝', from: '#A1C4FD', to: '#C2E9FB' },
    { name: '极夜星空', from: '#0F2027', to: '#2C5364' },
    { name: '樱花气泡', from: '#FBD3E9', to: '#BB377D' },
    { name: '翡翠森林', from: '#11998E', to: '#38EF7D' },
    { name: '日落橙', from: '#FF512F', to: '#F09819' },
    { name: '雾霾紫', from: '#757F9A', to: '#D7DDE8' },
    { name: '海盐薄荷', from: '#43CEA2', to: '#185A9D' },
    { name: '奶油米白', from: '#FDFCFB', to: '#E2D1C3' },
    { name: '深海蓝', from: '#2C3E50', to: '#4CA1AF' },
    { name: '柔粉霞光', from: '#FFDEE9', to: '#B5FFFC' },
    { name: '轻奢灰', from: '#BDC3C7', to: '#2C3E50' },
    { name: '青柠苏打', from: '#A8FF78', to: '#78FFD6' },
    { name: '焦糖咖啡', from: '#C79081', to: '#DFA579' },
    { name: '极光紫', from: '#41295A', to: '#2F0743' },
    { name: '天空之境', from: '#89F7FE', to: '#66A6FF' },
    { name: '暖杏奶茶', from: '#F6D365', to: '#FDA085' },
    { name: '石墨黑金', from: '#232526', to: '#414345' },
    { name: '冰川蓝', from: '#E0EAFC', to: '#CFDEF3' },
    { name: '玫瑰红酒', from: '#AA076B', to: '#61045F' },
    { name: '森林晨光', from: '#56AB2F', to: '#A8E063' },
    { name: '雾蓝高级灰', from: '#B0BEC5', to: '#ECEFF1' },
    { name: '深紫星云', from: '#1F1C2C', to: '#928DAB' },
    { name: '蜜桃奶昔', from: '#FFB7C5', to: '#FFD6A5' },
    { name: '碳灰科技', from: '#434343', to: '#000000' },
    { name: '蓝莓酸奶', from: '#4B6CB7', to: '#182848' },
    { name: '春日抹茶', from: '#DCE35B', to: '#45B649' },
    { name: '雪山银白', from: '#E6E9F0', to: '#EEF1F5' },
    { name: '赤陶暖红', from: '#CB356B', to: '#BD3F32' },
    { name: '远山青黛', from: '#355C7D', to: '#6C5B7B' },
    { name: '极简象牙白', from: '#FFFFFF', to: '#F5F5F5' }
  ].freeze

  def initialize(book)
    @book = book
  end

  def call
    generate_svg
  end

  private

  def generate_svg
    width = 400
    height = 560
    
    gradient_colors = select_color_scheme
    gradient_id = "bgGradient-#{@book.id}"
    
    svg = <<~SVG
      <svg width="100%" height="100%" viewBox="0 0 #{width} #{height}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="#{gradient_id}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#{gradient_colors[:from]};stop-opacity:1" />
            <stop offset="100%" style="stop-color:#{gradient_colors[:to]};stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="#{width}" height="#{height}" fill="url(##{gradient_id})"/>
        <rect width="#{width}" height="#{height}" fill="rgba(255, 255, 255, 0.15)"/>
      </svg>
    SVG

    svg
  end

  def select_color_scheme
    # 优先使用用户选择的配色方案，否则使用书籍 ID 取模
    index = @book.cover_scheme_index || (@book.id % COLOR_SCHEMES.length)
    COLOR_SCHEMES[index]
  end
end
