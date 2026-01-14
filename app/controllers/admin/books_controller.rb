class Admin::BooksController < Admin::BaseController
  before_action :set_book, only: [:show, :edit, :update, :destroy]

  def index
    @books = Book.page(params[:page]).per(10)
  end

  def show
  end

  def new
    @book = Book.new
  end

  def create
    @book = Book.new(book_params)

    if @book.save
      redirect_to admin_book_path(@book), notice: 'Book was successfully created.'
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @book.update(book_params)
      redirect_to admin_book_path(@book), notice: 'Book was successfully updated.'
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @book.destroy
    redirect_to admin_books_path, notice: 'Book was successfully deleted.'
  end

  private

  def set_book
    @book = Book.find(params[:id])
  end

  def book_params
    params.require(:book).permit(:title, :subtitle, :description, :author, :status, :published_at, :pinned, :cover_style, :slug)
  end
end
