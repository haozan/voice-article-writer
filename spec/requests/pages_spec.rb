require 'rails_helper'

RSpec.describe "Pages", type: :request do

  # Uncomment this if controller need authentication
  # let(:user) { last_or_create(:user) }
  # before { sign_in_as(user) }

  describe "GET /pages/help" do
    it "returns http success" do
      get help_pages_path
      expect(response).to be_success_with_view_check('help')
    end
  end


  describe "GET /pages/privacy" do
    it "returns http success" do
      get privacy_pages_path
      expect(response).to be_success_with_view_check('privacy')
    end
  end


  describe "GET /pages/terms" do
    it "returns http success" do
      get terms_pages_path
      expect(response).to be_success_with_view_check('terms')
    end
  end

end
