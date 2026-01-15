class ArticlesController < ApplicationController
  before_action :authenticate_user!, only: [:index, :history]

  def index
    # Main article generation page
    @stream_name = "article_#{SecureRandom.hex(8)}"
  end
  
  def history
    # Return user's articles if logged in, otherwise all articles
    articles = if current_user
                 current_user.articles.order(created_at: :desc).limit(100)
               else
                 Article.where(user_id: nil).order(created_at: :desc).limit(100)
               end
    
    render json: articles.map { |article|
      {
        id: article.id,
        created_at: article.created_at.strftime('%Y-%m-%d %H:%M'),
        transcript_preview: article.transcript&.truncate(100, omission: '...') || '无内容',
        status: article.status_label,
        status_class: article.status_badge_class,
        archived: article.archived,
        archive_info: article.archive_info,
        can_archive: article.can_archive?
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
          brainstorm_doubao: @article.brainstorm_doubao,
          selected_model: @article.selected_model,
          draft: @article.draft,
          final_style: @article.final_style,
          final_content: @article.final_content,
          title: @article.title,
          title_style: @article.title_style,
          variant: @article.variant,
          variant_style: @article.variant_style,
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
  
  def archive
    @article = Article.find(params[:id])
    chapter = Chapter.find(params[:chapter_id])
    
    if @article.archive_to(chapter)
      render json: { success: true, message: '文章已成功归档' }
    else
      render json: { success: false, message: '归档失败，请确保文章已定稿' }, status: :unprocessable_entity
    end
  rescue ActiveRecord::RecordNotFound => e
    render json: { success: false, message: e.message }, status: :not_found
  end

  private
  # Write your private methods here
end
