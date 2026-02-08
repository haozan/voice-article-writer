class Admin::WritingTipsController < Admin::BaseController
  before_action :set_writing_tip, only: [:show, :edit, :update, :destroy]

  def index
    @writing_tips = WritingTip.ordered.page(params[:page]).per(10)
  end

  def show
  end

  def new
    @writing_tip = WritingTip.new
  end

  def create
    @writing_tip = WritingTip.new(writing_tip_params)

    if @writing_tip.save
      redirect_to admin_writing_tip_path(@writing_tip), notice: 'Writing tip was successfully created.'
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @writing_tip.update(writing_tip_params)
      redirect_to admin_writing_tip_path(@writing_tip), notice: 'Writing tip was successfully updated.'
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @writing_tip.destroy
    redirect_to admin_writing_tips_path, notice: 'Writing tip was successfully deleted.'
  end

  private

  def set_writing_tip
    @writing_tip = WritingTip.find(params[:id])
  end

  def writing_tip_params
    params.require(:writing_tip).permit(:content, :active, :position)
  end
end
