FactoryBot.define do
  factory :chapter do
    association :book
    title { "MyString" }
    position { 1 }
    level { 1 }
    parent { nil }
  end
end
