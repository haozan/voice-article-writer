# Create some example writing tips
writing_tips = [
  {
    content: "💡 建议将语音内容控制在 2-5 分钟，这样能获得最好的文章结构和完整度。",
    position: 1
  },
  {
    content: "✨ 选择合适的决策框架能让你的文章更有说服力，比如使用「第一性原理」来深度分析问题。",
    position: 2
  },
  {
    content: "🎯 想让文章更有人味？试试罗振宇口语化风格，它能让专业内容变得通俗易懂。",
    position: 3
  },
  {
    content: "🚀 使用「最小化读者脑力消耗」框架，让你的文章更容易被理解和传播。",
    position: 4
  },
  {
    content: "💬 说话时尽量保持自然，就像和朋友聊天一样，AI 会帮你整理成结构化的文章。",
    position: 5
  },
  {
    content: "📝 可以先说出你的核心观点，然后展开细节，这样生成的文章逻辑会更清晰。",
    position: 6
  },
  {
    content: "🌟 不确定用哪个框架？试试「原汁原味」，它会保留你最真实的表达风格。",
    position: 7
  },
  {
    content: "⚡ 五个 AI 模型会同时思考，你可以对比它们的建议，选择最符合你想法的版本。",
    position: 8
  }
]

puts "Creating writing tips..."
writing_tips.each do |tip_attrs|
  WritingTip.find_or_create_by!(content: tip_attrs[:content]) do |tip|
    tip.position = tip_attrs[:position]
    tip.active = true
  end
end

puts "✅ Created #{WritingTip.count} writing tips"
