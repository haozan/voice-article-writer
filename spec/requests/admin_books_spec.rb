require 'rails_helper'

RSpec.describe "Admin::Books", type: :request do
  before { admin_sign_in_as(create(:administrator)) }

  describe "GET /admin/books" do
    it "returns http success" do
      get admin_books_path
      expect(response).to be_success_with_view_check('index')
    end
  end

end
