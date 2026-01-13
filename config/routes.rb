class AdminConstraint
  def matches?(request)
    return false unless request.session[:current_admin_id].present?

    admin = Administrator.find_by(id: request.session[:current_admin_id])
    admin.present?
  end
end

Rails.application.routes.draw do
  # Routes for articles
  resources :articles, only: [:index]

  root 'articles#index'

  # Do not write business logic at admin dashboard
  namespace :admin do
    resources :personas
    resources :admin_oplogs, only: [:index, :show]
    resources :administrators
    get 'login', to: 'sessions#new', as: :login
    post 'login', to: 'sessions#create'
    delete 'logout', to: 'sessions#destroy', as: :logout
    resource :account, only: [:edit, :update]

    # Mount GoodJob dashboard
    mount GoodJob::Engine => 'good_job', :constraints => AdminConstraint.new

    root to: 'dashboard#index'
  end

  mount ActionCable.server => '/cable'

  # Catch-all route for all 404 errors - MUST be last
  match '*path', to: 'application#handle_routing_error', via: :all,
    constraints: lambda { |request|
      !request.path.start_with?('/rails/active_storage')
    }
end
