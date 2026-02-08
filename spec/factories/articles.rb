FactoryBot.define do
  factory :article do

    transcript { "MyText" }
    brainstorm_grok { "MyText" }
    brainstorm_qwen { "MyText" }
    brainstorm_deepseek { "MyText" }
    brainstorm_gemini { "MyText" }
    brainstorm_doubao { "MyText" }
    selected_model { "MyString" }
    draft { "MyText" }
    final_style { "MyString" }
    final_content { "MyText" }

  end
end
