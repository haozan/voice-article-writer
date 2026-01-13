FactoryBot.define do
  factory :persona do

    name { "MyString" }
    description { "MyText" }
    system_prompt { "MyText" }
    active { true }
    position { 1 }

  end
end
