class AddCoverSchemeIndexToBooks < ActiveRecord::Migration[7.2]
  def change
    add_column :books, :cover_scheme_index, :integer

  end
end
