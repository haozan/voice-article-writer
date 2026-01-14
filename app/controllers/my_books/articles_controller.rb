class MyBooks::ArticlesController < ApplicationController
  include ApplicationHelper
  
  def update
    @article = Article.find(params[:id])
    
    if @article.update(final_content: params[:final_content])
      # Render turbo stream response to update content
      respond_to do |format|
        format.turbo_stream do
          render turbo_stream: [
            # Update the rendered markdown content
            turbo_stream.update(
              "article-content-#{@article.id}",
              markdown(@article.final_content)
            ),
            # Update the textarea value
            turbo_stream.update(
              "article-editor-#{@article.id}",
              @article.final_content
            )
          ]
        end
      end
    else
      head :unprocessable_entity
    end
  end
end
