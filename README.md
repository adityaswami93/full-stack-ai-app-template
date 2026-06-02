# Full-Stack AI App Template

A reusable full-stack AI app template built with FastAPI, Next.js, and Supabase.

## Stack

- **Frontend** — Next.js 16, TypeScript, Tailwind CSS
- **Backend** — Python FastAPI
- **Database** — PostgreSQL + pgvector via Supabase
- **Auth** — Supabase Auth
- **LLMs** — OpenRouter (chat/completions) + OpenAI (embeddings)
- **Email** — Resend
- **Ingestion** — Example NewsAPI ingestion pipeline

## Architecture

```text
User → Next.js Frontend → FastAPI Backend → Supabase (pgvector)
                                          → LLM provider(s)
                                          → Embedding provider(s)
                                          → Optional email + ingestion services
```

## Quick Start

### 1. Clone

```bash
git clone https://github.com/<your-org>/full-stack-ai-app-template.git
cd full-stack-ai-app-template
```

### 2. Backend setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example.yaml .env
# Fill in your .env values
uvicorn api.main:app --reload
```

### 3. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env.local
# Fill in your .env.local values
npm run dev
```

### 4. Database setup

1. Create a Supabase project.
2. Run `backend/migrations/001_initial.sql` in Supabase SQL Editor.
3. Enable the `vector` extension.

### 5. Optional seed/ingestion

```bash
curl -X POST http://localhost:8000/ingest
```

## Key Template Features

- Retrieval-Augmented Generation (RAG) pipeline
- Embedding + vector search flow
- Scheduled digest/email agent examples
- Auth-ready frontend/backend structure
- Dockerfiles and deployment-ready layout for frontend + backend

## Project Structure

```text
full-stack-ai-app-template/
├── backend/
│   ├── api/
│   ├── agents/
│   ├── db/
│   ├── ingestion/
│   ├── migrations/
│   ├── pipelines/
│   ├── services/
│   └── requirements.txt
├── frontend/
│   ├── app/
│   ├── lib/
│   └── package.json
└── README.md
```

## Customizing This Template

To adapt this template for your domain:

1. Replace ingestion sources (`backend/ingestion/`).
2. Update retrieval and prompt logic (`backend/pipelines/rag_pipeline.py`).
3. Customize agent behavior (`backend/agents/`).
4. Update frontend routes/components and branding (`frontend/app/`).