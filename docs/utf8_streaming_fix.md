# UTF-8 流式响应字符错位修复

## 问题描述

在流式输出中文内容时，出现字符错位现象，例如：

```
【所有%律师99都卡学工具在"努力却一步"的循环死落后AI永远也有体会，你一定深每天、教程刷——试总觉得不够插件...
```

正常应该是：

```
所有律师都在卡在"努力却一步也学不会AI工具"的死循环，你一定深有体会：每天刷教程、试插件，总觉得不够...
```

## 根本原因

**UTF-8 多字节字符边界切割问题**

1. **HTTP 流式响应的块边界问题**：
   - HTTP 响应以 chunk 形式传输，每个 chunk 的大小由服务器决定
   - 中文字符在 UTF-8 编码中占 3-4 个字节
   - 如果 HTTP chunk 在字符的中间被切断，会产生不完整的字节序列

2. **原代码的问题**：
   ```ruby
   buffer = ""
   response.read_body do |chunk|
     buffer += chunk  # ❌ 直接拼接，没有处理字符边界
     
     while (line_end = buffer.index("\n"))
       line = buffer[0...line_end].strip
       # ... 处理行
     end
   end
   ```
   
   - 没有强制 UTF-8 编码
   - 没有验证字符串的有效性
   - 当 chunk 在 UTF-8 字符中间切断时，`buffer` 会包含无效的字节序列

3. **错位的原因**：
   - 假设"律师"这个词被切成：`chunk1 = "律"的前2字节`, `chunk2 = "律"的第3字节 + "师"`
   - 旧代码直接拼接，导致 `buffer` 中"律"字是不完整的
   - Ruby 的字符串处理会尝试"修复"这个问题，但会产生乱码或跳过字符

## 修复方案

### 1. 强制 UTF-8 编码并验证

```ruby
buffer = "".force_encoding('UTF-8')  # ✅ 强制 UTF-8 编码

response.read_body do |chunk|
  # 强制 chunk 为 UTF-8 编码
  chunk = chunk.force_encoding('UTF-8')
  
  # 拼接到 buffer
  buffer << chunk
  
  # ✅ 关键：只在 buffer 是有效 UTF-8 时才处理
  unless buffer.valid_encoding?
    # 等待更多数据来完成 UTF-8 序列
    next
  end
  
  # ... 处理完整的行
end
```

### 2. 工作原理

1. **强制编码**：
   - `force_encoding('UTF-8')` 告诉 Ruby 这是 UTF-8 字符串
   - 不会修改字节内容，只是设置编码标记

2. **验证编码**：
   - `buffer.valid_encoding?` 检查字符串是否是有效的 UTF-8
   - 如果字符在中间被切断，返回 `false`

3. **等待完整字符**：
   - 当 `valid_encoding?` 返回 `false` 时，跳过本次处理
   - 等待下一个 chunk 到来，补全不完整的字符
   - 下次循环时，字符会是完整的，`valid_encoding?` 返回 `true`

### 3. 示例场景

**场景：HTTP chunk 在"律师"中间切断**

```
原始数据："所有律师都在..."

UTF-8 字节序列：
- "所" = [0xE6, 0x89, 0x80]
- "有" = [0xE6, 0x9C, 0x89]
- "律" = [0xE5, 0xBE, 0x8B]
- "师" = [0xE5, 0xB8, 0x88]
```

**HTTP 传输：**

```
Chunk 1: [0xE6, 0x89, 0x80, 0xE6, 0x9C, 0x89, 0xE5, 0xBE]  # "所有律"前2字节
Chunk 2: [0x8B, 0xE5, 0xB8, 0x88]                          # "律"第3字节 + "师"
```

**旧代码处理（❌ 错误）：**

```ruby
# Chunk 1 到达
buffer = [0xE6, 0x89, 0x80, 0xE6, 0x9C, 0x89, 0xE5, 0xBE]
# "律"不完整，但代码继续处理 → 产生乱码

# Chunk 2 到达
buffer += [0x8B, 0xE5, 0xB8, 0x88]
# 已经乱了，后续字符错位
```

**新代码处理（✅ 正确）：**

```ruby
# Chunk 1 到达
buffer = "所有".force_encoding('UTF-8') + [0xE5, 0xBE]
buffer.valid_encoding?  # => false （"律"不完整）
next  # ✅ 跳过，等待更多数据

# Chunk 2 到达
buffer += [0x8B, 0xE5, 0xB8, 0x88]  # 补全"律" + "师"
buffer.valid_encoding?  # => true （所有字符完整）
# 继续处理 → 输出"所有律师"
```

## 修改的文件

- `app/services/llm_service.rb` 的 `handle_stream_response` 方法（第 316-372 行）

## 技术细节

### Ruby 字符串编码处理

1. **`force_encoding(encoding)`**：
   - 不修改字节内容
   - 只设置字符串的编码标记
   - 快速且无性能开销

2. **`valid_encoding?`**：
   - 检查字符串是否符合其编码规范
   - 对于 UTF-8，验证所有多字节序列是否完整
   - 返回 `false` 表示字符串包含不完整的字符

3. **`<<` vs `+=`**：
   - `<<` 直接修改原字符串（in-place）
   - `+=` 创建新字符串对象
   - 对于大量拼接，`<<` 性能更好

### UTF-8 编码基础

- **ASCII 字符**：1 字节（0x00-0x7F）
- **中文字符**：通常 3 字节
- **特殊字符**：可能 2-4 字节
- **编码规则**：多字节字符的首字节和后续字节有固定模式

## 验证方法

### 1. 手动测试

在主界面输入长文本（包含大量中文），点击"开始思考"，观察流式输出是否流畅无乱码。

### 2. 检查日志

查看 `log/development.log`，确认没有 UTF-8 相关的警告或错误。

### 3. 浏览器开发者工具

打开浏览器控制台，查看 WebSocket 消息，确认传输的文本是正确的中文。

## 性能影响

**几乎无影响**：

- `force_encoding` 是 O(1) 操作（只设置标记）
- `valid_encoding?` 是 O(n) 操作，但只在有新数据时调用
- 相比网络延迟和 LLM 生成时间，这些开销可以忽略不计

## 其他受益场景

此修复同样适用于：

- 所有流式 LLM 响应（brainstorm、draft、final、title、variant）
- 任何通过 HTTP 流式传输的 UTF-8 文本
- 不限于中文，日文、韩文等多字节语言都能受益

## 相关技术文档

- [Ruby String Encoding](https://ruby-doc.org/core-3.3.0/Encoding.html)
- [UTF-8 Specification](https://en.wikipedia.org/wiki/UTF-8)
- [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
