require 'rails_helper'

RSpec.describe "Admin::WritingTips", type: :request do
  before { admin_sign_in_as(create(:administrator)) }

  describe "GET /admin/writing_tips" do
    it "returns http success" do
      get admin_writing_tips_path
      expect(response).to be_success_with_view_check('index')
    end
  end

end
