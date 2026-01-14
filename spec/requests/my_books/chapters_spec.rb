require 'rails_helper'

RSpec.describe "MyBooks::Chapters", type: :request do
  let(:book) { create(:book) }

  describe "POST /my_books/:my_book_id/chapters" do
    context "with valid parameters" do
      let(:valid_params) { { chapter: { title: "第一章" } } }

      it "creates a new chapter" do
        expect {
          post my_book_chapters_path(book), params: valid_params
        }.to change(Chapter, :count).by(1)
        
        expect(response).to redirect_to(edit_my_book_path(book))
        follow_redirect!
        expect(response.body).to include('章节创建成功')
      end
    end

    context "with parent_id" do
      let!(:parent_chapter) { create(:chapter, book: book) }
      let(:valid_params) { { chapter: { title: "1.1 小节", parent_id: parent_chapter.id } } }

      it "creates a sub-chapter" do
        expect {
          post my_book_chapters_path(book), params: valid_params
        }.to change(Chapter, :count).by(1)
        
        chapter = Chapter.last
        expect(chapter.parent_id).to eq(parent_chapter.id)
      end
    end

    context "with invalid parameters" do
      let(:invalid_params) { { chapter: { title: "" } } }

      it "does not create a chapter" do
        expect {
          post my_book_chapters_path(book), params: invalid_params
        }.not_to change(Chapter, :count)
        
        expect(response).to redirect_to(edit_my_book_path(book))
      end
    end
  end

  describe "GET /my_books/:my_book_id/chapters/:id/edit" do
    let!(:chapter) { create(:chapter, book: book) }

    it "returns http success" do
      get edit_my_book_chapter_path(book, chapter)
      expect(response).to be_success_with_view_check('edit')
    end
  end

  describe "PATCH /my_books/:my_book_id/chapters/:id" do
    let!(:chapter) { create(:chapter, book: book, title: "原标题") }

    context "with valid parameters" do
      let(:valid_params) { { chapter: { title: "新标题" } } }

      it "updates the chapter" do
        patch my_book_chapter_path(book, chapter), params: valid_params
        
        expect(response).to redirect_to(edit_my_book_path(book))
        follow_redirect!
        expect(response.body).to include('章节更新成功')
        
        chapter.reload
        expect(chapter.title).to eq("新标题")
      end
    end

    context "with invalid parameters" do
      let(:invalid_params) { { chapter: { title: "" } } }

      it "does not update the chapter" do
        patch my_book_chapter_path(book, chapter), params: invalid_params
        
        expect(response).to have_http_status(:unprocessable_entity)
        chapter.reload
        expect(chapter.title).to eq("原标题")
      end
    end
  end

  describe "DELETE /my_books/:my_book_id/chapters/:id" do
    let!(:chapter) { create(:chapter, book: book) }

    it "deletes the chapter" do
      expect {
        delete my_book_chapter_path(book, chapter)
      }.to change(Chapter, :count).by(-1)
      
      expect(response).to redirect_to(edit_my_book_path(book))
      follow_redirect!
      expect(response.body).to include('章节已删除')
    end
  end
end
