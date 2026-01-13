class AddLlmProviderToPersonas < ActiveRecord::Migration[7.2]
  def change
    add_column :personas, :llm_provider, :string, default: "grok"

  end
end
