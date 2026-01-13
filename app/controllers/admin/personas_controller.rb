class Admin::PersonasController < Admin::BaseController
  before_action :set_persona, only: [:show, :edit, :update, :destroy]

  def index
    @personas = Persona.page(params[:page]).per(10)
  end

  def show
  end

  def new
    @persona = Persona.new
  end

  def create
    @persona = Persona.new(persona_params)

    if @persona.save
      redirect_to admin_persona_path(@persona), notice: 'Persona was successfully created.'
    else
      render :new, status: :unprocessable_entity
    end
  end

  def edit
  end

  def update
    if @persona.update(persona_params)
      redirect_to admin_persona_path(@persona), notice: 'Persona was successfully updated.'
    else
      render :edit, status: :unprocessable_entity
    end
  end

  def destroy
    @persona.destroy
    redirect_to admin_personas_path, notice: 'Persona was successfully deleted.'
  end

  private

  def set_persona
    @persona = Persona.find(params[:id])
  end

  def persona_params
    params.require(:persona).permit(:name, :description, :system_prompt, :active, :position)
  end
end
