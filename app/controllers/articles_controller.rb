class ArticlesController < ApplicationController

  def index
    # Main article generation page
    @stream_name = "article_#{SecureRandom.hex(8)}"
  end
  
  def history
    # Return all articles ordered by created_at DESC
    articles = Article.order(created_at: :desc).limit(100)
    
    render json: articles.map { |article|
      {
        id: article.id,
        created_at: article.created_at.strftime('%Y-%m-%d %H:%M'),
        transcript_preview: article.transcript&.truncate(100, omission: '...') || '无内容',
        status: article.status_label,
        status_class: article.status_badge_class
      }
    }
  end
  
  def show
    @article = Article.find(params[:id])
    
    respond_to do |format|
      format.html # Render show.html.erb
      format.json {
        render json: {
          id: @article.id,
          transcript: @article.transcript,
          brainstorm_grok: @article.brainstorm_grok,
          brainstorm_qwen: @article.brainstorm_qwen,
          brainstorm_deepseek: @article.brainstorm_deepseek,
          brainstorm_gemini: @article.brainstorm_gemini,
          brainstorm_zhipu: @article.brainstorm_zhipu,
          selected_model: @article.selected_model,
          draft: @article.draft,
          final_style: @article.final_style,
          final_content: @article.final_content,
          has_brainstorm: @article.has_brainstorm?,
          created_at: @article.created_at
        }
      }
    end
  rescue ActiveRecord::RecordNotFound
    respond_to do |format|
      format.html { redirect_to articles_path, alert: '文章不存在' }
      format.json { render json: { error: 'Article not found' }, status: :not_found }
    end
  end

  private
  # Write your private methods here
end
