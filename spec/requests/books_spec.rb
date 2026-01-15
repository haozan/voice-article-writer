require 'rails_helper'

RSpec.describe "Books", type: :request do

  # Uncomment this if controller need authentication
  # let(:user) { last_or_create(:user) }
  # before { sign_in_as(user) }

  # Note: books routes are currently commented out in routes.rb
  # describe "GET /books" do
  #   it "returns http success" do
  #     get books_path
  #     expect(response).to be_success_with_view_check('index')
  #   end
  # end

  # describe "GET /books/:id" do
  #   let(:book_record) { create(:book) }

  #   it "returns http success" do
  #     get book_path(book_record)
  #     expect(response).to be_success_with_view_check('show')
  #   end
  # end
end
