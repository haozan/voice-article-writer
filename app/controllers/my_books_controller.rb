class MyBooksController < ApplicationController

  def show
    @book = Book.friendly.find(params[:id])
  end

  def change_cover
    @book = Book.friendly.find(params[:id])
    current_index = @book.cover_scheme_index || (@book.id % 30)
    next_index = (current_index + 1) % 30
    @book.update!(cover_scheme_index: next_index)
    
    respond_to do |format|
      format.turbo_stream
      format.html { redirect_to my_books_path, notice: "封皮已更换为：#{BookCoverService::COLOR_SCHEMES[next_index][:name]}" }
    end
  end

  def move_article
    @book = Book.friendly.find(params[:id])
    @article = Article.find(params[:article_id])
    old_chapter = @article.chapter
    target_chapter = @book.chapters.find(params[:target_chapter_id])
    
    if @article.update(chapter: target_chapter)
      # Return turbo stream to refresh both old and new chapters
      render turbo_stream: [
        turbo_stream.replace(
          "chapter-#{old_chapter.id}",
          partial: 'my_books/chapter_content',
          locals: { chapter: old_chapter.reload }
        ),
        turbo_stream.replace(
          "chapter-#{target_chapter.id}",
          partial: 'my_books/chapter_content',
          locals: { chapter: target_chapter.reload }
        )
      ]
    else
      head :unprocessable_entity
    end
  end

  def index
    @books = Book.order(pinned: :desc, updated_at: :desc).page(params[:page]).per(12)
    
    if params[:search].present?
      @books = @books.where("title ILIKE ? OR author ILIKE ?", "%#{params[:search]}%", "%#{params[:search]}%")
    end
    
    case params[:sort]
    when 'newest'
      @books = @books.reorder(created_at: :desc)
    when 'updated'
      @books = @books.reorder(updated_at: :desc)
    when 'title'
      @books = @books.reorder(title: :asc)
    end
  end

  def new
    @book = Book.new
  end

  def edit
    @book = Book.friendly.find(params[:id])
  end

  def create
    @book = Book.new(book_params)
    
    if @book.save
      redirect_to my_books_path, notice: '书籍创建成功'
    else
      render :new, status: :unprocessable_entity
    end
  end

  def update
    @book = Book.friendly.find(params[:id])
    
    if @book.update(book_params)
      redirect_to my_books_path, notice: '书籍更新成功'
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @book = Book.friendly.find(params[:id])
    @book.destroy
    redirect_to my_books_path, notice: '书籍已删除'
  end

  private
  
  def book_params
    params.require(:book).permit(:title, :subtitle, :description, :author, :status, :published_at, :pinned)
  end
end
