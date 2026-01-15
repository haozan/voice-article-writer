class AddUserToBooks < ActiveRecord::Migration[7.2]
  def change
    add_reference :books, :user, null: true, foreign_key: true

  end
end
