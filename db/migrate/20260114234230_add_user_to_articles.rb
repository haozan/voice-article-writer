class AddUserToArticles < ActiveRecord::Migration[7.2]
  def change
    add_reference :articles, :user, null: true, foreign_key: true

  end
end
