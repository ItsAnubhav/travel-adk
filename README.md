# ADK Travel Agents

Google ADK Python scaffold using OpenAI `gpt-5-mini` through ADK's LiteLLM wrapper, FastAPI streaming, React custom tool UIs, and Postgres-backed ADK sessions.

## Run locally

```bash
cp .env.example .env
docker compose up -d postgres
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Architecture

- `app/agents`: ADK agents and multi-agent routing.
- `app/tools`: typed tool wrappers around Travog services.
- `app/api`: FastAPI routes for streaming, sessions, and large UI payload retrieval.
- `app/ui_artifacts`: server-side payload store for large tool results.
- `app/services`: your Travog API service package, copied under `app` to match existing imports.
- `frontend`: React UI with custom renderers for large tool payloads such as flight search.

Large tools return a compact envelope like `{"ui_component": "flight_search_results", "artifact_id": "...", "ui_display": "chat"}`. Set `ui_display` to `split_view` to open the artifact beside the chat; omit it or use `chat` to render inline. The React app fetches the raw 8-10 MB payload from the backend only when it needs to render that component.
