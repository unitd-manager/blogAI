# SignalWrite — AI blog writing studio

A React + Vite frontend with an Express API, MySQL persistence, and a LangGraph article-writing flow. The workflow analyzes a public website and its existing articles, suggests topics with one primary and up to four related keyword ideas, drafts a useful article using those terms naturally, and saves it for review.

## Start locally

1. Install Node.js 20+ and start a local MySQL server (MySQL 5.7+ is supported; WampServer's bundled MySQL works).
2. Copy `.env.example` to `.env` and enter MySQL credentials. `AI_MODE=free` uses website headings and preview drafts without AI calls. To generate articles locally without API billing, install Ollama and the configured local model, then set `AI_MODE=ollama`. Alternatively set `AI_MODE=openai` and add `OPENAI_API_KEY` to use the paid API. Add `TAVILY_API_KEY` for external web research.
3. Run `npm install`, then `npm run dev`.
4. Open the Vite URL shown in the terminal. The API runs on port 4000.

In free mode, the app extracts starter topics from readable website headings and creates a clearly labeled preview draft; it does not make AI requests. In AI mode without a Tavily key, suggestions use website pages only. Tavily adds current web search sources, but it does not provide keyword volume or difficulty in this workflow; those fields are never fabricated. Keyword suggestions are inferred from the site and available evidence; they are not search-volume data. There is no fixed keyword density target, and the app avoids forcing repetitions. Article saves require a reachable MySQL server.

## What's included

- Website URL analysis and editorial topic suggestions.
- Multi-page public website crawl with SSRF protections and source-linked web research through optional Tavily.
- Article source list, inline source IDs, and an AI evidence review that flags unsupported claims for human review.
- Topic selection with one primary keyword and up to four related keyword suggestions per topic.
- Article-level keyword checks for title, opening, section headings, and natural phrase coverage.
- Markdown editor, draft saving, article library, and an editorial SEO checklist.
- LangGraph outline-to-draft-to-evidence-review flow with a local preview fallback.
- MySQL tables for projects and articles.

## API

- `GET /api/health`
- `POST /api/analyze` — `{ "url": "https://example.com", "existingBlogs": "..." }`; returns website and web-search sources plus topic ideas, without invented volume/difficulty.
- `GET /api/articles`
- `POST /api/articles` — `{ "topic": "...", "keyword": "...", "relatedKeywords": [...], "context": "...", "sources": [...] }`
- `PATCH /api/articles/:id` — `{ "title": "...", "content": "...", "status": "Draft" }`

