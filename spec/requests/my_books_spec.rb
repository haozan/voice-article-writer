require 'rails_helper'

RSpec.describe "MyBooks", type: :request do
  let(:user) { create(:user) }
  let(:book) { create(:book, user: user) }

  before do
    sign_in_as(user)
  end

  describe "GET /my_books/:id" do
    it "returns http success" do
      get my_book_path(book)
      expect(response).to be_success_with_view_check('show')
    end

    context "with chapters and articles" do
      let!(:chapter1) { create(:chapter, book: book, title: "第一章") }
      let!(:chapter2) { create(:chapter, book: book, title: "第二章", parent: chapter1) }
      let!(:article) { create(:article, chapter: chapter1) }

      it "displays book content with chapters" do
        get my_book_path(book)
        expect(response).to be_success_with_view_check('show')
        expect(response.body).to include("第一章")
        expect(response.body).to include("第二章")
      end
    end
  end
end
