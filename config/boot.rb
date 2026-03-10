ENV["BUNDLE_GEMFILE"] ||= File.expand_path("../Gemfile", __dir__)

require "bundler/setup" # Set up gems listed in the Gemfile.
require "bootsnap/setup" # Speed up boot time by caching expensive operations.

# 加载 .env.local（本地开发环境变量，不提交到 git）
env_local = File.expand_path("../../.env.local", __FILE__)
if File.exist?(env_local)
  File.foreach(env_local) do |line|
    line = line.strip
    next if line.empty? || line.start_with?("#")
    key, value = line.split("=", 2)
    ENV[key.strip] ||= value&.strip if key
  end
end
