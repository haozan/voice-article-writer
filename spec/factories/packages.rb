FactoryBot.define do
  factory :package do

    name { "MyString" }
    price { 1 }
    articles_count { 1 }
    description { "MyText" }
    recommended { true }
    position { 1 }

  end
end
