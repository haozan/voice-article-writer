class Api::BooksController < Api::BaseController
  def index
    books = Book.ordered.select(:id, :title, :author)
    render json: books
  end
end
