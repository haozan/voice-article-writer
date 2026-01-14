require 'rails_helper'

RSpec.describe BookCoverService, type: :service do
  describe '#call' do
    it 'can be initialized and called' do
      book = build(:book, title: '测试书籍', cover_style: 'minimal')
      service = BookCoverService.new(book)
      result = service.call
      expect(result).to be_a(String)
      expect(result).to include('svg')
    end
  end
end
