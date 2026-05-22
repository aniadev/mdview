---
title: "mdview v2.0.0 — AI Strategy: Phân tích nghiệp vụ & User Flow"
version: 2.0.0
created: 2026-05-23
status: draft
---

# AI Strategy: Làm sao để BA/CEO dùng được AI ngay trong app?

## Vấn đề cốt lõi

BA/CEO không biết API key là gì. Họ đã quen dùng ChatGPT/Claude/Gemini qua trình duyệt. Muốn AI trong mdview nhưng **không muốn học khái niệm mới**.

→ Cần phân tích từng phương án từ **đơn giản nhất đến mạnh nhất**, chọn lối vào phù hợp.

---

## Phương án A: Trình duyệt nhúng — "Web AI Panel"

### A.1 Ý tưởng

Nhúng một webview mini trong sidebar mdview, trỏ đến `chat.openai.com`, `claude.ai`, hoặc `gemini.google.com`. Người dùng đăng nhập như bình thường, chat AI trong panel — không cần API key.

### A.2 User Flow

```
Người dùng mở sidebar tab "AI"
    │
    ▼
Panel hiển thị webview đến chatgpt.com
    │
    ├─ Đăng nhập lần đầu (nếu chưa login)
    │
    ▼
Giao diện ChatGPT quen thuộc trong panel mdview
    │
    ├─ Chat như bình thường
    │
    ├─ Kéo thả / copy nội dung từ editor sang chat
    │
    └─ Copy kết quả từ chat → paste vào editor
```

**"Send to AI" nút bổ trợ:** Chọn text trong editor → nút "Send to AI" → tự động paste vào ô input của webview (nếu kỹ thuật cho phép).

### A.3 Đánh giá

| Tiêu chí | Đánh giá |
|----------|----------|
| **Setup effort cho user** | ✅ Zero — dùng tài khoản có sẵn |
| **UX quen thuộc** | ✅ Giao diện ChatGPT/Claude y hệt |
| **Context injection** | ❌ Không tự động gửi nội dung file |
| **Copy-paste friction** | ⚠️ Vẫn phải copy-paste thủ công |
| **Tính khả thi kỹ thuật** | ⚠️ Có blocker tiềm ẩn |

### A.4 Blocker kỹ thuật

| Vấn đề | Chi tiết |
|--------|---------|
| **X-Frame-Options** | `chat.openai.com` và `claude.ai` gần như chắc chắn chặn iframe embedding |
| **CORS / CSP** | Content Security Policy ngăn nhúng cross-origin |
| **Tauri Webview** | Có thể tạo webview riêng (không phải iframe), nhưng vẫn bị server-side block nếu site kiểm tra origin |
| **Login session** | Webview có thể không share cookie với browser chính → phải login lại, có thể bị chặn (Google đặc biệt nghiêm ngặt) |

**Cần test thực tế:** Tạo một Tauri webview trỏ đến `https://chat.openai.com` và `https://claude.ai` xem có bị chặn không. Nếu bị chặn → phương án này không khả thi.

### A.5 Kết luận sơ bộ

⚠️ **Rủi ro cao về kỹ thuật.** Cần spike test trước khi commit. Nếu bị chặn → chuyển sang Phương án C.

---

## Phương án B: Hướng dẫn API miễn phí — "Free AI Setup Wizard"

### B.1 Ý tưởng

Thay vì bắt người dùng tự tìm API key, mdview có **wizard hướng dẫn từng bước** để lấy API key miễn phí từ Google AI Studio (Gemini). Mỗi bước có screenshot, link, và copy-paste field.

### B.2 Provider miễn phí khả dụng

| Provider | Model miễn phí | Giới hạn free tier | Cách lấy key |
|----------|---------------|-------------------|--------------|
| **Google AI Studio** | Gemini 2.5 Flash, Gemini 2.5 Pro (thử nghiệm) | 1,500 requests/ngày (Flash), 50/ngày (Pro) | Vào aistudio.google.com → Get API Key → 1 click |
| **Groq** | Llama 4, Mixtral, Gemma... | Rất hào phóng, ~30 req/min | console.groq.com → API Keys → 1 click |
| **OpenRouter** | Nhiều model, có free tier | Giới hạn token/ngày | openrouter.ai → API Keys → 1 click |
| **GitHub Copilot** | Copilot Chat (qua API token) | Có sẵn nếu dùng Copilot | Token từ github.com/settings/tokens |
| **Ollama (local)** | Gemma 3, Llama 4, Mistral... | Không giới hạn (local) | Cài Ollama, pull model |

### B.3 User Flow — "AI Setup Wizard"

```
Lần đầu mở AI tab
    │
    ▼
┌─────────────────────────────────────────────┐
│  🤖 Welcome to AI Assistant                 │
│                                             │
│  Choose how to get started:                 │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 🆓 Get a FREE API key (recommended)   │  │
│  │ We'll guide you step by step          │  │
│  │ Takes ~2 minutes                      │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 🏠 Use local AI (Ollama)              │  │
│  │ Run AI on your computer, free forever │  │
│  │ Needs 8GB+ RAM                        │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 🔑 I already have an API key          │  │
│  │ OpenAI / Anthropic / Google / Other   │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 🌐 Just open ChatGPT in browser       │  │
│  │ Use what you already know             │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

#### Nhánh A: "Get a FREE API key" (Google AI Studio)

```
┌─────────────────────────────────────────────┐
│  Step 1 of 3: Create your API key           │
│                                             │
│  📋 Click the button below to open          │
│  Google AI Studio in your browser.          │
│  Sign in with your Google account.          │
│                                             │
│  [Open Google AI Studio →]                  │
│                                             │
│  ── OR ──                                   │
│                                             │
│  📋 We can also use Groq (even simpler):    │
│  [Open Groq Console →]                      │
│                                             │
│  Once you have the key, paste it below:     │
│  ┌──────────────────────────────────────┐  │
│  │ AIza...                              │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  [Test Connection]                          │
│                                             │
│  When ready, click Next.                    │
│                           [Back]  [Next →]  │
└─────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────┐
│  Step 2 of 3: Choose your model             │
│                                             │
│  These are available with your free key:    │
│                                             │
│  ● Gemini 2.5 Flash                         │
│    Fast, good for everyday use              │
│    ✅ Free: 1,500 requests/day              │
│                                             │
│  ○ Gemini 2.5 Pro (experimental)            │
│    Slower but more thorough                 │
│    ✅ Free: 50 requests/day                 │
│                                             │
│  Advanced: ○ Use another model...           │
│                           [Back]  [Next →]  │
└─────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────┐
│  Step 3 of 3: You're all set!               │
│                                             │
│  ✅ Connected to Gemini 2.5 Flash (free)    │
│                                             │
│  Try it out:                                │
│  ┌──────────────────────────────────────┐  │
│  │ Summarize the current document       │  │
│  └──────────────────────────────────────┘  │
│  [Ask AI →]                                │
│                                             │
│  What you can do:                           │
│  • Chat about your documents                │
│  • Summarize, rewrite, translate            │
│  • Find connections between notes           │
│  • Generate meeting notes from bullet points│
│                                             │
│  💡 Tip: Your API key is stored securely    │
│  on your computer. It never leaves your     │
│  machine except to talk to Google's API.    │
│                                             │
│  [Start Using AI]                           │
└─────────────────────────────────────────────┘
```

#### Nhánh B: "Use local AI (Ollama)"

```
┌─────────────────────────────────────────────┐
│  Step 1 of 3: Install Ollama                │
│                                             │
│  Ollama runs AI models on your computer     │
│  — completely free and private.             │
│                                             │
│  [Download Ollama →]  (ollama.com)           │
│                                             │
│  Already installed? [Check Status]          │
│                                             │
│  System requirements:                       │
│  • 8GB RAM for basic models (Gemma 3)       │
│  • 16GB RAM for powerful models (Llama 4)   │
│  • macOS / Windows / Linux                  │
│                           [Back]  [Next →]  │
└─────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────┐
│  Step 2 of 3: Download a model              │
│                                             │
│  We'll download a recommended model:        │
│                                             │
│  Recommended:                                │
│  ● Gemma 4 12B (~8GB)                │
│    Great for document tasks, fast            │
│    [Download →]  (opens terminal)            │
│                                             │
│  Alternatives:                               │
│  ○ Llama 4 Maverick 17B (~10GB)             │
│    More powerful, needs more RAM             │
│    [Download →]                              │
│                                             │
│  💡 Tip: You can download models later       │
│  from the AI Settings page.                  │
│                                             │
│  Status: ○ Ollama not detected               │
│                           [Back]  [Next →]  │
└─────────────────────────────────────────────┘
```

#### Nhánh C: "I already have an API key"

```
Đơn giản — hiển thị form paste key:

┌─────────────────────────────────────────────┐
│  Connect your AI account                    │
│                                             │
│  Provider: [OpenAI ▼]                       │
│            OpenAI                            │
│            Anthropic                         │
│            Google AI Studio                  │
│            Groq                              │
│            OpenRouter                        │
│            Ollama (local)                    │
│            Other (custom endpoint)           │
│                                             │
│  API Key:                                    │
│  ┌──────────────────────────────────────┐  │
│  │ sk-...                               │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  [Test Connection]                          │
│                           [Cancel]  [Save]  │
└─────────────────────────────────────────────┘
```

#### Nhánh D: "Just open ChatGPT in browser"

```
Không setup gì — mở một panel nhỏ với workflow helper:

┌─────────────────────────────────────────────┐
│  Quick Copy → Web AI → Paste Back           │
│                                             │
│  Current document: requirements/q3.md        │
│                                             │
│  [Copy Full Document]    [Copy Selection]   │
│                                             │
│  Then open:                                  │
│  [Open ChatGPT ↗]   [Open Claude ↗]         │
│  [Open Gemini ↗]    [Custom URL ___ ↗]      │
│                                             │
│  ── After you get the AI response ──        │
│  Paste it here to insert in your document:  │
│  ┌──────────────────────────────────────┐  │
│  │                                      │  │
│  └──────────────────────────────────────┘  │
│  [Insert at Cursor]  [Replace Selection]   │
│                                             │
│  💡 Tip: Want AI to see your document       │
│  automatically? Set up a free API key       │
│  [Setup Free AI →]                          │
└─────────────────────────────────────────────┘
```

### B.4 Đánh giá

| Tiêu chí | Đánh giá |
|----------|----------|
| **Setup effort cho user** | ✅ Wizard giảm xuống ~2 phút |
| **Context injection** | ✅ Hoàn toàn tự động |
| **Chi phí** | ✅ Miễn phí (Google AI Studio free tier rất hào phóng) |
| **Privacy** | ⚠️ Dữ liệu qua Google server (giống ChatGPT web) |
| **Tính khả thi** | ✅ Không có blocker kỹ thuật |
| **Maintenance** | ⚠️ Cần cập nhật nếu Google thay đổi free tier |

---

## Phương án C: "Send to Web AI" — Hybrid đơn giản nhất

### C.1 Ý tưởng

Không nhúng browser, không cần API key. Chỉ là **nút bấm thông minh** giúp workflow copy-paste giữa mdview và ChatGPT/Claude web nhanh hơn:

1. Một nút "Send to AI" → copy nội dung file → mở browser tab ChatGPT
2. Một panel nhỏ "AI Paste Back" → paste kết quả từ web → insert vào editor
3. Lịch sử những lần gửi/nhận gần đây

Đây là phiên bản **không cần setup gì cả** — người dùng vẫn dùng ChatGPT web như cũ, nhưng app hỗ trợ luồng copy-paste.

### C.2 User Flow

```
Người dùng đang edit file q3-scope.md
    │
    ├─ Chọn đoạn văn về "Budget"
    │
    ├─ Click nút "Ask AI About This" (trong toolbar)
    │   │
    │   ▼
    │   ┌──────────────────────────────────────┐
    │   │  Send to Web AI                      │
    │   │                                      │
    │   │  I'll format your text and open      │
    │   │  your AI tool in the browser.        │
    │   │                                      │
    │   │  Prompt:                             │
    │   │  ┌────────────────────────────────┐  │
    │   │  │ Summarize this in 3 bullet     │  │
    │   │  │ points:                        │  │
    │   │  │ ...selected text...             │  │
    │   │  └────────────────────────────────┘  │
    │   │                                      │
    │   │  Open in:                             │
    │   │  [ChatGPT ↗]  [Claude ↗]  [Gemini ↗] │
    │   │                                      │
    │   │  ☐ Remember this prompt template     │
    │   └──────────────────────────────────────┘
    │
    ├─ Browser mở chat.openai.com
    │  (Người dùng Ctrl+V paste — đã có trong clipboard)
    │
    ├─ Người dùng chat, nhận kết quả
    │
    └─ Quay lại mdview → bấm "Paste AI Response"
       │
       ▼
       ┌──────────────────────────────────────┐
       │  Paste AI Response                   │
       │                                      │
       │  ┌────────────────────────────────┐  │
       │  │ (paste kết quả từ ChatGPT)     │  │
       │  └────────────────────────────────┘  │
       │                                      │
       │  [Insert at Cursor]  [Replace]  [Append]
       └──────────────────────────────────────┘
```

### C.3 Prompts Template — Người dùng không cần nghĩ prompt

Một tập hợp prompt mẫu có sẵn, người dùng chỉ cần chọn:

| Prompt Template | Dùng khi |
|----------------|----------|
| "Summarize this in 3 bullet points: {text}" | Tóm tắt nhanh |
| "Extract action items and decisions from: {text}" | Từ meeting notes |
| "Improve the writing clarity and grammar of: {text}" | Soát văn bản |
| "Translate this to [language]: {text}" | Dịch |
| "Rewrite this as an executive summary: {text}" | Báo cáo lên trên |
| "What's missing from this document? {text}" | Review gap |
| "Write a response email based on: {text}" | Trả lời từ note |
| "Create meeting agenda from: {text}" | Chuẩn bị họp |
| "Give me 3 counter-arguments to: {text}" | Phản biện |

### C.4 Đánh giá

| Tiêu chí | Đánh giá |
|----------|----------|
| **Setup effort** | ✅✅ Zero setup |
| **Học curve** | ✅ Không có gì mới |
| **Context injection** | ⚠️ Bán tự động (copy-paste) |
| **Tính khả thi** | ✅ Không blocker nào |
| **User satisfaction** | ⚠️ Vẫn còn bước copy-paste |
| **Giữ chân trong app** | ❌ Người dùng rời app sang browser |

---

## Phương án D: Local AI (Ollama) — Đã phân tích trong v2.0.0

Không phân tích lại. Điểm khác biệt chính:
- ✅ Free forever, privacy tuyệt đối
- ❌ Cần cài đặt, cần RAM 8GB+
- ❌ Không mạnh bằng cloud model

---

## Phân tích tổng hợp: Nên chọn phương án nào?

### Ma trận so sánh

| | A: Embedded Browser | B: Free API Wizard | C: Send to Web AI | D: Local Ollama |
|---|---|---|---|---|
| **Zero setup** | ✅ | ❌ Cần 2 phút | ✅ | ❌ Cần cài đặt |
| **Context tự động** | ❌ | ✅ | ❌ (copy-paste) | ✅ |
| **Miễn phí** | ✅ (web free) | ✅ (free tier) | ✅ (web free) | ✅ |
| **Không rời app** | ✅ | ✅ | ❌ Rời app | ✅ |
| **Tính khả thi KT** | ⚠️ Có thể bị chặn | ✅ | ✅ | ✅ |
| **Quality of AI** | ⚠️ Web = chat thủ công | ✅ Streaming inline | ⚠️ Web = chat thủ công | ⚠️ Local model yếu hơn |
| **Privacy** | ⚠️ Data lên web | ⚠️ Data lên API | ⚠️ Data lên web | ✅ Local |
| **Tích hợp sâu** | ❌ | ✅ Inline edit, etc. | ❌ | ✅ |

### Khuyến nghị: Phased Rollout

**Không chọn một — chọn tất cả theo thứ tự ưu tiên người dùng:**

```
┌──────────────────────────────────────────────────────┐
│                    AI ONBOARDING                     │
│                                                      │
│  Tier 0: "Send to Web AI" (C)                        │
│  ───────────────────────────                         │
│  Zero setup. Người dùng bấm nút → copy →             │
│  browser tự mở ChatGPT. Paste kết quả về.            │
│  LUÔN LUÔN HOẠT ĐỘNG — fallback cho mọi user.       │
│                                                      │
│  Tier 1: "Free API Setup Wizard" (B)                 │
│  ────────────────────────────────                    │
│  Guided 3-step wizard → Google AI Studio.            │
│  Sau khi setup: full AI integration (chat,            │
│  inline edit, context-aware).                        │
│                                                      │
│  Tier 2: "Local AI" (D)                               │
│  ────────────────────                                │
│  Ollama setup guide. Cho user muốn privacy           │
│  hoặc làm việc offline.                              │
│                                                      │
│  Tier 3: "Embedded Browser" (A) — Research           │
│  ────────────────────────────────────                │
│  Spike test technical feasibility. Nếu khả           │
│  thi → embed ChatGPT/Claude trong panel.             │
│  Nếu không → giữ nguyên Tier 0.                      │
└──────────────────────────────────────────────────────┘
```

### WHY TIER 0 FIRST?

Tier 0 là **không thể thất bại**:
- Không cần backend mới (chỉ cần `tauri-plugin-opener` để mở browser — đã có)
- Không cần API key, không cần setup
- Người dùng BA/CEO đã quen ChatGPT web → không phải học gì mới
- Chỉ thêm 2 component nhỏ: prompt template picker + paste-back panel
- Effort: ~1 ngày
- Giá trị: Có ngay, mọi user dùng được

Tier 1 là **giá trị thật sự** — AI context-aware, inline edit. Nhưng cần user chịu dành 2 phút setup.

### Điều chỉnh v2.0.0 scope

Dựa trên phân tích này, đề xuất điều chỉnh Pillar B (AI) của v2.0.0:

| Priority gốc | Priority mới | Story | Lý do |
|---|---|---|---|
| S-AI1 (Rust providers) | 🔴 Giữ nguyên | Core AI infra cho Tier 1 | Cần cho full AI |
| S-AI7 (Settings) | 🔴 Giữ nguyên | Settings cho Tier 1 + 2 | Cấu hình provider |
| S-AI2 (ai.ts store) | 🔴 Giữ nguyên | Core state | |
| **S-AI0 (NEW)** | 🔴 Thêm mới | "Send to Web AI" — Tier 0 | Zero setup, fallback |
| S-AI3 (ChatPanel) | 🔴 Giữ nguyên | Tier 1 experience | |
| S-AI4 (Sidebar tab) | 🔴 Giữ nguyên | | |
| S-AI5 (Inline AI) | 🟠 Giữ nguyên | Tier 1 | |
| S-AI6 (Quick AI) | 🟡 Giữ nguyên | | |
| S-AI8 (Graph insights) | 🟢 Giữ nguyên | | |

---

## Phụ lục: Các provider miễn phí — chi tiết kỹ thuật

### Google AI Studio (Gemini)

```
Endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent
Method: POST
Auth: x-goog-api-key header (hoặc ?key= query param)

Free tier (as of 2026-05):
- Gemini 2.5 Flash: 1,500 RPM, 1 triệu token/phút
- Gemini 2.5 Pro: 50 RPM, Limited (experimental)
- Context: Lên đến 1M token (Flash)

Cách lấy key:
  1. Vào https://aistudio.google.com
  2. Đăng nhập Google account
  3. Menu → Get API Key → Create API Key
  4. Copy key (dạng AIza...)

Lưu ý: Key này là free, Google có thể thu thập dữ liệu để cải thiện dịch vụ.
Để production use, cần trả phí qua Google Cloud Vertex AI.
```

### Groq

```
Endpoint: https://api.groq.com/openai/v1/chat/completions
Method: POST (OpenAI-compatible format)
Auth: Bearer {api_key}

Free tier:
- Tốc độ inference rất nhanh (GPU LPU)
- Miễn phí generous, giới hạn theo rate
- Models: Llama 4, Mixtral, Gemma...

Cách lấy key:
  1. Vào https://console.groq.com
  2. Sign up (email hoặc Google/GitHub)
  3. API Keys → Create API Key
  4. Copy key (dạng gsk_...)
```

### Ollama (Local)

```
Endpoint: http://localhost:11434/api/chat
Method: POST (OpenAI-compatible với /v1/chat/completions)
Auth: None (local)

Models phù hợp văn bản:
- gemma4:12b      (~8GB RAM)  — Google, tốt cho tasks
- llama4-maverick:17b (~10GB) — Meta, rất mạnh
- mistral:7b       (~4GB RAM)  — Nhẹ, nhanh
- phi4:14b         (~8GB RAM)  — Microsoft

Cách cài:
  1. Vào https://ollama.com → Download
  2. Mở terminal: ollama pull gemma4:12b
  3. Ready — mdview tự kết nối
```

---

## Phụ lục: UX Pattern — Prompt Template Library

Một ý tưởng bổ sung: thay vì để user tự nghĩ prompt, mdview có sẵn "prompt template library" — bộ sưu tập prompt mẫu cho BA/CEO.

### Giao diện Prompt Picker

```
┌──────────────────────────────────────────────┐
│  AI Prompt Templates                         │
│                                              │
│  🔍 Filter templates...                      │
│                                              │
│  📝 Write & Edit                             │
│  ├─ Improve clarity & grammar                │
│  ├─ Expand bullet points to prose            │
│  ├─ Shorten to key points                    │
│  ├─ Change tone: formal / casual / executive │
│  └─ Fix spelling & punctuation               │
│                                              │
│  📊 Analyze                                   │
│  ├─ Summarize this document                  │
│  ├─ Extract action items & decisions         │
│  ├─ Identify risks & assumptions             │
│  ├─ Find missing information                 │
│  └─ Generate table of contents               │
│                                              │
│  📋 Generate                                 │
│  ├─ Meeting agenda from notes                │
│  ├─ Meeting minutes from bullet points       │
│  ├─ Executive summary                        │
│  ├─ Project status update                    │
│  ├─ FAQ from document                        │
│  └─ Email response from notes                │
│                                              │
│  🔗 Connect                                  │
│  ├─ Find related documents (with Graph)      │
│  ├─ Compare this with {another_file}         │
│  └─ Identify contradictions between docs     │
│                                              │
│  🌐 Translate                                │
│  ├─ English → Vietnamese                     │
│  ├─ Vietnamese → English                     │
│  └─ To: [language]                           │
│                                              │
│  ✏️ Custom prompts                           │
│  └─ [+ Add your own prompt template]         │
└──────────────────────────────────────────────┘
```

Mỗi template có placeholder `{text}` hoặc `{file}` được tự động điền khi chọn.

### Lưu trữ & chia sẻ

- Template lưu trong `mdview-settings.json` (custom của user)
- Export/Import template library (JSON) — chia sẻ giữa team
- Default library: 20 templates built-in cho BA/CEO

---

## Tổng kết khuyến nghị

| Hạng mục | Đề xuất |
|----------|---------|
| **Lối vào cho BA/CEO** | Tier 0: "Send to Web AI" — zero setup, luôn hoạt động |
| **Upgrade path** | Tier 1: "Free API Wizard" — 2 phút setup, full AI integration |
| **Power user** | Tier 2: Ollama local — privacy, offline |
| **Embedded browser** | ⚠️ Spiketest trước, khả năng cao bị chặn → fallback Tier 0 |
| **Prompt templates** | Built-in library với 20+ templates cho BA/CEO workflows |
| **Thứ tự code** | S-AI0 (Web AI) → S-AI1 (providers) → S-AI7 (settings) → S-AI2 (store) → S-AI3 (chat) → S-AI5 (inline) |
