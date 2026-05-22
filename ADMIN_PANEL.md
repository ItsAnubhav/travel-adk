# Admin Panel

The admin panel gives operators a real-time bird's-eye view of chat activity, agents, tools, and control-plane state.

## What It Shows

- Agents currently running in active chat sessions
- Tools currently running
- Users currently online
- Active chat sessions
- Total model tokens used
- Registered agents
- Registered tools
- Recent tool invocations
- Recent admin control changes

The frontend receives dashboard updates through a websocket, so session and tool activity can update without refreshing the page.

## Local URLs

Backend:

```bash
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm run dev
```

Open the frontend URL, then click **Admin** in the left rail.

## Backend Endpoints

REST endpoints:

```text
GET    /api/admin/dashboard
GET    /api/admin/agents
PATCH  /api/admin/agents/{agent_id}
GET    /api/admin/tools
POST   /api/admin/tools
PATCH  /api/admin/tools/{tool_id}
```

Realtime websocket:

```text
WS /api/admin/dashboard/ws
```

The websocket sends payloads shaped like:

```json
{
  "type": "snapshot",
  "data": {
    "metrics": {},
    "agents": [],
    "tools": [],
    "sessions": [],
    "tool_invocations": [],
    "audit_log": []
  }
}
```

## Database Tables

The control plane initializes these tables on FastAPI startup:

```text
admin_agents
admin_tools
admin_audit_logs
```

Use the database for metadata and admin-controlled state:

- Agent/tool name and description
- Enabled, disabled, or maintenance status
- Tool kind: builtin, MCP, API, or function
- Runtime config JSON
- Secret references
- Audit history

Do not store executable tool code or raw secrets in these tables. Store code in the application/repo and store secrets in a secret manager; the DB should hold only references.

## Admin Controls

Admins can:

- Enable or disable agents
- Enable or disable tools
- Add a new MCP or API tool registry entry
- Review active sessions and recent tool runs

New tools are created as disabled by default. This lets an admin register config first, validate it, and only then enable it.

API tools can be registered from a pasted curl command. The backend parses method, URL, query params, headers, payload, timeout flags, and auth type into structured config.

Example tool creation body:

```json
{
  "id": "currency_rates",
  "name": "Currency Rates",
  "description": "Fetches current exchange rates from an approved API.",
  "kind": "api",
  "curl_command": "curl -X GET 'https://example.internal/rates?base=USD' -H 'Authorization: Bearer $TOKEN'",
  "config": {
    "timeout_ms": 5000
  },
  "auth_secret_ref": "secret://travel/currency-rates"
}
```

The parsed config is stored on the tool record with fields such as:

```json
{
  "source": "curl",
  "method": "GET",
  "url": "https://example.internal/rates?base=USD",
  "headers": {
    "Authorization": "Bearer $TOKEN"
  },
  "query_params": {
    "base": "USD"
  },
  "payload": null,
  "auth": {
    "type": "bearer",
    "token_present": true
  },
  "timeout_ms": 5000
}
```

Keep real tokens out of pasted curl commands when possible. Use placeholders in curl and put the secret-manager pointer in `auth_secret_ref`.

## Runtime Tracking

Chat streams report lifecycle events into the control plane:

- Session started
- Session ended or failed
- Tool call started
- Tool response succeeded or failed
- Model token usage when the provider emits usage metadata

The dashboard keeps live runtime counters in memory and publishes snapshots to connected websocket clients. Durable registry state lives in Postgres.

Token counters use provider-reported usage metadata, including prompt, completion, and total token fields when present. If a model/provider does not emit token usage in stream events, the dashboard leaves that session at zero instead of estimating.

## Chat History

User-visible chat history is stored separately from the ADK runtime session tables:

```text
chat_history_sessions
chat_history_messages
```

The chat history tables store:

- User-visible session metadata
- User messages
- Final assistant messages
- Tool calls
- Tool responses
- UI artifact references
- Token totals when available

History endpoints:

```text
GET /api/chat/sessions?user_id={user_id}
GET /api/chat/sessions/{session_id}?user_id={user_id}
```

The frontend shows recent sessions in the left rail. Opening an old session restores the transcript and keeps the original `session_id`, so the next user message continues the existing ADK session instead of starting over.

## Current Limitation

The admin registry controls whether a known agent can be used by chat. Tool status is tracked and exposed in the dashboard, but the ADK tool runtime still needs a deeper enforcement hook if you want disabled tools to be completely blocked before invocation. Treat the current tool control as the registry/UI foundation for that next enforcement layer.

## Security Notes

Adding MCP and API tools is powerful. Before this is exposed beyond local development, add:

- Admin authentication
- Role-based access control
- Audit review workflows
- MCP/API allowlists
- Network egress restrictions
- Rate limits
- Secret-manager integration
- Tool config validation
