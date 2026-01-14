class Api::ChaptersController < Api::BaseController
  def index
    book = Book.find(params[:book_id])
    chapters = build_chapter_tree(book.root_chapters.includes(:sub_chapters))
    render json: chapters
  end

  private

  def build_chapter_tree(chapters)
    chapters.map do |chapter|
      {
        id: chapter.id,
        title: chapter.title,
        full_title: chapter.full_title,
        level: chapter.level,
        children: chapter.sub_chapters.any? ? build_chapter_tree(chapter.sub_chapters.ordered) : []
      }
    end
  end
end
