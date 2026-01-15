require 'rails_helper'

RSpec.describe "Articles", type: :request do

  # Uncomment this if controller need authentication
  # let(:user) { last_or_create(:user) }
  # before { sign_in_as(user) }

  # Note: articles#index has been moved to /write path with authentication
  # describe "GET /articles" do
  #   it "returns http success" do
  #     get articles_path
  #     expect(response).to be_success_with_view_check('index')
  #   end
  # end
end
