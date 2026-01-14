class Admin::ChaptersController < Admin::BaseController
  before_action :set_chapter, only: [:show, :edit, :update, :destroy]

  def index
    @chapters = Chapter.page(params[:page]).per(10)
  end

  def show
  end

  def new
    @chapter = Chapter.new
  end

  def create
    @chapter = Chapter.new(chapter_params)

    if @chapter.save
      redirect_to admin_chapter_path(@chapter), notice: 'Chapter was successfully created.'
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @chapter.update(chapter_params)
      redirect_to admin_chapter_path(@chapter), notice: 'Chapter was successfully updated.'
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @chapter.destroy
    redirect_to admin_chapters_path, notice: 'Chapter was successfully deleted.'
  end

  private

  def set_chapter
    @chapter = Chapter.find(params[:id])
  end

  def chapter_params
    params.require(:chapter).permit(:title, :position, :level, :book_id, :parent_id)
  end
end
