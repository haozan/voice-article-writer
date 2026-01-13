class ArticlesController < ApplicationController

  def index
    # Main article generation page
    @stream_name = "article_#{SecureRandom.hex(8)}"
  end

  private
  # Write your private methods here
end
