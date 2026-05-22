# ADK Travel Agent Architecture

## Overview

This app is a FastAPI + Google ADK travel assistant with React on the frontend and Postgres-backed ADK sessions. The core runtime is organized around four agents:

- `TravelOrchestrator` routes requests to specialist agents.
- `FlightAgent` gathers flight requirements.
- `ExpenseAgent` handles trips, expense reports, approvals, and expense creation/update.
- `BookingAgent` handles booking details and fare rules.

The frontend streams chat requests to `/api/chat/stream`. The backend creates or reuses an ADK session, loads auth and personalization context into session state, then runs the selected ADK agent.

## Request And Session Flow

1. Frontend reads URL/session values:
   - `access_token` or `token`
   - `refresh_token`
   - `user_id`
   - optional `user_profile` JSON
   - optional profile fields: `name`, `email`, `company_id`, `client_id`

2. Frontend sends chat payload:

```json
{
  "message": "show my open trips",
  "agent": "expense",
  "user_id": "stable-user-id",
  "session_id": "optional-existing-session",
  "context": {
    "access_token": "...",
    "refresh_token": "...",
    "user_profile": {
      "name": "Ada",
      "email": "ada@example.com"
    }
  }
}
```

3. Backend `/api/chat/stream`:
   - ensures an ADK database session exists
   - stores auth tokens in session state
   - upserts `user_profile`
   - loads active preferences
   - stores `user_id`, profile, and preferences in ADK session state
   - prepends compact private personalization context to the user message
   - streams ADK events back as SSE

4. After the run finishes, the session is persisted to ADK database memory.

## Personalization Logic

Personalization is implemented in `app/core/personalization.py`.

The DB layer lazily creates two tables:

### `user_profiles`

Stores the latest profile object received from the frontend.

Important fields:

- `user_id`
- `profile_json`
- `source`
- `created_at`
- `updated_at`

### `user_preferences`

Stores learned preferences with a confirmation lifecycle.

Important fields:

- `id`
- `user_id`
- `category`
- `key`
- `value_json`
- `confidence`
- `status`: `pending`, `active`, or `rejected`
- `source`
- `source_text`
- timestamps

Only `active` preferences are injected into agent context. New preferences suggested by agents are saved as `pending` until confirmed through API.

## Personalization APIs

Defined in `app/api/personalization.py`.

```text
GET  /api/personalization/preferences/pending?user_id=...
POST /api/personalization/preferences/{preference_id}/accept?user_id=...
POST /api/personalization/preferences/{preference_id}/reject?user_id=...
```

These endpoints are ready for future UI accept/reject buttons.

## Personalization Tools

Defined in `app/tools/personalization_tools.py`.

### `get_user_preferences`

Returns active preferences for the current ADK `user_id`.

### `suggest_user_preference`

Creates a pending preference suggestion. Agents use this when the user expresses a durable travel preference, for example:

- preferred airline
- seat preference
- meal preference
- currency
- home airport
- hotel style
- budget patterns
- approver workflow habits

Agents must not claim the preference is saved permanently until it is accepted.

## Agent Orchestration

Defined in `app/agents/root.py`.

`TravelOrchestrator` is the root agent. It routes work to:

- `FlightAgent` for flight requirement gathering
- `ExpenseAgent` for trips and expense workflows
- `BookingAgent` for booking details and fare rules

The root agent also has personalization tools so it can inspect preferences or suggest new ones before routing.

## Specialist Agents

### ExpenseAgent

Defined in `app/agents/expense_agent.py`.

Tools include:

- `get_user_preferences`
- `suggest_user_preference`
- `list_trip`
- `get_trip_approvers`
- `send_trip_for_approval`
- `list_expenses`
- `get_expense_settings`
- `create_expense`
- `update_expense`

Expense and trip APIs are split into domain services:

- `TravogExpenseService`
- `TravogTripService`
- `TravogAuthService`

### BookingAgent

Defined in `app/agents/booking_agent.py`.

Tools include:

- `get_user_preferences`
- `suggest_user_preference`
- `get_booking`
- `get_fare_rules`
- `get_cancellation_policy`
- `get_reissue_policy`

Live Forge booking APIs are implemented in `TravogBookingService`.

### FlightAgent

Defined in `app/agents/flight_agent.py`.

Flight live-search APIs are not wired yet. The agent can still gather requirements and use active personalization to tailor questions.

## Auth Context

The frontend supplies Travog auth tokens. Backend stores them in ADK session state:

- `travog_access_token`
- `travog_refresh_token`

Travog tools read these tokens from `ToolContext.state`, so the user does not need to paste credentials during chat.

Token refresh behavior is centralized in `TravogAuthService.execute_with_retry`. Domain services reuse it for 401 retry flows.

## Large Tool Payloads

Large API payloads are not sent directly through the LLM response.

Tool wrappers store large responses in `app/ui_artifacts/store.py` and return compact metadata:

```json
{
  "ui_component": "booking_details",
  "artifact_id": "...",
  "ui_display": "chat"
}
```

The frontend renders these artifacts through `ArtifactRenderer`. Use `ui_display: "split_view"` to open the artifact beside the chat instead of inline.

## Local DB Inspection

`docker-compose.yml` includes Postgres and pgAdmin.

Start both:

```bash
docker compose up -d postgres pgadmin
```

Open pgAdmin:

```text
http://localhost:5050
```

Login:

```text
Email: admin@example.com
Password: admin
```

Register server:

```text
Host: postgres
Port: 5432
Database: adk_travel
Username: adk
Password: adk_password
```

Useful personalization tables:

- `user_profiles`
- `user_preferences`

## Safety Rules

- Never inject access tokens, refresh tokens, passwords, or secrets into agent prompt context.
- Personalization context should be compact and private.
- Agents can suggest preferences automatically, but v1 does not auto-activate them.
- Only active preferences should influence future behavior.
- Large tool payloads should stay outside direct LLM messages.
