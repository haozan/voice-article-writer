class ChangeUsersCreditsDefaultTo30 < ActiveRecord::Migration[7.2]
  def up
    # 修改默认值为 30
    change_column_default :users, :credits, from: 0, to: 30
    
    # 为现有用户补充配额（如果小于 30）
    User.where('credits < ?', 30).find_each do |user|
      user.update_column(:credits, 30)
    end
  end

  def down
    change_column_default :users, :credits, from: 30, to: 0
  end
end
