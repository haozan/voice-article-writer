# This file should contain all the record creation needed to seed the database with its default values.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).

# IMPORTANT: Do NOT add Administrator data here!
# Administrator accounts should be created manually by user.
# This seeds file is only for application data (products, categories, etc.)
#
require 'open-uri'

# Write your seed data here

# 套餐定价
puts "Creating packages..."

Package.destroy_all

packages_data = [
  {
    name: "新手套餐",
    price: 19900, # 199元，存储为分
    articles_count: 80,
    description: "适合初次体验的用户，感受 AI 写作的魅力",
    recommended: false,
    position: 1
  },
  {
    name: "标准套餐",
    price: 39900, # 399元
    articles_count: 200,
    description: "最受欢迎的选择，满足日常写作需求",
    recommended: true,
    position: 2
  },
  {
    name: "专业套餐",
    price: 69900, # 699元
    articles_count: 500,
    description: "专业创作者首选，充足的文章配额",
    recommended: false,
    position: 3
  },
  {
    name: "旗舰套餐",
    price: 129900, # 1299元
    articles_count: 1200,
    description: "企业级配额，适合团队或高产创作者",
    recommended: false,
    position: 4
  }
]

packages_data.each do |package_data|
  Package.create!(package_data)
  puts "  ✓ Created package: #{package_data[:name]} - ¥#{package_data[:price] / 100} / #{package_data[:articles_count]}篇"
end

puts "Packages created successfully!"
