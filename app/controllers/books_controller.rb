class BooksController < ApplicationController

  def index
    @books = Book.published.ordered.page(params[:page]).per(12)
    
    # 筛选：搜索
    if params[:search].present?
      @books = @books.where("title ILIKE ? OR author ILIKE ?", "%#{params[:search]}%", "%#{params[:search]}%")
    end
    
    # 排序
    case params[:sort]
    when 'newest'
      @books = @books.reorder(created_at: :desc)
    when 'updated'
      @books = @books.reorder(updated_at: :desc)
    when 'title'
      @books = @books.reorder(title: :asc)
    end
  end

  def show
    @book = Book.friendly.find(params[:id])
    @chapters = @book.root_chapters.includes(:sub_chapters, :articles)
  rescue ActiveRecord::RecordNotFound
    redirect_to books_path, alert: '书籍不存在'
  end

  private
  # Write your private methods here
end
