FactoryBot.define do
  factory :book do
    title { "示例书籍" }
    subtitle { "一本有趣的书" }
    description { "这是一本示例书籍的描述" }
    author { "张三" }
    status { "published" }
    published_at { Time.current }
    pinned { false }

  end
end
