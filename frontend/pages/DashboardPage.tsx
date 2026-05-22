import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  Globe2,
  PlugZap,
  Plus,
  Power,
  RefreshCw,
  Search,
  ServerCog,
  Shield,
  Wrench,
} from 'lucide-react';
import { apiService } from '../services/api';
import { AdminRecord, AdminSnapshot } from '../types';

const emptySnapshot: AdminSnapshot = {
  metrics: {
    agents_running: 0,
    tools_running: 0,
    users_online: 0,
    active_sessions: 0,
    registered_agents: 0,
    registered_tools: 0,
    total_tokens: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
  },
  agents: [],
  tools: [],
  sessions: [],
  tool_invocations: [],
  audit_log: [],
};

type NewToolKind = 'api' | 'mcp';

const DashboardPage: React.FC = () => {
  const [snapshot, setSnapshot] = useState<AdminSnapshot>(emptySnapshot);
  const [query, setQuery] = useState('');
  const [toolSaving, setToolSaving] = useState<Record<string, boolean>>({});
  const [globalSaving, setGlobalSaving] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newTool, setNewTool] = useState({
    id: '',
    name: '',
    kind: 'api' as NewToolKind,
    description: '',
    curl_command: '',
    mcp_server: '',
    auth_secret_ref: '',
  });

  const refreshSnapshot = async () => {
    const next = await apiService.fetchAdminSnapshot();
    if (next) setSnapshot(next);
  };

  useEffect(() => {
    let cancelled = false;
    refreshSnapshot();
    const socket = apiService.connectAdminDashboard((next) => {
      if (!cancelled) setSnapshot(next);
    });
    socket.addEventListener('open', () => !cancelled && setWsConnected(true));
    socket.addEventListener('close', () => !cancelled && setWsConnected(false));
    socket.addEventListener('error', () => !cancelled && setWsConnected(false));
    return () => {
      cancelled = true;
      socket.close();
    };
  }, []);

  const filteredTools = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return snapshot.tools;
    return snapshot.tools.filter((tool) =>
      [tool.id, tool.name, tool.description, tool.kind, tool.status].some((value) =>
        String(value || '').toLowerCase().includes(needle),
      ),
    );
  }, [snapshot.tools, query]);

  const activeSessions = snapshot.sessions.filter((session) => session.status === 'active');
  const runningCalls = snapshot.tool_invocations.filter((call) => call.status === 'running');
  const enabledToolCount = snapshot.tools.filter((tool) => tool.status === 'enabled').length;
  const allToolsEnabled = snapshot.tools.length > 0 && enabledToolCount === snapshot.tools.length;

  const toggleTool = async (tool: AdminRecord) => {
    const nextStatus = tool.status === 'enabled' ? 'disabled' : 'enabled';
    setToolSaving((current) => ({ ...current, [tool.id]: true }));
    setMessage(null);
    const ok = await apiService.updateToolStatus(tool.id, nextStatus);
    if (!ok) setMessage(`Could not ${nextStatus === 'enabled' ? 'enable' : 'disable'} ${tool.name}.`);
    await refreshSnapshot();
    setToolSaving((current) => ({ ...current, [tool.id]: false }));
  };

  const toggleAllTools = async () => {
    const nextStatus = allToolsEnabled ? 'disabled' : 'enabled';
    setGlobalSaving(true);
    setMessage(null);
    const results = await Promise.all(snapshot.tools.map((tool) => apiService.updateToolStatus(tool.id, nextStatus)));
    if (results.some((ok) => !ok)) setMessage('Some tools could not be updated.');
    await refreshSnapshot();
    setGlobalSaving(false);
  };

  const createTool = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    const id = newTool.id.trim();
    const name = newTool.name.trim();
    if (!id || !name) {
      setMessage('Tool id and name are required.');
      return;
    }

    const config =
      newTool.kind === 'mcp'
        ? { server: newTool.mcp_server.trim() }
        : {};
    const result = await apiService.createTool({
      id,
      name,
      kind: newTool.kind,
      description: newTool.description.trim(),
      curl_command: newTool.kind === 'api' ? newTool.curl_command.trim() || null : null,
      config,
      auth_secret_ref: newTool.auth_secret_ref.trim() || null,
    });
    if (!result.ok) {
      setMessage(result.message || 'Tool creation failed.');
      return;
    }
    setNewTool({
      id: '',
      name: '',
      kind: newTool.kind,
      description: '',
      curl_command: '',
      mcp_server: '',
      auth_secret_ref: '',
    });
    setMessage('Tool added in disabled mode. Enable it when it is ready.');
    await refreshSnapshot();
  };

  return (
    <div className="dashboard-root">
      <style>{dashboardStyles}</style>
      <header className="dash-top">
        <div>
          <p className="eyebrow">Control Plane</p>
          <h1>Dashboard</h1>
        </div>
        <div className="top-actions">
          <span className={`live-chip ${wsConnected ? 'on' : ''}`}>
            <Activity size={14} />
            {wsConnected ? 'Live' : 'Polling'}
          </span>
          <button className="icon-btn" onClick={refreshSnapshot} title="Refresh dashboard">
            <RefreshCw size={17} />
          </button>
        </div>
      </header>

      {message && (
        <div className="notice">
          <AlertCircle size={16} />
          {message}
        </div>
      )}

      <section className="metric-grid">
        <Metric icon={<Activity />} label="Active sessions" value={activeSessions.length} detail={`${snapshot.metrics.users_online} users online`} />
        <Metric icon={<PlugZap />} label="Running calls" value={runningCalls.length} detail={`${snapshot.tool_invocations.length} recent calls`} />
        <Metric icon={<Wrench />} label="Enabled tools" value={`${enabledToolCount}/${snapshot.tools.length}`} detail={`${snapshot.metrics.registered_tools} registered`} />
        <Metric icon={<DatabaseZap />} label="Tokens" value={snapshot.metrics.total_tokens.toLocaleString()} detail={`${snapshot.metrics.prompt_tokens.toLocaleString()} prompt`} />
      </section>

      <main className="dash-layout">
        <section className="panel sessions-panel">
          <div className="panel-head">
            <div>
              <h2>Active Sessions</h2>
              <p>Recent control-plane sessions and token totals.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>User</th>
                  <th>Agent</th>
                  <th>Last seen</th>
                  <th>Tokens</th>
                </tr>
              </thead>
              <tbody>
                {activeSessions.length ? activeSessions.map((session) => (
                  <tr key={session.id}>
                    <td><code>{shortId(session.id)}</code></td>
                    <td>{session.user_id}</td>
                    <td><span className="pill">{session.agent_id}</span></td>
                    <td>{formatTime(session.last_seen_at)}</td>
                    <td>{session.total_tokens.toLocaleString()}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} className="empty-cell">No active sessions.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel calls-panel">
          <div className="panel-head">
            <div>
              <h2>Tool Calls</h2>
              <p>Latest invocations across all sessions.</p>
            </div>
          </div>
          <div className="call-list">
            {snapshot.tool_invocations.length ? snapshot.tool_invocations.map((call) => (
              <div className="call-row" key={call.id}>
                {statusIcon(call.status)}
                <div>
                  <strong>{call.tool_id}</strong>
                  <span>{shortId(call.session_id)} · {formatTime(call.started_at)}</span>
                </div>
                <em>{call.latency_ms ? `${call.latency_ms} ms` : call.status}</em>
              </div>
            )) : (
              <div className="empty-state">No tool calls recorded yet.</div>
            )}
          </div>
        </section>

        <section className="panel tools-panel">
          <div className="panel-head">
            <div>
              <h2>Global Tools</h2>
              <p>Enable or disable tool availability for every session.</p>
            </div>
            <button className="primary-action" onClick={toggleAllTools} disabled={globalSaving || snapshot.tools.length === 0}>
              <Power size={16} />
              {allToolsEnabled ? 'Disable all' : 'Enable all'}
            </button>
          </div>
          <label className="search-box">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools" />
          </label>
          <div className="tool-grid">
            {filteredTools.map((tool) => {
              const enabled = tool.status === 'enabled';
              return (
                <article className={`tool-card ${enabled ? 'enabled' : ''}`} key={tool.id}>
                  <div className="tool-main">
                    <span className="tool-icon">{tool.kind === 'api' ? <Globe2 size={18} /> : tool.kind === 'mcp' ? <ServerCog size={18} /> : <Wrench size={18} />}</span>
                    <div>
                      <strong>{tool.name}</strong>
                      <p>{tool.description || tool.id}</p>
                    </div>
                  </div>
                  <div className="tool-foot">
                    <span className="kind">{tool.kind || 'builtin'}</span>
                    <button className={`switch ${enabled ? 'on' : ''}`} onClick={() => toggleTool(tool)} disabled={toolSaving[tool.id]}>
                      <span />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="panel add-panel">
          <div className="panel-head">
            <div>
              <h2>Add New Tool</h2>
              <p>Register API or MCP tools in disabled mode.</p>
            </div>
          </div>
          <form className="tool-form" onSubmit={createTool}>
            <div className="segmented">
              <button type="button" className={newTool.kind === 'api' ? 'active' : ''} onClick={() => setNewTool((current) => ({ ...current, kind: 'api' }))}>
                <Globe2 size={15} /> API
              </button>
              <button type="button" className={newTool.kind === 'mcp' ? 'active' : ''} onClick={() => setNewTool((current) => ({ ...current, kind: 'mcp' }))}>
                <ServerCog size={15} /> MCP
              </button>
            </div>
            <label>Tool id<input value={newTool.id} onChange={(event) => setNewTool((current) => ({ ...current, id: event.target.value }))} placeholder="company.search_flights" /></label>
            <label>Name<input value={newTool.name} onChange={(event) => setNewTool((current) => ({ ...current, name: event.target.value }))} placeholder="Search Flights" /></label>
            <label>Description<textarea rows={3} value={newTool.description} onChange={(event) => setNewTool((current) => ({ ...current, description: event.target.value }))} /></label>
            {newTool.kind === 'api' ? (
              <label>cURL command<textarea rows={5} value={newTool.curl_command} onChange={(event) => setNewTool((current) => ({ ...current, curl_command: event.target.value }))} placeholder="curl -X POST https://api.example.com/search ..." /></label>
            ) : (
              <label>MCP server<input value={newTool.mcp_server} onChange={(event) => setNewTool((current) => ({ ...current, mcp_server: event.target.value }))} placeholder="filesystem or https://mcp.example.com" /></label>
            )}
            <label>Auth secret ref<input value={newTool.auth_secret_ref} onChange={(event) => setNewTool((current) => ({ ...current, auth_secret_ref: event.target.value }))} placeholder="optional-secret-name" /></label>
            <button className="submit-tool" type="submit"><Plus size={16} /> Add tool</button>
          </form>
        </section>
      </main>
    </div>
  );
};

const Metric = ({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: React.ReactNode; detail: string }) => (
  <article className="metric-card">
    <span>{icon}</span>
    <div>
      <p>{label}</p>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  </article>
);

const shortId = (value: string) => (value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value);

const formatTime = (value?: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const statusIcon = (status: string) => {
  if (status === 'success') return <CheckCircle2 className="status-icon ok" size={18} />;
  if (status === 'failed') return <AlertCircle className="status-icon bad" size={18} />;
  return <Clock3 className="status-icon run" size={18} />;
};

const dashboardStyles = `
.dashboard-root {
  height: 100vh;
  overflow-y: auto;
  background: #f5f7f4;
  color: #17201a;
  padding: 28px;
  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.dash-top, .panel-head, .top-actions, .metric-card, .tool-main, .tool-foot, .call-row, .notice, .search-box, .segmented {
  display: flex;
  align-items: center;
}
.dash-top {
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 18px;
}
.eyebrow {
  margin: 0 0 4px;
  color: #6b765f;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
}
h1, h2, p { margin: 0; }
h1 { font-size: 34px; line-height: 1; letter-spacing: 0; }
h2 { font-size: 16px; }
.top-actions { gap: 10px; }
.live-chip, .icon-btn, .primary-action, .submit-tool {
  border: 1px solid #d9dfd1;
  background: #fffdfa;
  color: #243027;
  border-radius: 8px;
}
.live-chip {
  gap: 7px;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 700;
}
.live-chip.on { color: #0f7a43; border-color: #9dd7b3; background: #effbf3; }
.icon-btn {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.notice {
  gap: 9px;
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 8px;
  background: #fff3df;
  border: 1px solid #f5cf9a;
  color: #825112;
  font-size: 13px;
}
.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}
.metric-card {
  gap: 12px;
  background: #fffdfa;
  border: 1px solid #dfe4d8;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 10px 24px rgba(46, 54, 42, .05);
}
.metric-card > span {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: #173b32;
  color: #d8f3dc;
}
.metric-card p, .panel-head p, .call-row span, .tool-card p, .metric-card small {
  color: #6c7568;
  font-size: 12px;
}
.metric-card strong {
  display: block;
  font-size: 23px;
  margin: 2px 0;
  font-variant-numeric: tabular-nums;
}
.dash-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, .75fr);
  gap: 16px;
  align-items: start;
}
.panel {
  background: #fffdfa;
  border: 1px solid #dfe4d8;
  border-radius: 8px;
  padding: 16px;
  min-width: 0;
  box-shadow: 0 16px 40px rgba(46, 54, 42, .06);
}
.tools-panel { grid-column: 1 / 2; }
.add-panel, .calls-panel { grid-column: 2 / 3; }
.panel-head {
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.primary-action, .submit-tool {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 12px;
  font-weight: 800;
  cursor: pointer;
}
.primary-action:hover, .submit-tool:hover, .icon-btn:hover { border-color: #173b32; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th {
  text-align: left;
  color: #707a6c;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: .08em;
  padding: 9px 8px;
  border-bottom: 1px solid #e7ebe1;
}
td {
  padding: 11px 8px;
  border-bottom: 1px solid #edf0e8;
}
code {
  font-family: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
  font-size: 12px;
}
.pill, .kind {
  display: inline-flex;
  align-items: center;
  min-height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: #edf3e7;
  color: #36513b;
  font-size: 11px;
  font-weight: 800;
}
.empty-cell, .empty-state {
  color: #899281;
  text-align: center;
  padding: 18px;
  font-size: 13px;
}
.call-list {
  display: flex;
  flex-direction: column;
  gap: 9px;
  max-height: 330px;
  overflow: auto;
}
.call-row {
  gap: 10px;
  border: 1px solid #e3e8dc;
  border-radius: 8px;
  padding: 10px;
}
.call-row div { min-width: 0; flex: 1; }
.call-row strong, .call-row span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.call-row em {
  font-style: normal;
  color: #5f6a5a;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.status-icon.ok { color: #178047; }
.status-icon.bad { color: #c43b31; }
.status-icon.run { color: #a76400; }
.search-box {
  gap: 9px;
  border: 1px solid #dfe4d8;
  border-radius: 8px;
  padding: 0 11px;
  margin-bottom: 12px;
  background: #fbfaf4;
}
.search-box input {
  border: 0;
  outline: 0;
  width: 100%;
  min-height: 40px;
  background: transparent;
  color: #17201a;
}
.tool-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 10px;
}
.tool-card {
  border: 1px solid #e2e6dd;
  border-radius: 8px;
  padding: 12px;
  background: #fbfaf4;
}
.tool-card.enabled { border-color: #a8d6b6; background: #f6fff7; }
.tool-main { align-items: flex-start; gap: 10px; min-height: 74px; }
.tool-icon {
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: #22372f;
  color: #d8f3dc;
  flex: 0 0 auto;
}
.tool-card p {
  margin-top: 3px;
  line-height: 1.4;
}
.tool-foot {
  justify-content: space-between;
  gap: 10px;
  margin-top: 12px;
}
.switch {
  width: 43px;
  height: 24px;
  border: 0;
  border-radius: 999px;
  padding: 3px;
  background: #bec8b8;
  cursor: pointer;
}
.switch span {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: white;
  transition: transform .16s ease;
}
.switch.on { background: #198552; }
.switch.on span { transform: translateX(19px); }
.tool-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.segmented {
  gap: 4px;
  padding: 4px;
  border: 1px solid #dfe4d8;
  border-radius: 8px;
  background: #f5f7f0;
}
.segmented button {
  flex: 1;
  min-height: 34px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #596457;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-weight: 800;
  cursor: pointer;
}
.segmented button.active {
  background: #173b32;
  color: #f7fff8;
}
.tool-form label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  color: #677262;
  font-weight: 800;
}
.tool-form input, .tool-form textarea {
  border: 1px solid #dfe4d8;
  border-radius: 8px;
  background: #fbfaf4;
  color: #17201a;
  padding: 9px 10px;
  font: inherit;
  font-size: 13px;
  outline: 0;
}
.tool-form textarea { resize: vertical; }
.tool-form input:focus, .tool-form textarea:focus { border-color: #173b32; }
.submit-tool {
  background: #173b32;
  color: #f7fff8;
  border-color: #173b32;
}
@media (max-width: 1100px) {
  .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dash-layout { grid-template-columns: 1fr; }
  .tools-panel, .add-panel, .calls-panel { grid-column: auto; }
}
@media (max-width: 640px) {
  .dashboard-root { padding: 16px; }
  .dash-top { align-items: flex-start; flex-direction: column; }
  .metric-grid { grid-template-columns: 1fr; }
}
`;

export default DashboardPage;
