class MyBooks::ChaptersController < ApplicationController
  before_action :set_book
  before_action :set_chapter, only: [:edit, :update, :destroy]

  def create
    @chapter = @book.chapters.build(chapter_params)
    
    if @chapter.save
      redirect_to edit_my_book_path(@book), notice: '章节创建成功'
    else
      redirect_to edit_my_book_path(@book), alert: "创建失败：#{@chapter.errors.full_messages.join(', ')}"
    end
  end

  def edit
  end

  def update
    if @chapter.update(chapter_params)
      redirect_to edit_my_book_path(@book), notice: '章节更新成功'
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @chapter.destroy
    redirect_to edit_my_book_path(@book), notice: '章节已删除'
  end

  private

  def set_book
    @book = Book.friendly.find(params[:my_book_id])
  end

  def set_chapter
    @chapter = @book.chapters.find(params[:id])
  end

  def chapter_params
    params.require(:chapter).permit(:title, :parent_id)
  end
end
