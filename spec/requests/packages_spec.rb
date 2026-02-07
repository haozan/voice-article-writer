require 'rails_helper'

RSpec.describe "Packages", type: :request do

  let(:user) { last_or_create(:user) }
  before { sign_in_as(user) }

  describe "GET /packages" do
    it "returns http success" do
      get packages_path
      expect(response).to be_success_with_view_check('index')
    end
  end
end
