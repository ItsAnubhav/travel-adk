import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Paperclip, Mic, Square, Loader2, SendHorizontal, X, Check, Plus, Image, FileText, File, LogOut } from 'lucide-react';
import { useSession } from '../hooks/useSession';
import { useChat } from '../hooks/useChat';
import { apiService, ChatHistorySessionSummary } from '../services/api';
import { AdminSnapshot, ChatMessage, LoginPayload, ResolvedToolView, ToolInvocation, ToolResult } from '../types';
import { CustomView, hasView, type CustomViewSpec } from '../views/registry';
import { AgenticBoxLogo } from '../components/AgenticBoxLogo';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

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

interface AdminPageProps {
  loginPayload: LoginPayload | null;
  embedMode?: boolean;
}

interface AgentToolMeta {
  name: string;
  category: string;
  keywords: string[];
  priority: number;
  display_title?: string;
  description?: string;
  icon_name?: string | null;
  icon_url?: string | null;
  enabled?: boolean;
}
interface AgentMeta {
  key: string;
  display_name: string;
  description: string;
  route_keywords: string[];
  tools: AgentToolMeta[];
}
interface AgentCatalog {
  agents: AgentMeta[];
  tool_count: number;
}

interface ToolStats {
  calls: number;
  successes: number;
  failures: number;
  success_rate: number;
  last_called: string | null;
}
interface ToolDoc {
  name: string;
  display_title?: string;
  description?: string;
  category?: string;
  icon_name?: string | null;
  icon_url?: string | null;
  keywords?: string[];
  priority?: number;
  agents?: string[];
  enabled?: boolean;
  stats?: ToolStats;
}

interface AuditLog {
  session_id?: string;
  node_name: string;
  timestamp: string;
  tool_name?: string;
  tool_input?: any;
  tool_output?: any;
  success?: boolean;
  error?: string | null;
  input_state?: any;
  output_state?: any;
  metadata?: Record<string, any>;
}

interface TokenUsageEntry {
  node_name?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  model?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

interface TokenUsageSummary {
  total_tokens?: number;
  total_prompt_tokens?: number;
  total_completion_tokens?: number;
  api_calls?: number;
  usage_details?: TokenUsageEntry[];
}

type CenterView = 'trace' | 'flow' | 'result';

interface RichResultRef {
  id: string;
  messageId: string;
  timestamp: Date;
  kind: 'tool_view' | 'custom_ui';
  label: string;
  toolView?: ResolvedToolView;
  customUi?: { tr: ToolResult; ui: CustomViewSpec };
}

const RESULT_VIEW_EXCLUDED_VIEW_TYPES = new Set<string>([
  'expense_settings',
]);
type SidebarTab = 'all' | 'agents' | 'tools' | 'sessions';

const AGENT_ICON_BG: Record<string, string> = {
  root: '#4F46E5',
  flight: '#0EA5E9',
  booking: '#1D4ED8',
  sbt: '#0EA5E9',
  expense: '#16A34A',
  backoffice: '#1D4ED8',
};

const AGENT_EMOJI: Record<string, string> = {
  sbt: '✈️',
  expense: '🧾',
  backoffice: '🛠️',
};

const TOOL_EMOJI: Record<string, string> = {
  booking_details_tool: '🎟️',
  fare_rules_tool: '📜',
  save_expense_tool: '💵',
  receipt_ocr_tool: '📷',
  expense_settings_tool: '⚙️',
  get_expense_report: '🗂️',
  explanation_tool: '💭',
  add_to_memory_tool: '💾',
  search_memory_tool: '🔍',
  memory_lookup_tool: '🧠',
  web_search_tool: '🌐',
  datetime_tool: '⏱️',
  math_tool: '➕',
};

// Map of lucide-style icon_name (snake-case from backend seed) → emoji glyph.
// Keeps icons working without pulling 1k+ Lucide components into the bundle;
// admin-set values still resolve to a recognizable glyph.
const ICON_NAME_GLYPH: Record<string, string> = {
  ticket: '🎟️',
  'scroll-text': '📜',
  scroll: '📜',
  wallet: '💵',
  camera: '📷',
  settings: '⚙️',
  files: '🗂️',
  'message-square': '💭',
  library: '📚',
  brain: '🧠',
  globe: '🌐',
  clock: '⏱️',
  calculator: '🧮',
  plus: '➕',
  wrench: '🔧',
};

interface ToolIconShape {
  name?: string;
  icon_name?: string | null;
  icon_url?: string | null;
}

const renderToolIcon = (t: ToolIconShape, size = 18): React.ReactNode => {
  if (t.icon_url) {
    return (
      <img
        src={t.icon_url}
        alt=""
        style={{ width: size, height: size, objectFit: 'contain', borderRadius: 4 }}
      />
    );
  }
  if (t.icon_name && ICON_NAME_GLYPH[t.icon_name]) return ICON_NAME_GLYPH[t.icon_name];
  if (t.name && TOOL_EMOJI[t.name]) return TOOL_EMOJI[t.name];
  return '🔧';
};

const formatJson = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const formatTime = (raw: string | Date | undefined): string => {
  if (!raw) return '';
  const d = raw instanceof Date ? raw : new Date(raw);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const AGENT_LABELS: Record<string, { display_name: string; description: string; route_keywords: string[] }> = {
  root: {
    display_name: 'Orchestrator',
    description: 'Routes users across travel, expense, booking, and preference workflows.',
    route_keywords: ['route', 'intent', 'orchestrate', 'assistant'],
  },
  flight: {
    display_name: 'SBT Agent',
    description: 'Handles self-booking travel queries, itineraries, booking details, and flight assistance.',
    route_keywords: ['flight', 'search', 'air', 'travel', 'itinerary'],
  },
  booking: {
    display_name: 'BackOffice Agent',
    description: 'Handles post-booking servicing such as cancellation, fare rules, and refunds.',
    route_keywords: ['booking', 'fare', 'cancel', 'refund', 'reissue'],
  },
  expense: {
    display_name: 'Expense Agent',
    description: 'Handles employee expense workflows, receipts, approvals, and reports.',
    route_keywords: ['expense', 'trip', 'approver', 'receipt', 'report'],
  },
};

const FALLBACK_TOOL_RECORDS = [
  { id: 'get_user_preferences', name: 'Get user preferences', description: 'Loads durable travel preferences for the active user.', kind: 'builtin', status: 'enabled' },
  { id: 'suggest_user_preference', name: 'Suggest user preference', description: 'Creates a pending preference when a user states a durable travel preference.', kind: 'builtin', status: 'enabled' },
  { id: 'search_company_documents', name: 'Search company documents', description: 'Searches uploaded company HR, holiday, policy, and manual documents.', kind: 'builtin', status: 'enabled' },
  { id: 'list_trip', name: 'List trips', description: 'Lists Travog trips visible to the authenticated user.', kind: 'builtin', status: 'enabled' },
  { id: 'get_trip_approvers', name: 'Get trip approvers', description: 'Fetches approvers for a Travog trip.', kind: 'builtin', status: 'enabled' },
  { id: 'send_trip_for_approval', name: 'Send trip for approval', description: 'Submits a trip to selected approvers.', kind: 'builtin', status: 'enabled' },
  { id: 'list_expenses', name: 'List expenses', description: 'Lists Travog expenses with optional filters.', kind: 'builtin', status: 'enabled' },
  { id: 'get_expense_settings', name: 'Get expense settings', description: 'Loads expense categories, currencies, and policy settings.', kind: 'builtin', status: 'enabled' },
  { id: 'create_expense', name: 'Create expense', description: 'Creates a Travog expense.', kind: 'builtin', status: 'enabled' },
  { id: 'update_expense', name: 'Update expense', description: 'Updates an existing Travog expense.', kind: 'builtin', status: 'enabled' },
  { id: 'get_booking', name: 'Get booking', description: 'Retrieves booking details by booking reference.', kind: 'builtin', status: 'enabled' },
  { id: 'get_fare_rules', name: 'Get fare rules', description: 'Retrieves fare rules for a flight from a booking.', kind: 'builtin', status: 'enabled' },
  { id: 'get_cancellation_policy', name: 'Get cancellation policy', description: 'Retrieves cancellation policy details for a booking.', kind: 'builtin', status: 'enabled' },
  { id: 'get_reissue_policy', name: 'Get reissue policy', description: 'Retrieves reissue policy details for a booking.', kind: 'builtin', status: 'enabled' },
] as const;

const catalogFromSnapshot = (snapshot: AdminSnapshot): AgentCatalog => {
  const buckets: Record<string, AgentToolMeta[]> = {};
  const agents = snapshot.agents.length
    ? snapshot.agents
    : Object.entries(AGENT_LABELS).map(([id, meta]) => ({
      id,
      name: meta.display_name,
      description: meta.description,
      status: 'enabled',
      updated_at: '',
    } as any));

  agents.forEach((agent) => {
    buckets[agent.id] = [];
  });

  const tools = snapshot.tools.length ? snapshot.tools : FALLBACK_TOOL_RECORDS;

  tools.forEach((tool, index) => {
    const agentKey = inferAgentForTool(tool.id);
    if (!buckets[agentKey]) buckets[agentKey] = [];
    buckets[agentKey].push({
      name: tool.id,
      display_title: tool.name,
      description: tool.description,
      category: tool.kind || 'builtin',
      keywords: [tool.id, tool.name, tool.description, tool.kind || ''].filter(Boolean),
      priority: index,
      enabled: tool.status === 'enabled',
      icon_name: iconNameForTool(tool.id),
    });
  });

  const mappedAgents = agents.map((agent) => {
    const label = AGENT_LABELS[agent.id] || {
      display_name: agent.name,
      description: agent.description,
      route_keywords: [agent.id, agent.name],
    };
    return {
      key: agent.id,
      display_name: label.display_name || agent.name,
      description: agent.description || label.description,
      route_keywords: label.route_keywords,
      tools: buckets[agent.id] || [],
    };
  });

  return {
    agents: mappedAgents,
    tool_count: tools.length,
  };
};

const toolDocsFromSnapshot = (snapshot: AdminSnapshot): ToolDoc[] =>
  (snapshot.tools.length ? snapshot.tools : FALLBACK_TOOL_RECORDS).map((tool, index) => ({
    name: tool.id,
    display_title: tool.name,
    description: tool.description,
    category: tool.kind,
    icon_name: iconNameForTool(tool.id),
    keywords: [tool.id, tool.name, tool.description, tool.kind || ''].filter(Boolean),
    priority: index,
    agents: [inferAgentForTool(tool.id)],
    enabled: tool.status === 'enabled',
    stats: toolStatsFromInvocations(tool.id, snapshot.tool_invocations),
  }));

const auditLogsFromSnapshot = (invocations: ToolInvocation[], sessionId: string): AuditLog[] =>
  invocations
    .filter((invocation) => !sessionId || invocation.session_id === sessionId)
    .slice()
    .reverse()
    .map((invocation) => ({
      session_id: invocation.session_id,
      node_name: 'tool_execution',
      timestamp: invocation.started_at,
      tool_name: invocation.tool_id,
      success: invocation.status !== 'failed',
      error: invocation.error_message,
      tool_input: { invocation_id: invocation.id },
      tool_output: {
        status: invocation.status,
        latency_ms: invocation.latency_ms,
        completed_at: invocation.completed_at,
      },
    }));

const toolStatsFromInvocations = (toolId: string, invocations: ToolInvocation[]): ToolStats => {
  const calls = invocations.filter((item) => item.tool_id === toolId);
  const successes = calls.filter((item) => item.status === 'success').length;
  const failures = calls.filter((item) => item.status === 'failed').length;
  return {
    calls: calls.length,
    successes,
    failures,
    success_rate: calls.length ? successes / calls.length : 0,
    last_called: calls[0]?.started_at || null,
  };
};

const inferAgentForTool = (toolId: string): string => {
  const id = toolId.toLowerCase();
  if (id.includes('expense') || id.includes('trip') || id.includes('approver')) return 'expense';
  if (id.includes('booking') || id.includes('fare') || id.includes('cancel') || id.includes('reissue')) return 'booking';
  if (id.includes('flight') || id.includes('air') || id.includes('offer')) return 'flight';
  return 'root';
};

const isOrchestratorAgent = (agent: Pick<AgentMeta, 'key' | 'display_name'>): boolean =>
  agent.key === 'root' || agent.display_name.toLowerCase() === 'orchestrator';

const iconNameForTool = (toolId: string): string => {
  const id = toolId.toLowerCase();
  if (id.includes('expense') || id.includes('trip')) return 'wallet';
  if (id.includes('booking')) return 'ticket';
  if (id.includes('fare') || id.includes('policy')) return 'scroll-text';
  if (id.includes('memory') || id.includes('preference')) return 'brain';
  if (id.includes('document') || id.includes('policy') || id.includes('manual')) return 'library';
  if (id.includes('search')) return 'globe';
  return 'wrench';
};

const AdminPage: React.FC<AdminPageProps> = ({ loginPayload, embedMode = false }) => {
  const params = useSession();

  const stableContext = useMemo(() => {
    const readAccessToken = (): string => {
      try {
        const raw = localStorage.getItem('aiva:loginTokens') || sessionStorage.getItem('aiva:loginTokens');
        if (!raw) return '';
        const parsed = JSON.parse(raw) as { accessToken?: string };
        return parsed?.accessToken || '';
      } catch {
        return '';
      }
    };
    const now = new Date();
    const base: Record<string, any> = {
      company_id: loginPayload?.companyId || params.cId,
      accountNo: loginPayload?.accountNo,
      name: loginPayload?.userName,
      user_name: loginPayload?.userName,
      source: loginPayload?.source,
      uid: loginPayload?.uid,
      sa_user_id: loginPayload?.saUserId,
      subagent_id: loginPayload?.subAgentId,
      client_id: loginPayload?.subAgentId,
      corporate_id: loginPayload?.corporateId,
      access_token: readAccessToken(),
      current_date: now.toISOString(),
      current_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    if (params.bRef && params.bRef !== 'N/A') base.booking_ref = params.bRef;
    return Object.fromEntries(
      Object.entries(base).filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== 'N/A'),
    );
  }, [params.bRef, params.cId, loginPayload]);

  const [view, setView] = useState<CenterView>(embedMode ? 'result' : 'trace');
  const [resultOpen, setResultOpen] = useState<boolean>(!embedMode);
  const [sbTab, setSbTab] = useState<SidebarTab>('all');
  const [catalog, setCatalog] = useState<AgentCatalog | null>(null);
  const [adminSnapshot, setAdminSnapshot] = useState<AdminSnapshot>(emptySnapshot);
  const [adminWsConnected, setAdminWsConnected] = useState(false);
  const [adminWsAttempted, setAdminWsAttempted] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const showTokenDebug = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const query = new URLSearchParams(window.location.search);
    return (
      query.get('debug_tokens') === '1' ||
      query.get('debugTokens') === '1' ||
      localStorage.getItem('aiva:debug:tokens') === '1' ||
      import.meta.env.VITE_DEBUG_TOKEN_VIEW === '1'
    );
  }, []);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageSummary | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [sbQuery, setSbQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<{
    file: File;
    result: any;
    previewUrl?: string;
  } | null>(null);
  const [showInputOptions, setShowInputOptions] = useState(false);
  const [chatWidth, setChatWidth] = useState(340);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [toolDocs, setToolDocs] = useState<ToolDoc[] | null>(null);
  const [toolDocsLoading, setToolDocsLoading] = useState(false);
  const [editingTool, setEditingTool] = useState<ToolDoc | null>(null);
  const [savingTool, setSavingTool] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [pastSessions, setPastSessions] = useState<ChatHistorySessionSummary[] | null>(null);
  const [pastSessionsLoading, setPastSessionsLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  const { messages, isConnected, isThinking, sendMessage, stopChat } = useChat({
    sessionId: params.sid,
    contextParams: stableContext,
    enabled: true,
    agent: 'root',
    userId: loginPayload?.userName || 'default-user',
  });

  const startResizing = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await uploadAndSendFile(file);
    }
  };

  useEffect(() => {
    const doResize = (e: MouseEvent) => {
      if (!isResizing) return;
      const newWidth = Math.max(340, Math.min(600, e.clientX));
      setChatWidth(newWidth);
    };

    const stopResize = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', doResize);
      window.addEventListener('mouseup', stopResize);
    }

    return () => {
      window.removeEventListener('mousemove', doResize);
      window.removeEventListener('mouseup', stopResize);
    };
  }, [isResizing]);

  useEffect(() => {
    let cancelled = false;
    apiService.fetchAdminSnapshot().then((snapshot) => {
      if (!cancelled && snapshot) setAdminSnapshot(snapshot);
    });

    const socket = apiService.connectAdminDashboard((snapshot) => {
      if (!cancelled) setAdminSnapshot(snapshot);
    });
    socket.addEventListener('open', () => {
      if (!cancelled) {
        setAdminWsAttempted(true);
        setAdminWsConnected(true);
      }
    });
    socket.addEventListener('close', () => {
      if (!cancelled) {
        setAdminWsAttempted(true);
        setAdminWsConnected(false);
      }
    });
    socket.addEventListener('error', () => {
      if (!cancelled) {
        setAdminWsAttempted(true);
        setAdminWsConnected(false);
      }
    });

    return () => {
      cancelled = true;
      socket.close();
    };
  }, []);

  useEffect(() => {
    setCatalog(catalogFromSnapshot(adminSnapshot));
    setToolDocs(toolDocsFromSnapshot(adminSnapshot));
    setAuditLogs(auditLogsFromSnapshot(adminSnapshot.tool_invocations, params.sid));
    setTokenUsage({
      total_tokens: adminSnapshot.metrics.total_tokens,
      total_prompt_tokens: adminSnapshot.metrics.prompt_tokens,
      total_completion_tokens: adminSnapshot.metrics.completion_tokens,
      api_calls: adminSnapshot.tool_invocations.length,
      usage_details: adminSnapshot.sessions.map((session) => ({
        node_name: session.agent_id,
        prompt_tokens: session.prompt_tokens,
        completion_tokens: session.completion_tokens,
        total_tokens: session.total_tokens,
        timestamp: session.last_seen_at,
      })),
    });
  }, [adminSnapshot, params.sid]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  const refreshToolDocs = async () => {
    setToolDocsLoading(true);
    try {
      const snapshot = await apiService.fetchAdminSnapshot();
      if (snapshot) {
        setAdminSnapshot(snapshot);
        setToolDocs(toolDocsFromSnapshot(snapshot));
      }
    } catch {
      /* swallow — UI will show empty state */
    } finally {
      setToolDocsLoading(false);
    }
  };

  const refreshPastSessions = async () => {
    const userId = loginPayload?.userName || 'default-user';
    setPastSessionsLoading(true);
    try {
      const list = await apiService.fetchUserSessions(userId);
      setPastSessions(list || []);
    } finally {
      setPastSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (sbTab !== 'sessions') return;
    if (pastSessions !== null) return;
    refreshPastSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sbTab]);

  const openSession = (sessionId: string) => {
    if (sessionId === params.sid) return;
    const url = new URL(window.location.href);
    url.searchParams.set('session_id', sessionId);
    window.location.replace(url.toString());
  };

  const toggleToolEnabled = async (name: string, target: boolean) => {
    try {
      const ok = await apiService.updateToolStatus(name, target ? 'enabled' : 'disabled');
      if (!ok) return;
      await refreshToolDocs();
    } catch {
      /* surface nothing — toggle stays off */
    }
  };

  const saveToolEdits = async (patch: Partial<ToolDoc> & { name: string }) => {
    setSavingTool(true);
    try {
      if (typeof patch.enabled === 'boolean') {
        await apiService.updateToolStatus(patch.name, patch.enabled ? 'enabled' : 'disabled');
      }
      await refreshToolDocs();
      setEditingTool(null);
    } finally {
      setSavingTool(false);
    }
  };

  const reseedTools = async () => {
    await refreshToolDocs();
  };

  const handleResetSession = () => {
    if (!window.confirm('Reset session? Current conversation will be cleared.')) return;
    const newSid = `sess_${Math.random().toString(36).slice(2, 10)}`;
    const url = new URL(window.location.href);
    url.searchParams.set('session_id', newSid);
    window.location.replace(url.toString());
  };

  const handleLogout = () => {
    if (!window.confirm('Log out? Local cache and session data will be cleared.')) return;
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      /* ignore */
    }
    window.location.replace('/login');
  };

  const allToolResults: ToolResult[] = useMemo(
    () => messages.flatMap((m) => m.toolResults || []),
    [messages],
  );


  const richResults: RichResultRef[] = useMemo(() => {
    const out: RichResultRef[] = [];
    for (const m of messages) {
      const seenViewTypes = new Set<string>();
      (m.toolViews || []).forEach((tv, i) => {
        const vt = tv?.view?.view_type;
        if (!vt || !hasView(vt)) return;
        if (RESULT_VIEW_EXCLUDED_VIEW_TYPES.has(vt)) return;
        if (seenViewTypes.has(vt)) return;
        seenViewTypes.add(vt);
        out.push({
          id: `${m.id}::view::${i}`,
          messageId: m.id,
          timestamp: m.timestamp,
          kind: 'tool_view',
          label: vt,
          toolView: tv,
        });
      });
      (m.toolResults || []).forEach((tr, i) => {
        const ui = extractCustomUi(tr);
        if (!ui) return;
        if (RESULT_VIEW_EXCLUDED_VIEW_TYPES.has(ui.view_type)) return;
        if (seenViewTypes.has(ui.view_type)) return;
        if (!hasView(ui.view_type)) return;
        seenViewTypes.add(ui.view_type);
        out.push({
          id: `${m.id}::cu::${i}`,
          messageId: m.id,
          timestamp: m.timestamp,
          kind: 'custom_ui',
          label: tr.tool_name || ui.view_type,
          customUi: { tr, ui },
        });
      });
    }
    return out;
  }, [messages]);

  const resultsByMessage = useMemo(() => {
    const map = new Map<string, RichResultRef[]>();
    for (const r of richResults) {
      const list = map.get(r.messageId);
      if (list) list.push(r);
      else map.set(r.messageId, [r]);
    }
    return map;
  }, [richResults]);

  const seenResultIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const seen = seenResultIdsRef.current;
    const newOnes = richResults.filter((r) => !seen.has(r.id));
    newOnes.forEach((r) => seen.add(r.id));

    // Only Result View is user-facing enough to auto-open. Avoid yanking focus
    // for older results restored from local/session history.
    const now = Date.now();
    const hasFreshResult = newOnes.some((r) => now - r.timestamp.getTime() < 4000);
    if (hasFreshResult) {
      setView('result');
      setResultOpen(true);
    }
  }, [richResults]);

  const handleViewResult = React.useCallback((id: string) => {
    setView('result');
    setResultOpen(true);
    requestAnimationFrame(() => {
      document.getElementById(`result-card-${id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }, []);

  const firedToolNames = useMemo(() => {
    const set = new Set<string>();
    allToolResults.forEach((r) => r.tool_name && set.add(r.tool_name));
    adminSnapshot.tool_invocations
      .filter((invocation) => !params.sid || invocation.session_id === params.sid)
      .forEach((invocation) => set.add(invocation.tool_id));
    auditLogs.forEach((l) => {
      if (l.node_name === 'tool_execution' && l.tool_name) set.add(l.tool_name);
    });
    return set;
  }, [allToolResults, adminSnapshot.tool_invocations, auditLogs, params.sid]);

  const activeAgentKey = useMemo(() => {
    const liveSession = adminSnapshot.sessions.find((session) => session.id === params.sid) || adminSnapshot.sessions[0];
    if (liveSession?.agent_id && catalog?.agents.some((a) => a.key === liveSession.agent_id)) {
      return String(liveSession.agent_id);
    }
    if (!catalog) return null;
    for (let i = messages.length - 1; i >= 0; i--) {
      const route = (messages[i].metadata as any)?.active_agent;
      if (route && catalog.agents.some((a) => a.key === route)) return route;
    }
    for (let i = auditLogs.length - 1; i >= 0; i--) {
      const route = auditLogs[i].input_state?.orchestrator_route || auditLogs[i].metadata?.active_agent;
      if (route && catalog.agents.some((a) => a.key === route)) return route;
    }
    return null;
  }, [adminSnapshot.sessions, params.sid, messages, auditLogs, catalog]);

  const agentToolFiringMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    if (!catalog) return map;
    catalog.agents.forEach((a) => {
      map[a.key] = new Set(a.tools.filter((t) => firedToolNames.has(t.name)).map((t) => t.name));
    });
    return map;
  }, [catalog, firedToolNames]);

  const agentIsFiring = (key: string): boolean => {
    return Boolean(isThinking && key === activeAgentKey);
  };

  const handleSend = async () => {
    const text = draft.trim();
    if ((!text && !pendingAttachment) || !isConnected) return;

    const metadata: any = {};
    if (pendingAttachment) {
      metadata.attachment = {
        file_path: pendingAttachment.result.file_path,
        filename: pendingAttachment.result.filename,
        kind: pendingAttachment.result.kind,
        doc_id: pendingAttachment.result.doc_id,
        indexed: pendingAttachment.result.indexed,
      };
    }

    sendMessage(text, metadata);
    setDraft('');
    setPendingAttachment(null);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, 80);
      textareaRef.current.style.height = `${newHeight}px`;
      textareaRef.current.style.overflowY = textareaRef.current.scrollHeight > 80 ? 'auto' : 'hidden';
    }
  }, [draft]);

  const handleFilePick = () => fileInputRef.current?.click();

  const uploadAndSendFile = async (file: File) => {
    if (!isConnected) return;

    // Set pending state immediately with local preview to show loading
    setPendingAttachment({
      file,
      result: null,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
    });

    setIsUploading(true);
    try {
      const result = await apiService.uploadFile(file, { sessionId: params.sid });
      if (!result) {
        alert(`Failed to upload ${file.name}.`);
        setPendingAttachment(null);
        return;
      }

      setPendingAttachment(prev => prev ? { ...prev, result } : null);
    } catch (error) {
      console.error('Error uploading file:', error);
      setPendingAttachment(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (file) {
      await uploadAndSendFile(file);
    }
  };

  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const cancelRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recordedChunksRef.current = []; // Clear chunks
      recorder.stop();
      setIsRecording(false);
    }
  };

  const startRecording = async () => {
    if (isRecording || isTranscribing) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Microphone capture is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) recordedChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordedChunksRef.current.length === 0) {
          setIsRecording(false);
          return;
        }
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        recordedChunksRef.current = [];
        setIsRecording(false);
        setIsTranscribing(true);
        try {
          const result = await apiService.transcribeVoice(blob, { sessionId: params.sid });
          if (result?.transcript) {
            setDraft(result.transcript);
          } else {
            alert('Transcription returned no text.');
          }
        } finally {
          setIsTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('[voice] mic permission denied or failed', err);
      alert('Could not access the microphone.');
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  useEffect(() => () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const toggleExpand = (id: string) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleGroup = (key: string) => setCollapsedGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const sbSearch = sbQuery.trim().toLowerCase();
  const sbMatches = (text?: string) => !sbSearch || (text || '').toLowerCase().includes(sbSearch);
  const isGroupOpen = (key: string) => (sbSearch ? true : !collapsedGroups[key]);

  const filteredAgents = useMemo(() => {
    if (!catalog) return [];
    return catalog.agents.filter(
      (a) =>
        a.key !== 'common' && (
          sbMatches(a.display_name) ||
          sbMatches(a.description) ||
          sbMatches(a.key) ||
          a.route_keywords.some(sbMatches)
        ),
    );
  }, [catalog, sbSearch]);

  const filteredToolGroups = useMemo(() => {
    if (!catalog) return [];
    return catalog.agents
      .map((a) => ({
        agent: a,
        tools: a.tools.filter(
          (t) => sbMatches(t.name) || sbMatches(t.category) || t.keywords.some(sbMatches),
        ),
      }))
      .filter((g) => g.tools.length > 0);
  }, [catalog, sbSearch]);

  const totalFilteredTools = useMemo(
    () => filteredToolGroups.reduce((sum, g) => sum + g.tools.length, 0),
    [filteredToolGroups],
  );

  return (
    <div
      className={`aiva-admin-root${embedMode ? ' embed' : ''}`}
      /* onDragEnter={() => setIsDragging(true)} */
      /* onDragOver={(e) => e.preventDefault()} */
    >
      <style>{ADMIN_STYLES}</style>

      {/* {isDragging && (
        <div
          className="drag-overlay"
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className="drag-overlay-content">
            <Paperclip size={48} style={{ color: 'var(--accent)', marginBottom: '16px' }} />
            <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text)' }}>Drop files here to upload to Aiva</div>
            <div style={{ fontSize: '14px', color: 'var(--muted)', marginTop: '8px' }}>Supports Images, PDFs, and Documents</div>
            <div style={{ fontSize: '12px', color: 'var(--muted-2)', marginTop: '4px' }}>Images and PDFs will be automatically scanned for receipt data</div>
          </div>
        </div>
      )} */}

      {!embedMode && (
        <div className="topbar">
          <div className="brand"><AgenticBoxLogo height={44} /></div>
          <div className="crumbs">/ Admin · Travel & Expense</div>
          <div className="right">
            <span className="pill"><span className={`live ${adminWsConnected ? '' : 'down'}`} />{adminWsConnected ? 'Realtime live' : adminWsAttempted ? 'Realtime offline' : 'Connecting...'}</span>
            <span className="pill">{params.sid.slice(0, 12)}…</span>
            <span className="pill">{loginPayload?.companyId || params.cId}</span>
            <button className="btn-soft" onClick={handleResetSession} title="Start a fresh session">Reset session</button>
            <button
              className="btn-soft logout-btn"
              onClick={handleLogout}
              title="Log out and clear local storage"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      )}

      {embedMode && (
        <button
          type="button"
          className="embed-result-toggle"
          onClick={() => setResultOpen((o) => !o)}
          title={resultOpen ? 'Hide result panel' : 'Show result panel'}
        >
          {resultOpen
            ? 'Hide result'
            : `Show result${richResults.length ? ` (${richResults.length})` : ''}`}
        </button>
      )}

      <div
        className="layout"
        style={{
          gridTemplateColumns: embedMode
            ? (resultOpen ? `${chatWidth}px 6px 1fr` : `1fr`)
            : `${chatWidth}px 6px 1fr 380px`,
        }}
      >
        <aside className="chat">
          {!embedMode && (
            <div className="chat-head">
              <span>Conversation</span>
              <span className="sub">
                {catalog?.agents.length ?? 0} agents · {catalog?.tool_count ?? 0} tools
              </span>
            </div>
          )}
          <div className="chat-body" ref={chatRef}>
            {messages.length === 0 ? (
              <div className="chat-empty">
                <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--text)' }}>Hello! How can I help you today?</div>
                <div className="hint">Send a message to start a session and populate the trace, flow, and result views.</div>
              </div>
            ) : (
              messages.map((m) => (
                <ChatBubble
                  key={m.id}
                  message={m}
                  results={resultsByMessage.get(m.id)}
                  onViewResult={handleViewResult}
                  onPreviewImage={setPreviewImage}
                />
              ))
            )}
            {isThinking && <div className="msg system">Thinking…</div>}
          </div>
          <div className="chat-input" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/*<input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,.doc,.docx,.txt,.md,.csv,audio/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />*/}
            {pendingAttachment && (
              <div className="pending-attachment-preview" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', width: '100%' }}>
                {!pendingAttachment.result && (
                  <div style={{ width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Loader2 size={16} className="spin" style={{ color: 'var(--accent)' }} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(() => {
                      const name = pendingAttachment.file.name;
                      const maxLen = 15;
                      if (name.length <= maxLen) return name;
                      const extIndex = name.lastIndexOf('.');
                      if (extIndex !== -1) {
                        const ext = name.slice(extIndex);
                        const availableSpace = maxLen - ext.length - 3;
                        if (availableSpace > 0) return name.slice(0, availableSpace) + '...' + ext;
                      }
                      return name.slice(0, maxLen - 3) + '...';
                    })()}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{(pendingAttachment.file.size / 1024).toFixed(1)} KB</div>
                </div>
                <button type="button" onClick={() => setPendingAttachment(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              </div>
            )}
            <div className="chat-input-controls" style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px' }}>
              {isRecording ? (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center flex-1 min-w-0">
                    <Plus size={16} className="text-slate-400 mr-2" />
                    <div className="flex-1 flex items-center min-w-0">
                      <div className="border-t border-dotted border-slate-600 flex-1 mr-2"></div>
                      <div className="flex items-center space-x-1 mr-2 flex-shrink-0">
                        <div className="w-1 h-3 animate-pulse" style={{ backgroundColor: 'var(--accent)' }}></div>
                        <div className="w-1 h-5 animate-pulse" style={{ animationDelay: '0.1s', backgroundColor: 'var(--accent)' }}></div>
                        <div className="w-1 h-6 animate-pulse" style={{ animationDelay: '0.2s', backgroundColor: 'var(--accent)' }}></div>
                        <div className="w-1 h-4 animate-pulse" style={{ animationDelay: '0.3s', backgroundColor: 'var(--accent)' }}></div>
                        <div className="w-1 h-2 animate-pulse" style={{ animationDelay: '0.4s', backgroundColor: 'var(--accent)' }}></div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={cancelRecording}
                      className="icon-btn"
                      aria-label="Cancel recording"
                      title="Cancel recording"
                    >
                      <X size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={stopRecording}
                      className="icon-btn"
                      aria-label="Finish recording"
                      title="Finish recording"
                    >
                      <Check size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="input-options-container">
                    <button
                      type="button"
                      className={`icon-btn ${showInputOptions ? 'active' : ''}`}
                      onClick={() => setShowInputOptions(!showInputOptions)}
                      title="Add options"
                      aria-label="Add options"
                    >
                      <Plus size={16} className={showInputOptions ? 'rotate-45' : ''} style={{ transition: 'transform 0.2s' }} />
                    </button>

                    {showInputOptions && (
                      <div className="floating-options">
                        {/*<button
                          type="button"
                          className="icon-btn"
                          onClick={() => { handleFilePick(); setShowInputOptions(false); }}
                          disabled={!isConnected || isUploading || isThinking}
                          title="Attach file"
                          aria-label="Attach file"
                        >
                          {isUploading ? <Loader2 size={16} className="spin" /> : <Paperclip size={16} />}
                        </button>*/}
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={() => { toggleRecording(); setShowInputOptions(false); }}
                          disabled={!isConnected || isTranscribing || isThinking}
                          title={isRecording ? 'Stop recording' : 'Record voice'}
                          aria-label={isRecording ? 'Stop recording' : 'Record voice'}
                        >
                          {isTranscribing ? <Loader2 size={16} className="spin" /> : <Mic size={16} />}
                        </button>
                      </div>
                    )}
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                        if (textareaRef.current) {
                          textareaRef.current.style.height = 'auto';
                          textareaRef.current.style.overflowY = 'hidden';
                        }
                      }
                    }}
                    placeholder={isThinking ? '' : (isTranscribing ? 'Transcribing…' : (isConnected ? 'Ask Aiva…' : 'Connecting…'))}
                    disabled={!isConnected || isTranscribing || isThinking}
                    rows={1}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button
                    className="send-btn"
                    onClick={isThinking ? stopChat : handleSend}
                    disabled={!isConnected || isUploading || (!isThinking && !draft.trim() && !pendingAttachment)}
                    title={isThinking ? "Stop" : "Send"}
                    aria-label={isThinking ? "Stop" : "Send"}
                  >
                    {isThinking ? <Square size={16} fill="currentColor" /> : <SendHorizontal size={16} />}
                  </button>
                </>
              )}
            </div>
          </div>
        </aside>
        {(!embedMode || resultOpen) && (
          <div className={`resizer ${isResizing ? 'resizing' : ''}`} onMouseDown={startResizing} />
        )}
        {(!embedMode || resultOpen) && (
          <main className="center">
            {!embedMode && (
              <div className="center-head">
                <ViewTab id="trace" current={view} onSelect={setView} label="Trace View" />
                <ViewTab id="flow" current={view} onSelect={setView} label="Flow View" badge={auditLogs.length} />
                <ViewTab id="result" current={view} onSelect={setView} label="Result View" badge={richResults.length || undefined} />
              </div>
            )}

          {embedMode ? (
            <ResultView results={richResults} />
          ) : (
            <>
              {view === 'trace' && (
                <TraceView
                  catalog={catalog}
                  activeAgentKey={activeAgentKey}
                  live={isThinking}
                  firedToolNames={firedToolNames}
                  agentToolFiringMap={agentToolFiringMap}
                />
              )}
              {view === 'flow' && (
                <FlowView
                  auditLogs={auditLogs}
                  messages={messages}
                  showTokenDebug={showTokenDebug}
                  tokenUsage={tokenUsage}
                />
              )}
              {view === 'result' && <ResultView results={richResults} />}
            </>
          )}
        </main>
        )}

        {!embedMode && <aside className="sidebar">
          <div className="sb-head">
            <span>Subagents & Tools</span>
            <span className="sub">{catalog?.agents.length ?? 0} · {catalog?.tool_count ?? 0}</span>
          </div>
          <div className="sb-tabs">
            {(['all', 'agents', 'tools', 'sessions'] as SidebarTab[]).map((k) => (
              <div key={k} className={`tab ${sbTab === k ? 'active' : ''}`} onClick={() => setSbTab(k)}>
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </div>
            ))}
          </div>
          <div className="sb-search">
            <input
              type="text"
              value={sbQuery}
              onChange={(e) => setSbQuery(e.target.value)}
              placeholder="Search agents and tools…"
            />
            {sbQuery && (
              <button className="sb-search-clear" onClick={() => setSbQuery('')} title="Clear search">×</button>
            )}
          </div>
          <div className="sb-list">
            {!catalog && <div className="sb-empty">Loading agent catalog…</div>}

            {catalog && (sbTab === 'all' || sbTab === 'agents') && (() => {
              const groupKey = 'group-subagents';
              const open = isGroupOpen(groupKey);
              const total = catalog.agents.length;
              const shown = filteredAgents.length;
              return (
                <>
                  <button
                    type="button"
                    className={`sb-group-head ${open ? 'open' : ''}`}
                    onClick={() => toggleGroup(groupKey)}
                  >
                    <span className="sb-group-chev">{open ? '▾' : '▸'}</span>
                    <span className="sb-group-title">Subagents</span>
                    <span className="sb-group-count">
                      {sbSearch ? `${shown} / ${total}` : total}
                    </span>
                  </button>
                  {open && (
                    shown === 0 ? (
                      <div className="sb-empty">No matching agents.</div>
                    ) : (
                      filteredAgents.map((a) => {
                        const firing = agentIsFiring(a.key);
                        const id = `agent-${a.key}`;
                        return (
                          <div
                            key={a.key}
                            className={`item ${firing ? 'firing' : ''} ${expanded[id] ? 'expanded' : ''}`}
                            onClick={() => toggleExpand(id)}
                          >
                            <div className="item-row">
                              <div className="item-icon" style={{ background: AGENT_ICON_BG[a.key] || '#475569' }}>
                                {AGENT_EMOJI[a.key] || '🤖'}
                              </div>
                              <div>
                                <div className="item-name">{a.display_name}</div>
                                <div className="item-type">{a.description}</div>
                              </div>
                              <span className={`item-status ${firing ? 'on' : ''}`}>{firing ? 'FIRING' : 'IDLE'}</span>
                            </div>
                            <div className="item-details">
                              <div className="det-row"><span>tools</span><code>{a.tools.length}</code></div>
                              <div className="det-row"><span>active_tools</span><code>{agentToolFiringMap[a.key]?.size || 0}</code></div>
                              <div className="det-row"><span>routes_on</span><code>{a.route_keywords.slice(0, 4).join(', ')}…</code></div>
                            </div>
                          </div>
                        );
                      })
                    )
                  )}
                </>
              );
            })()}

            {catalog && (sbTab === 'all' || sbTab === 'tools') && (
              <>
                {sbSearch && filteredToolGroups.length === 0 && (
                  <div className="sb-empty">No matching tools.</div>
                )}
                {(sbSearch ? filteredToolGroups : catalog.agents.map((a) => ({ agent: a, tools: a.tools }))).map(({ agent: a, tools }) => {
                  const groupKey = `group-tools-${a.key}`;
                  const open = isGroupOpen(groupKey);
                  const total = a.tools.length;
                  const shown = tools.length;
                  return (
                    <React.Fragment key={`tools-${a.key}`}>
                      <button
                        type="button"
                        className={`sb-group-head ${open ? 'open' : ''}`}
                        onClick={() => toggleGroup(groupKey)}
                      >
                        <span className="sb-group-chev">{open ? '▾' : '▸'}</span>
                        <span className="sb-group-title">{a.display_name} Tools</span>
                        <span className="sb-group-count">
                          {sbSearch ? `${shown} / ${total}` : total}
                        </span>
                      </button>
                      {open && tools.map((t) => {
                        const fired = firedToolNames.has(t.name);
                        const id = `tool-${a.key}-${t.name}`;
                        const callsForTool = auditLogs.filter((l) => l.tool_name === t.name);
                        const lastCall = callsForTool[callsForTool.length - 1];
                        return (
                          <div
                            key={id}
                            className={`item ${fired ? 'firing' : ''} ${expanded[id] ? 'expanded' : ''}`}
                            onClick={() => toggleExpand(id)}
                          >
                            <div className="item-row">
                              <div className="item-icon" style={{ background: AGENT_ICON_BG[a.key] || '#475569' }}>
                                {renderToolIcon(t)}
                              </div>
                              <div>
                                <div className="item-name">{t.name}</div>
                                <div className="item-type">{t.category} · {a.display_name}</div>
                              </div>
                              <span className={`item-status ${fired ? 'on' : ''}`}>{fired ? 'FIRED' : 'IDLE'}</span>
                            </div>
                            <div className="item-details">
                              <div className="det-row"><span>calls</span><code>{callsForTool.length}</code></div>
                              <div className="det-row"><span>priority</span><code>{t.priority}</code></div>
                              {lastCall && (
                                <>
                                  <div className="det-row"><span>last_called</span><code>{formatTime(lastCall.timestamp)}</code></div>
                                  <div className="det-row"><span>last_status</span><code>{lastCall.success === false ? 'error' : 'ok'}</code></div>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
                {sbSearch && sbTab === 'tools' && (
                  <div className="sb-search-summary">{totalFilteredTools} tool{totalFilteredTools === 1 ? '' : 's'} match</div>
                )}
              </>
            )}

            {sbTab === 'sessions' && (
              <PastSessionsList
                sessions={pastSessions}
                loading={pastSessionsLoading}
                search={sbSearch}
                sbMatches={sbMatches}
                currentSessionId={params.sid}
                onOpen={openSession}
                onRefresh={refreshPastSessions}
              />
            )}
          </div>
        </aside>}
      </div>

      {editingTool && (
        <ToolEditModal
          doc={editingTool}
          saving={savingTool}
          onClose={() => setEditingTool(null)}
          onSave={saveToolEdits}
        />
      )}

      {previewImage && (
        <div className="preview-overlay" onClick={() => setPreviewImage(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, cursor: 'pointer' }}>
          <img src={previewImage} alt="Preview" style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
          <button style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 0, color: 'white', fontSize: '30px', cursor: 'pointer' }} onClick={() => setPreviewImage(null)}>×</button>
        </div>
      )}
    </div>
  );
};

interface ToolManageListProps {
  docs: ToolDoc[] | null;
  loading: boolean;
  search: string;
  sbMatches: (text?: string) => boolean;
  onToggle: (name: string, target: boolean) => void;
  onEdit: (doc: ToolDoc) => void;
  onReseed: () => void;
  onRefresh: () => void;
}
const ToolManageList: React.FC<ToolManageListProps> = ({ docs, loading, search, sbMatches, onToggle, onEdit, onReseed, onRefresh }) => {
  if (loading && !docs) return <div className="sb-empty">Loading tool registry…</div>;
  if (!docs) return <div className="sb-empty">No tool definitions available.</div>;

  const filtered = docs.filter((d) =>
    sbMatches(d.name) ||
    sbMatches(d.display_title || '') ||
    sbMatches(d.description || '') ||
    sbMatches(d.category || '') ||
    (d.keywords || []).some(sbMatches),
  );

  if (filtered.length === 0) {
    return (
      <>
        <div className="sb-manage-actions">
          <button className="btn-soft" onClick={onReseed}>Reseed</button>
          <button className="btn-soft" onClick={onRefresh}>Refresh</button>
        </div>
        <div className="sb-empty">{search ? 'No matching tools.' : 'No tools registered.'}</div>
      </>
    );
  }

  const grouped = new Map<string, ToolDoc[]>();
  filtered.forEach((d) => {
    const key = d.category || 'other';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(d);
  });

  return (
    <>
      <div className="sb-manage-actions">
        <button className="btn-soft" onClick={onReseed}>Reseed</button>
        <button className="btn-soft" onClick={onRefresh}>Refresh</button>
      </div>
      {Array.from(grouped.entries()).map(([cat, list]) => (
        <React.Fragment key={cat}>
          <div className="sb-group-head open">
            <span className="sb-group-title">{cat}</span>
            <span className="sb-group-count">{list.length}</span>
          </div>
          {list.map((d) => {
            const stats = d.stats;
            const enabled = d.enabled !== false;
            return (
              <div key={d.name} className={`item ${enabled ? '' : 'disabled'}`}>
                <div className="item-row">
                  <div className="item-icon" style={{ background: '#1f2937' }}>
                    {renderToolIcon(d)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="item-name" style={{ opacity: enabled ? 1 : 0.5 }}>
                      {d.display_title || d.name}
                    </div>
                    <div className="item-type" title={d.description || ''}>
                      {d.name} {stats ? `· ${stats.calls} calls` : ''}
                    </div>
                  </div>
                  <span className={`item-status ${enabled ? 'on' : ''}`}>{enabled ? 'ON' : 'OFF'}</span>
                </div>
                <div className="item-details">
                  {d.description && (
                    <div className="det-row" style={{ alignItems: 'flex-start' }}>
                      <span>desc</span>
                      <code style={{ whiteSpace: 'normal' }}>{d.description}</code>
                    </div>
                  )}
                  <div className="det-row"><span>priority</span><code>{d.priority ?? 0}</code></div>
                  <div className="det-row"><span>agents</span><code>{(d.agents || []).join(', ') || '—'}</code></div>
                  {stats && stats.calls > 0 && (
                    <>
                      <div className="det-row"><span>success</span><code>{Math.round((stats.success_rate || 0) * 100)}%</code></div>
                      <div className="det-row"><span>last_called</span><code>{formatTime(stats.last_called || undefined) || '—'}</code></div>
                    </>
                  )}
                  <div className="det-row" style={{ gap: 8 }}>
                    <button className="btn-soft" onClick={() => onEdit(d)}>Edit</button>
                    <button className="btn-soft" onClick={() => onToggle(d.name, !enabled)}>
                      {enabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </>
  );
};

interface PastSessionsListProps {
  sessions: ChatHistorySessionSummary[] | null;
  loading: boolean;
  search: string;
  sbMatches: (text?: string) => boolean;
  currentSessionId: string;
  onOpen: (sessionId: string) => void;
  onRefresh: () => void;
}
const PastSessionsList: React.FC<PastSessionsListProps> = ({ sessions, loading, search, sbMatches, currentSessionId, onOpen, onRefresh }) => {
  if (loading && !sessions) return <div className="sb-empty">Loading past sessions…</div>;
  if (!sessions) return <div className="sb-empty">Unable to load sessions.</div>;

  const filtered = sessions.filter((s) =>
    sbMatches(s.title) ||
    sbMatches(s.id) ||
    sbMatches(s.agent_id) ||
    sbMatches(s.status),
  );

  return (
    <>
      <div className="sb-manage-actions">
        <button className="btn-soft" onClick={onRefresh}>Refresh</button>
      </div>
      {filtered.length === 0 ? (
        <div className="sb-empty">{search ? 'No matching sessions.' : 'No past sessions yet.'}</div>
      ) : (
        filtered.map((s) => {
          const isCurrent = s.id === currentSessionId;
          const statusOn = s.status === 'active';
          return (
            <div
              key={s.id}
              className={`item ${isCurrent ? 'firing' : ''}`}
              onClick={() => onOpen(s.id)}
              title={isCurrent ? 'Current session' : 'Open this session'}
            >
              <div className="item-row">
                <div className="item-icon" style={{ background: AGENT_ICON_BG[s.agent_id] || '#475569' }}>
                  {AGENT_EMOJI[s.agent_id] || '💬'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="item-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title || 'Untitled session'}
                  </div>
                  <div className="item-type">
                    {s.agent_id} · {formatSessionDate(s.updated_at)}
                  </div>
                </div>
                <span className={`item-status ${statusOn ? 'on' : ''}`}>
                  {isCurrent ? 'CURRENT' : s.status.toUpperCase()}
                </span>
              </div>
              <div className="item-details" style={{ display: 'block', marginTop: 8 }}>
                <div className="det-row"><span>session</span><code>{s.id.slice(0, 18)}…</code></div>
                <div className="det-row"><span>tokens</span><code>{s.total_tokens.toLocaleString()}</code></div>
                <div className="det-row"><span>started</span><code>{formatSessionDate(s.created_at)}</code></div>
              </div>
            </div>
          );
        })
      )}
    </>
  );
};

const formatSessionDate = (raw: string | undefined): string => {
  if (!raw) return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

interface ToolEditModalProps {
  doc: ToolDoc;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: Partial<ToolDoc> & { name: string }) => void;
}
const ToolEditModal: React.FC<ToolEditModalProps> = ({ doc, saving, onClose, onSave }) => {
  const [displayTitle, setDisplayTitle] = useState(doc.display_title || '');
  const [description, setDescription] = useState(doc.description || '');
  const [iconName, setIconName] = useState(doc.icon_name || '');
  const [iconUrl, setIconUrl] = useState(doc.icon_url || '');
  const [keywords, setKeywords] = useState((doc.keywords || []).join(', '));
  const [priority, setPriority] = useState(String(doc.priority ?? 0));
  const [agents, setAgents] = useState((doc.agents || []).join(', '));
  const [category, setCategory] = useState(doc.category || '');

  const submit = () => {
    onSave({
      name: doc.name,
      display_title: displayTitle.trim() || undefined,
      description: description.trim(),
      category: category.trim() || undefined,
      icon_name: iconName.trim() || null,
      icon_url: iconUrl.trim() || null,
      keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
      priority: Number.isFinite(Number(priority)) ? Number(priority) : 0,
      agents: agents.split(',').map((a) => a.trim()).filter(Boolean),
    });
  };

  return (
    <div className="tool-edit-overlay" onClick={onClose}>
      <div className="tool-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tool-edit-head">
          <strong>Edit tool</strong>
          <span style={{ opacity: 0.6, marginLeft: 8 }}>{doc.name}</span>
          <button className="btn-soft" style={{ marginLeft: 'auto' }} onClick={onClose}>×</button>
        </div>
        <div className="tool-edit-body">
          <label>Display title<input value={displayTitle} onChange={(e) => setDisplayTitle(e.target.value)} /></label>
          <label>Description<textarea value={description} rows={3} onChange={(e) => setDescription(e.target.value)} /></label>
          <label>Category<input value={category} onChange={(e) => setCategory(e.target.value)} /></label>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ flex: 1 }}>Icon name<input value={iconName} onChange={(e) => setIconName(e.target.value)} placeholder="ticket" /></label>
            <label style={{ flex: 2 }}>Icon URL<input value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="https://…/icon.svg" /></label>
          </div>
          <label>Keywords (comma-separated)<input value={keywords} onChange={(e) => setKeywords(e.target.value)} /></label>
          <div style={{ display: 'flex', gap: 8 }}>
            <label style={{ flex: 1 }}>Priority<input value={priority} onChange={(e) => setPriority(e.target.value)} /></label>
            <label style={{ flex: 2 }}>Agents (comma-separated)<input value={agents} onChange={(e) => setAgents(e.target.value)} placeholder="sbt, expense" /></label>
          </div>
        </div>
        <div className="tool-edit-foot">
          <button className="btn-soft" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn-soft primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
};

const ChatBubble: React.FC<{
  message: ChatMessage;
  results?: RichResultRef[];
  onViewResult?: (id: string) => void;
  onPreviewImage: (url: string) => void;
}> = ({ message, results, onViewResult, onPreviewImage }) => {
  if (message.role === 'system') {
    return <div className="msg system">{message.content}</div>;
  }
  const hasResults = Boolean(results && results.length);
  const fallback = hasResults ? '[rich result — see Result View]' : '';
  const body = message.content || fallback;
  const attachment = (message.metadata as any)?.attachment;

  if (message.role === 'assistant' && !body && !attachment && !hasResults) {
    return null;
  }

  return (
    <div className={`msg ${message.role === 'user' ? 'user' : 'bot'}`}>
      {attachment && (
        <div className="attachment-card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', marginBottom: '8px' }}>
          {attachment.kind === 'image' && attachment.file_path && (
            <div className="attachment-preview" style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)', borderRadius: '6px' }}>
              <img
                src={`${API_BASE}/${attachment.file_path}`}
                alt="Image"
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer' }}
                onClick={() => onPreviewImage(`${API_BASE}/${attachment.file_path}`)}
              />
            </div>
          )}
          {attachment.kind !== 'image' && (
            <div className="attachment-info" style={{ flex: 1, minWidth: 0 }}>
              <div className="attachment-name" style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.filename}</div>
              <div className="attachment-kind" style={{ fontSize: '12px', color: 'var(--muted)' }}>{attachment.kind || 'file'}</div>
            </div>
          )}
        </div>
      )}
      {body && (
        <div className="md">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
            }}
          >
            {body}
          </ReactMarkdown>
        </div>
      )}

      <span className="stamp">{formatTime(message.timestamp)}</span>
    </div>
  );
};

interface ViewTabProps {
  id: CenterView;
  current: CenterView;
  onSelect: (id: CenterView) => void;
  label: string;
  badge?: number;
}
const ViewTab: React.FC<ViewTabProps> = ({ id, current, onSelect, label, badge }) => (
  <div className={`view-tab ${current === id ? 'active' : ''}`} onClick={() => onSelect(id)}>
    {label}
    {badge !== undefined && badge > 0 && <span className="badge">{badge}</span>}
  </div>
);

interface TraceViewProps {
  catalog: AgentCatalog | null;
  activeAgentKey: string | null;
  live: boolean;
  firedToolNames: Set<string>;
  agentToolFiringMap: Record<string, Set<string>>;
}
const TraceView: React.FC<TraceViewProps> = ({ catalog, activeAgentKey, live, firedToolNames, agentToolFiringMap }) => {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStateRef = useRef<{ startClient: { x: number; y: number }; startPan: { x: number; y: number } } | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const W = 1000;
  const H = 600;

  const visibleAgents = useMemo(() => {
    if (!catalog) return [];
    return catalog.agents
      .filter((a) => !isOrchestratorAgent(a))
      .map((a) => ({
        original: a,
        firedTools: a.tools.filter((t) => firedToolNames.has(t.name)),
      }))
      .filter(({ original, firedTools }) =>
        activeAgentKey === original.key || firedTools.length > 0,
      );
  }, [catalog, firedToolNames, activeAgentKey]);

  const rootFiredTools = useMemo(() => {
    if (!catalog) return [];
    return catalog.agents
      .filter(isOrchestratorAgent)
      .flatMap((a) => a.tools.filter((t) => firedToolNames.has(t.name)));
  }, [catalog, firedToolNames]);

  if (!catalog) {
    return <div className="view-empty">Loading agent catalog…</div>;
  }

  const userX = 40;
  const userY = H / 2 - 30;
  const orchX = 320;
  const orchY = H / 2 - 30;
  const agentX = 660;
  const agentCount = Math.max(visibleAgents.length, 1);
  const agentSpacing = (H - 100) / agentCount;
  const toolRectW = 150;
  const toolX = W - toolRectW - 20;

  const toolDisplayName = (name: string): string => {
    const stripped = name.replace(/_tool$/, '');
    return stripped.length > 18 ? stripped.slice(0, 17) + '…' : stripped;
  };

  const ZOOM_MIN = 0.3;
  const ZOOM_MAX = 4;
  const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

  const svgPointFromClient = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const r = pt.matrixTransform(ctm.inverse());
    return { x: r.x, y: r.y };
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const cursor = svgPointFromClient(e.clientX, e.clientY);
    const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
    const newZoom = clampZoom(zoom * factor);
    if (newZoom === zoom) return;
    if (!cursor) {
      setZoom(newZoom);
      return;
    }
    // Keep the SVG point under the cursor visually still during the zoom.
    const contentX = (cursor.x - pan.x) / zoom;
    const contentY = (cursor.y - pan.y) / zoom;
    setZoom(newZoom);
    setPan({ x: cursor.x - contentX * newZoom, y: cursor.y - contentY * newZoom });
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    dragStateRef.current = { startClient: { x: e.clientX, y: e.clientY }, startPan: pan };
    setIsDragging(true);
  };
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const drag = dragStateRef.current;
    if (!drag) return;
    const cur = svgPointFromClient(e.clientX, e.clientY);
    const start = svgPointFromClient(drag.startClient.x, drag.startClient.y);
    if (!cur || !start) return;
    setPan({
      x: drag.startPan.x + (cur.x - start.x),
      y: drag.startPan.y + (cur.y - start.y),
    });
  };
  const endDrag = () => {
    dragStateRef.current = null;
    setIsDragging(false);
  };

  const stepZoom = (factor: number) => {
    const newZoom = clampZoom(zoom * factor);
    if (newZoom === zoom) return;
    const cx = W / 2;
    const cy = H / 2;
    const contentX = (cx - pan.x) / zoom;
    const contentY = (cy - pan.y) / zoom;
    setZoom(newZoom);
    setPan({ x: cx - contentX * newZoom, y: cy - contentY * newZoom });
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const hasActivity = visibleAgents.length > 0 || rootFiredTools.length > 0;

  return (
    <div className="canvas">
      <svg
        ref={svgRef}
        className="flow-svg"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* user -> orchestrator */}
          <path className={`edge ${live ? 'active' : ''}`} d={`M ${userX + 180} ${userY + 30} C ${userX + 240} ${userY + 30}, ${orchX - 60} ${orchY + 30}, ${orchX} ${orchY + 30}`} />

          {visibleAgents.map(({ original: a, firedTools }, idx) => {
            const ay = 50 + idx * agentSpacing;
            const isActive = live && activeAgentKey === a.key;
            const toolSpacing = Math.min(70, (H - 60) / Math.max(firedTools.length, 1));
            const baseToolY = (H - firedTools.length * toolSpacing) / 2;
            return (
              <g key={a.key}>
                {/* orch -> agent */}
                <path
                  className={`edge ${isActive ? 'active' : ''}`}
                  d={`M ${orchX + 200} ${orchY + 30} C ${orchX + 280} ${orchY + 30}, ${agentX - 60} ${ay + 30}, ${agentX} ${ay + 30}`}
                />
                {/* agent -> tools (only fired tools render) */}
                {firedTools.map((t, ti) => {
                  const ty = baseToolY + ti * toolSpacing;
                  return (
                    <path
                      key={`edge-${a.key}-${t.name}`}
                      className="edge active"
                      d={`M ${agentX + 140} ${ay + 30} C ${agentX + 200} ${ay + 30}, ${toolX - 30} ${ty + 20}, ${toolX} ${ty + 20}`}
                    />
                  );
                })}
                {/* agent node */}
                <g>
                  <rect className={`node ${isActive ? 'active' : ''}`} x={agentX} y={ay} width={140} height={60} rx={10} />
                  <text className="node-label" x={agentX + 16} y={ay + 26}>{AGENT_EMOJI[a.key] || ''} {a.display_name}</text>
                  <text className="node-sub" x={agentX + 16} y={ay + 46}>
                    {firedTools.length}/{a.tools.length} tools fired
                  </text>
                </g>
                {/* fired tool nodes */}
                {firedTools.map((t, ti) => {
                  const ty = baseToolY + ti * toolSpacing;
                  return (
                    <g key={`tool-${a.key}-${t.name}`}>
                      <rect className="node tool active" x={toolX} y={ty} width={toolRectW} height={36} rx={8} />
                      <text className="node-label" x={toolX + 10} y={ty + 24} fontSize={14}>
                        {TOOL_EMOJI[t.name] || '🔧'}
                      </text>
                      <text className="node-label tool-name" x={toolX + 34} y={ty + 24} fontSize={11}>
                        {toolDisplayName(t.name)}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {rootFiredTools.map((t, ti) => {
            const toolSpacing = Math.min(70, (H - 60) / Math.max(rootFiredTools.length, 1));
            const baseToolY = (H - rootFiredTools.length * toolSpacing) / 2;
            const ty = baseToolY + ti * toolSpacing;
            return (
              <g key={`tool-root-${t.name}`}>
                <path
                  className="edge active"
                  d={`M ${orchX + 200} ${orchY + 30} C ${orchX + 310} ${orchY + 30}, ${toolX - 40} ${ty + 20}, ${toolX} ${ty + 20}`}
                />
                <rect className="node tool active" x={toolX} y={ty} width={toolRectW} height={36} rx={8} />
                <text className="node-label" x={toolX + 10} y={ty + 24} fontSize={14}>
                  {TOOL_EMOJI[t.name] || '🔧'}
                </text>
                <text className="node-label tool-name" x={toolX + 34} y={ty + 24} fontSize={11}>
                  {toolDisplayName(t.name)}
                </text>
              </g>
            );
          })}

          {/* user node */}
          <g>
            <rect className={`node ${live ? 'active' : ''}`} x={userX} y={userY} width={180} height={60} rx={10} />
            <text className="node-label" x={userX + 18} y={userY + 26}>👤 User</text>
            <text className="node-sub" x={userX + 18} y={userY + 46}>Chat input</text>
          </g>
          {/* orchestrator node */}
          <g>
            <rect className={`node ${live ? 'active' : ''}`} x={orchX} y={orchY} width={200} height={60} rx={10} />
            <text className="node-label" x={orchX + 18} y={orchY + 26}>🧭 Orchestrator</text>
            <text className="node-sub" x={orchX + 18} y={orchY + 46}>
              Routes intents · active: {live ? activeAgentKey || '—' : '—'}
            </text>
          </g>
        </g>
      </svg>

      <div className="trace-controls">
        <button onClick={() => stepZoom(1.2)} title="Zoom in">+</button>
        <span className="zoom-pct">{Math.round(zoom * 100)}%</span>
        <button onClick={() => stepZoom(1 / 1.2)} title="Zoom out">−</button>
        <button onClick={resetView} title="Reset view">Reset</button>
      </div>

      <div className="trace-legend">
        <span><i style={{ background: '#10b981' }} />Live</span>
        <span><i style={{ background: '#cbd5e1' }} />Idle</span>
        <span><i style={{ background: '#4f46e5' }} />Active edge</span>
        <span>Active agent: <b>{live ? activeAgentKey || '—' : '—'}</b></span>
        <span>Tools fired: <b>{firedToolNames.size}</b></span>
        {!hasActivity && (
          <span className="trace-hint">Send a message to populate the trace.</span>
        )}
      </div>
    </div>
  );
};

interface FlowViewProps {
  auditLogs: AuditLog[];
  messages: ChatMessage[];
  showTokenDebug?: boolean;
  tokenUsage?: TokenUsageSummary | null;
}
const NOISY_NODES = new Set(['validate_input', 'llm_reasoning', 'post_tool_validation', 'finalize_response']);
const NODE_LABELS: Record<string, string> = {
  validate_input: 'Validate Input',
  llm_reasoning: 'LLM Reasoning',
  post_tool_validation: 'Post Tool Validation',
  finalize_response: 'Finalize Response',
};

const hasNodeError = (log: AuditLog): boolean =>
  log.success === false || Boolean(log.error);

const FlowView: React.FC<FlowViewProps> = ({ auditLogs, messages, showTokenDebug = false, tokenUsage = null }) => {
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const items = useMemo(() => {
    return auditLogs
      .filter((log) => !NOISY_NODES.has(log.node_name) || hasNodeError(log))
      .map((log, idx) => ({ id: `${log.timestamp}-${idx}`, log }));
  }, [auditLogs]);

  if (!items.length) {
    return (
      <div className="flow-scroll">
        {showTokenDebug && (
          <TokenDebugPanel messages={messages} auditLogs={auditLogs} tokenUsage={tokenUsage} />
        )}
        <div className="view-empty">
          {messages.length === 0
            ? 'No activity yet — send a message in the chat to populate the flow.'
            : 'Waiting for the first audit log to land…'}
        </div>
      </div>
    );
  }

  const firstTs = new Date(items[0].log.timestamp).getTime();

  return (
    <div className="flow-scroll">
      {showTokenDebug && (
        <TokenDebugPanel messages={messages} auditLogs={auditLogs} tokenUsage={tokenUsage} />
      )}
      {items.map(({ id, log }) => {
        const isTool = log.node_name === 'tool_execution';
        const isNoisyError = NOISY_NODES.has(log.node_name) && hasNodeError(log);
        const isOpen = openIds[id] ?? (isTool || isNoisyError);
        const ts = new Date(log.timestamp).getTime();
        const elapsed = Number.isNaN(ts) ? 0 : ts - firstTs;
        const tagClass = isTool
          ? log.success === false ? 'tag tool error' : 'tag tool'
          : isNoisyError ? 'tag tool error'
            : log.node_name === 'orchestrator_route' ? 'tag intent'
              : log.node_name === 'finalize_response' ? 'tag final'
                : log.node_name === 'llm_reasoning' ? 'tag llm'
                  : 'tag';
        const actor = isTool ? log.tool_name : log.node_name;
        const tagLabel = isNoisyError
          ? `${NODE_LABELS[log.node_name] || log.node_name} → Error`
          : isTool ? 'tool' : log.node_name;
        return (
          <div key={id} className={`step ${log.success === false || isNoisyError ? 'error' : 'done'}`}>
            <div className="dot" />
            <div className="step-card" onClick={() => setOpenIds((p) => ({ ...p, [id]: !isOpen }))}>
              <div className="step-meta">
                <span className="actor">{actor}</span>
                <span className={tagClass}>{tagLabel}</span>
                <span className="ms">+{(elapsed / 1000).toFixed(2)} s</span>
              </div>
              {!isTool && !isNoisyError && (
                <div className="step-title">
                  iteration {log.input_state?.iteration_count ?? 0} → {log.output_state?.current_node || '—'}
                  {log.output_state?.should_continue === false ? ' · final' : ''}
                </div>
              )}
              {isTool && (
                <div className="step-title">
                  {log.success === false ? 'Failed' : 'Succeeded'}
                  {log.error ? ` — ${log.error}` : ''}
                </div>
              )}
              {isNoisyError && (
                <div className="step-title">
                  Failed{log.error ? ` — ${log.error}` : ''}
                </div>
              )}
              {isOpen && (
                <div className="step-io">
                  <div className="io-block">
                    <span className="io-label">{isTool ? 'tool_input' : 'input_state'}</span>
                    <pre>{formatJson(isTool ? log.tool_input : log.input_state)}</pre>
                  </div>
                  <div className="io-block">
                    <span className="io-label">{isTool ? 'tool_output' : 'output_state'}</span>
                    <pre>{formatJson(isTool ? log.tool_output : log.output_state)}</pre>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const TokenDebugPanel: React.FC<{
  messages: ChatMessage[];
  auditLogs: AuditLog[];
  tokenUsage?: TokenUsageSummary | null;
}> = ({ messages, auditLogs, tokenUsage }) => {
  const messageRows = messages.map((message, idx) => ({
    id: message.id || `message-${idx}`,
    label: `${idx + 1}. ${message.role}`,
    tokens: estimateTokens({
      content: message.content,
      metadata: message.metadata,
      toolResults: message.toolResults,
      toolViews: message.toolViews,
    }),
    detail: truncateForDebug(message.content || (message.toolResults?.length ? '[tool results]' : '')),
  }));

  const toolRows = auditLogs
    .filter((log) => log.node_name === 'tool_execution')
    .map((log, idx) => ({
      id: `${log.timestamp}-${log.tool_name || idx}`,
      label: log.tool_name || `tool_${idx + 1}`,
      inputTokens: estimateTokens(log.tool_input),
      outputTokens: estimateTokens(log.tool_output),
      success: log.success !== false,
    }));

  const estimatedMessageTokens = messageRows.reduce((sum, row) => sum + row.tokens, 0);
  const estimatedToolTokens = toolRows.reduce((sum, row) => sum + row.inputTokens + row.outputTokens, 0);
  const usageDetails = tokenUsage?.usage_details || [];

  return (
    <section className="token-debug-panel">
      <div className="token-debug-head">
        <div>
          <div className="token-debug-title">Token Debug</div>
          <div className="token-debug-sub">Visible only with <code>debug_tokens=1</code> or <code>aiva:debug:tokens=1</code>.</div>
        </div>
        <div className="token-debug-total">
          <span>{formatCount(tokenUsage?.total_tokens || 0)}</span>
          <small>actual LLM tokens</small>
        </div>
      </div>

      <div className="token-debug-grid">
        <TokenStat label="Prompt" value={tokenUsage?.total_prompt_tokens || 0} kind="actual" />
        <TokenStat label="Completion" value={tokenUsage?.total_completion_tokens || 0} kind="actual" />
        <TokenStat label="LLM calls" value={tokenUsage?.api_calls || usageDetails.length} kind="actual" />
        <TokenStat label="Messages" value={estimatedMessageTokens} kind="estimated" />
        <TokenStat label="Tool I/O" value={estimatedToolTokens} kind="estimated" />
      </div>

      <div className="token-debug-columns">
        <div className="token-debug-block">
          <div className="token-debug-block-title">Messages <span>estimated</span></div>
          {messageRows.length ? messageRows.map((row) => (
            <div key={row.id} className="token-row">
              <span className="token-row-label">{row.label}</span>
              <span className="token-row-detail">{row.detail || 'empty'}</span>
              <b>{formatCount(row.tokens)}</b>
            </div>
          )) : <div className="token-empty">No messages yet.</div>}
        </div>

        <div className="token-debug-block">
          <div className="token-debug-block-title">Tool Calls <span>estimated input/output</span></div>
          {toolRows.length ? toolRows.map((row) => (
            <div key={row.id} className="token-row token-row-tool">
              <span className={`token-dot ${row.success ? 'ok' : 'bad'}`} />
              <span className="token-row-label">{row.label}</span>
              <span className="token-row-detail">in {formatCount(row.inputTokens)} / out {formatCount(row.outputTokens)}</span>
              <b>{formatCount(row.inputTokens + row.outputTokens)}</b>
            </div>
          )) : <div className="token-empty">No tool calls yet.</div>}
        </div>

        <div className="token-debug-block">
          <div className="token-debug-block-title">LLM Calls <span>actual</span></div>
          {usageDetails.length ? usageDetails.map((entry, idx) => (
            <div key={`${entry.timestamp || idx}-${idx}`} className="token-row">
              <span className="token-row-label">{entry.node_name || `llm_${idx + 1}`}</span>
              <span className="token-row-detail">
                p {formatCount(entry.prompt_tokens || 0)} / c {formatCount(entry.completion_tokens || 0)}
              </span>
              <b>{formatCount(entry.total_tokens || 0)}</b>
            </div>
          )) : <div className="token-empty">No backend usage reported yet.</div>}
        </div>
      </div>
    </section>
  );
};

const TokenStat: React.FC<{ label: string; value: number; kind: 'actual' | 'estimated' }> = ({ label, value, kind }) => (
  <div className="token-stat">
    <span>{label}</span>
    <b>{formatCount(value)}</b>
    <small>{kind}</small>
  </div>
);

const estimateTokens = (value: unknown): number => {
  if (value === undefined || value === null) return 0;
  const text = typeof value === 'string' ? value : safeJson(value);
  if (!text.trim()) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
};

const safeJson = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const truncateForDebug = (value: string): string => {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  return normalized.length > 90 ? `${normalized.slice(0, 87)}...` : normalized;
};

const formatCount = (value: number): string =>
  Number(value || 0).toLocaleString();

interface ResultViewProps {
  results: RichResultRef[];
}

const extractCustomUi = (tr: ToolResult): CustomViewSpec | null => {
  const candidate =
    (tr as any).tool_output?.custom_ui ??
    (tr as any).custom_ui ??
    null;
  if (candidate && typeof candidate === 'object' && typeof candidate.view_type === 'string') {
    return candidate as CustomViewSpec;
  }

  // Synthesize from the channel-scoped tool_view envelope (preferred shape from
  // tools like get_expense_report). The backend stores the full ToolView under
  // tool_output.tool_view; pick the 'chat' channel (or 'default' fallback).
  const tv = (tr as any).tool_output?.tool_view ?? (tr as any).tool_view;
  if (tv && typeof tv === 'object') {
    const channels = (tv as any).channels;
    if (channels && typeof channels === 'object') {
      const selected = channels.chat || channels.default;
      if (selected && typeof selected === 'object' && typeof selected.view_type === 'string') {
        return {
          view_type: selected.view_type,
          payload: selected.payload ?? {},
          fallback_text: selected.fallback_text ?? tv.fallback_text,
        } as CustomViewSpec;
      }
    }
  }

  return null;
};

const ResultView: React.FC<ResultViewProps> = ({ results }) => {
  if (!results.length) {
    return (
      <div className="result-scroll">
        <div className="view-empty">
          No custom UI to render yet. Tools that return a <code>custom_ui</code> payload will appear here.
        </div>
      </div>
    );
  }

  const isFlightTestEmbed =
    results.length === 1 &&
    results[0].kind === 'custom_ui' &&
    results[0].customUi?.ui.view_type === 'flight_test_page';

  return (
    <div className={`result-scroll${isFlightTestEmbed ? ' result-scroll-embedded' : ''}`}>
      {results.map((r) => {
        if (r.kind === 'tool_view' && r.toolView) {
          const { view_type, payload } = r.toolView.view;
          const registered = hasView(view_type);
          return (
            <div key={r.id} id={`result-card-${r.id}`} className="result-item">
              {registered ? (
                <CustomView
                  spec={{
                    view_type,
                    payload,
                    fallback_text: r.toolView.fallback_text,
                  }}
                />
              ) : (
                <ToolViewCard view={r.toolView} />
              )}
            </div>
          );
        }
        if (r.kind === 'custom_ui' && r.customUi) {
          const { tr, ui } = r.customUi;
          const registered = hasView(ui.view_type);
          if (registered) {
            return (
              <div key={r.id} id={`result-card-${r.id}`} className="result-item">
                <CustomView spec={ui} />
              </div>
            );
          }
          return (
            <div key={r.id} id={`result-card-${r.id}`} className="result-card">
              <div className="rc-head">
                🎨 {tr.tool_name}
                <span className="src">
                  {tr.success === false
                    ? 'failed'
                    : `${ui.view_type} (no component)`}
                </span>
              </div>
              <div className="rc-body">
                {typeof ui.fallback_text === 'string' && ui.fallback_text && (
                  <div className="result-text">{ui.fallback_text}</div>
                )}
                <pre className="raw-json">{formatJson(ui)}</pre>
              </div>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
};

const ToolViewCard: React.FC<{ view: ResolvedToolView }> = ({ view }) => {
  const { view_type, payload } = view.view;
  const registered = hasView(view_type);
  return (
    <div className="result-card">
      <div className="rc-head">
        📦 {view_type}
        <span className="src">
          {view.tool_name || view.channel}{registered ? '' : ' · no component'}
        </span>
      </div>
      <div className="rc-body">
        {view.fallback_text && <div className="result-text">{view.fallback_text}</div>}
        {registered ? (
          <div className="cv-host">
            <CustomView spec={{ view_type, payload, fallback_text: view.fallback_text }} />
          </div>
        ) : (
          <pre className="raw-json">{formatJson(payload)}</pre>
        )}
      </div>
    </div>
  );
};

const ADMIN_STYLES = `
.aiva-admin-root {
  --bg: #f6f7fb;
  --panel: #ffffff;
  --line: #e2e6ee;
  --text: #0f172a;
  --muted: #64748b;
  --muted-2: #94a3b8;
  --accent: #4f46e5;
  --accent-soft: #eef2ff;
  --green: #10b981;
  --green-soft: #dcfce7;
  --orange: #f59e0b;
  --orange-soft: #fef3c7;
  --red: #ef4444;
  --pink: #be185d;
  --code-bg: #0f172a;
  --code-fg: #e2e8f0;
  position: fixed; inset: 0;
  font-family: 'Inter', -apple-system, system-ui, Segoe UI, sans-serif;
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
  z-index: 1;
  color-scheme: light;
}
.aiva-admin-root *, .aiva-admin-root *::before, .aiva-admin-root *::after { box-sizing: border-box; }

.aiva-admin-root .drag-overlay {
  position: fixed;
  inset: 0;
  background: rgba(246, 247, 251, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: aiva-fade-in 0.2s ease-out;
}
.aiva-admin-root .drag-overlay-content {
  background: white;
  padding: 40px;
  border-radius: 16px;
  border: 2px dashed var(--accent);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
  max-width: 400px;
}
@keyframes aiva-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.aiva-admin-root .topbar {
  height: 56px; background: var(--panel); border-bottom: 1px solid var(--line);
  display: flex; align-items: center; padding: 0 20px; gap: 16px;
}
.aiva-admin-root .brand { display: flex; align-items: center; color: var(--text); }
.aiva-admin-root .brand svg { display: block; }
.aiva-admin-root .crumbs { color: var(--muted); font-size: 13px; }
.aiva-admin-root .topbar .right { margin-left: auto; display: flex; gap: 8px; align-items: center; }
.aiva-admin-root .pill {
  font-size: 12px; padding: 5px 10px; border: 1px solid var(--line);
  border-radius: 999px; color: var(--muted); background: #fff;
}
.aiva-admin-root .pill .live { display: inline-block; width: 6px; height: 6px; background: var(--green); border-radius: 50%; margin-right: 6px; animation: pulse 1.4s infinite; }
.aiva-admin-root .pill .live.down { background: var(--orange); }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }

.aiva-admin-root .layout {
  display: grid;
  height: calc(100vh - 56px);
  min-height: 0;
}
.aiva-admin-root.embed .layout {
  height: 100vh;
}
.aiva-admin-root .embed-result-toggle {
  position: fixed;
  top: 10px;
  right: 12px;
  z-index: 20;
  padding: 6px 12px;
  font: 600 12px/1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--text);
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
}
.aiva-admin-root .embed-result-toggle:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.aiva-admin-root .resizer {
  width: 6px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.2s;
  z-index: 5;
  margin-left: -3px;
  margin-right: -3px;
}
.aiva-admin-root .resizer:hover,
.aiva-admin-root .resizer.resizing {
  background: var(--accent);
}

.aiva-admin-root .chat {
  background: var(--panel); border-right: 1px solid var(--line);
  display: flex; flex-direction: column; min-height: 0; overflow: hidden;
  transition: background 0.2s;
}
.aiva-admin-root .chat.dragging {
  background: var(--accent-soft);
}
.aiva-admin-root .chat-head {
  padding: 14px 18px; border-bottom: 1px solid var(--line);
  font-weight: 600; font-size: 14px; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
}
.aiva-admin-root .chat-head .sub { color: var(--muted); font-weight: 400; font-size: 12px; }
.aiva-admin-root .chat-body { flex: 1 1 0; min-height: 0; overflow-y: auto; padding: 14px 18px; display: flex; flex-direction: column; gap: 10px; }
.aiva-admin-root .chat-empty { color: var(--muted); font-size: 13px; text-align: center; margin: auto 0; }
.aiva-admin-root .chat-empty .hint { font-size: 11.5px; color: var(--muted-2); margin-top: 4px; }
.aiva-admin-root .msg { max-width: 88%; padding: 9px 13px; border-radius: 12px; font-size: 13px; line-height: 1.5; word-wrap: break-word; white-space: pre-wrap; }
.aiva-admin-root .msg.user { align-self: flex-end; background: var(--accent); color: white; border-bottom-right-radius: 4px; }
.aiva-admin-root .msg.bot { align-self: flex-start; background: #f1f5f9; border-bottom-left-radius: 4px; }
.aiva-admin-root .msg.system { align-self: center; background: var(--accent-soft); color: var(--accent); font-size: 11.5px; padding: 5px 11px; border-radius: 999px; max-width: 95%; text-align: center; }
.aiva-admin-root .msg .stamp { display: block; font-size: 10.5px; color: var(--muted-2); margin-top: 4px; }
.aiva-admin-root .msg.user .stamp { color: rgba(255,255,255,.75); }

.aiva-admin-root .msg .view-result-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.aiva-admin-root .msg .view-result-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 5px 10px; font-size: 11.5px; font-weight: 600;
  background: var(--accent-soft); color: var(--accent);
  border: 1px solid rgba(79, 70, 229, 0.25);
  border-radius: 999px; cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.aiva-admin-root .msg .view-result-btn:hover { background: rgba(79, 70, 229, 0.18); border-color: rgba(79, 70, 229, 0.45); }
.aiva-admin-root .msg .view-result-btn .vrb-label { font-weight: 500; opacity: 0.85; }

.aiva-admin-root .msg .attachment-card {
  display: flex;
  align-items: center;
  gap: 12px;
  background: white;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 12px;
  margin-bottom: 8px;
  color: var(--text);
}
.aiva-admin-root .msg.user .attachment-card {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.2);
  color: white;
}
.aiva-admin-root .msg .attachment-icon {
  width: 32px;
  height: 32px;
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.aiva-admin-root .msg.user .attachment-icon {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}
.aiva-admin-root .msg .attachment-info {
  flex: 1;
  min-width: 0;
}
.aiva-admin-root .msg .attachment-name {
  font-weight: 600;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.aiva-admin-root .msg .attachment-kind {
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
}
.aiva-admin-root .msg.user .attachment-kind {
  color: rgba(255, 255, 255, 0.7);
}

.aiva-admin-root .msg .md { white-space: normal; }
.aiva-admin-root .msg .md > *:first-child { margin-top: 0; }
.aiva-admin-root .msg .md > *:last-child { margin-bottom: 0; }
.aiva-admin-root .msg .md p { margin: 0 0 8px; }
.aiva-admin-root .msg .md p:last-child { margin-bottom: 0; }
.aiva-admin-root .msg .md h1,
.aiva-admin-root .msg .md h2,
.aiva-admin-root .msg .md h3,
.aiva-admin-root .msg .md h4,
.aiva-admin-root .msg .md h5,
.aiva-admin-root .msg .md h6 { margin: 12px 0 6px; line-height: 1.25; font-weight: 600; }
.aiva-admin-root .msg .md h1 { font-size: 1.35em; }
.aiva-admin-root .msg .md h2 { font-size: 1.2em; }
.aiva-admin-root .msg .md h3 { font-size: 1.08em; }
.aiva-admin-root .msg .md h4,
.aiva-admin-root .msg .md h5,
.aiva-admin-root .msg .md h6 { font-size: 1em; }
.aiva-admin-root .msg .md ul,
.aiva-admin-root .msg .md ol { margin: 0 0 8px; padding-left: 20px; }
.aiva-admin-root .msg .md li { margin: 2px 0; }
.aiva-admin-root .msg .md li > p { margin: 0; }
.aiva-admin-root .msg .md li input[type="checkbox"] { margin-right: 6px; vertical-align: middle; }
.aiva-admin-root .msg .md a { color: var(--accent); text-decoration: underline; }
.aiva-admin-root .msg.user .md a { color: #fff; text-decoration: underline; }
.aiva-admin-root .msg .md strong { font-weight: 600; }
.aiva-admin-root .msg .md em { font-style: italic; }
.aiva-admin-root .msg .md del { opacity: 0.7; }
.aiva-admin-root .msg .md blockquote {
  margin: 6px 0 8px;
  padding: 4px 10px;
  border-left: 3px solid var(--line);
  color: var(--muted);
  background: rgba(0,0,0,0.03);
  border-radius: 4px;
}
.aiva-admin-root .msg.user .md blockquote { border-left-color: rgba(255,255,255,.5); color: rgba(255,255,255,.85); background: rgba(255,255,255,.1); }
.aiva-admin-root .msg .md code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.88em;
  background: rgba(15,23,42,0.08);
  padding: 1px 5px;
  border-radius: 4px;
}
.aiva-admin-root .msg.user .md code { background: rgba(255,255,255,0.18); color: #fff; }
.aiva-admin-root .msg .md pre {
  margin: 6px 0 8px;
  padding: 10px 12px;
  background: var(--code-bg);
  color: var(--code-fg);
  border-radius: 8px;
  overflow-x: auto;
  font-size: 12px;
  line-height: 1.45;
}
.aiva-admin-root .msg .md pre code { background: transparent; padding: 0; color: inherit; font-size: inherit; border-radius: 0; }
.aiva-admin-root .msg .md table {
  border-collapse: collapse;
  margin: 6px 0 8px;
  font-size: 0.95em;
  display: block;
  overflow-x: auto;
  max-width: 100%;
}
.aiva-admin-root .msg .md th,
.aiva-admin-root .msg .md td { border: 1px solid var(--line); padding: 4px 8px; text-align: left; }
.aiva-admin-root .msg .md th { background: rgba(15,23,42,0.05); font-weight: 600; }
.aiva-admin-root .msg.user .md th { background: rgba(255,255,255,0.15); }
.aiva-admin-root .msg.user .md th,
.aiva-admin-root .msg.user .md td { border-color: rgba(255,255,255,0.35); }
.aiva-admin-root .msg .md hr { border: 0; border-top: 1px solid var(--line); margin: 10px 0; }
.aiva-admin-root .msg.user .md hr { border-top-color: rgba(255,255,255,.4); }
.aiva-admin-root .msg .md img { max-width: 100%; border-radius: 6px; }
.aiva-admin-root .chat-input {
  border-top: 1px solid var(--line); padding: 12px;
  display: flex; gap: 8px; flex-shrink: 0; background: var(--panel);
}
.aiva-admin-root .chat-input textarea {
  flex: 1; padding: 10px 14px; border: 1px solid var(--line); border-radius: 10px; font-size: 13px; outline: none;
  background: white; color: var(--text);
  resize: none;
  line-height: 1.5;
  height: 40px;
  box-sizing: border-box;
  overflow-y: hidden;
}
.aiva-admin-root .chat-input textarea:focus { border-color: var(--accent); }
.aiva-admin-root .chat-input textarea::-webkit-scrollbar {
  width: 6px;
}
.aiva-admin-root .chat-input textarea::-webkit-scrollbar-track {
  background: transparent;
}
.aiva-admin-root .chat-input textarea::-webkit-scrollbar-thumb {
  background: var(--line);
  border-radius: 3px;
}
.aiva-admin-root .chat-input textarea::-webkit-scrollbar-thumb:hover {
  background: var(--accent);
}
.aiva-admin-root .chat-input button {
  background: var(--accent); color: white; border: none; border-radius: 10px;
  padding: 10px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
}
.aiva-admin-root .chat-input button:disabled { opacity: 0.5; cursor: not-allowed; }
.aiva-admin-root .chat-input .send-btn {
  width: 36px; height: 36px; padding: 0; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
}
.aiva-admin-root .chat-input .icon-btn {
  background: var(--panel); color: var(--text); border: 1px solid var(--line);
  border-radius: 10px; padding: 0; width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  cursor: pointer;
}
.aiva-admin-root .chat-input .icon-btn:hover:not(:disabled) { background: var(--bg); }
.aiva-admin-root .chat-input .icon-btn.recording { background: #dc2626; color: white; border-color: #dc2626; }
.aiva-admin-root .chat-input .icon-btn .spin { animation: aiva-spin 0.9s linear infinite; }
@keyframes aiva-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.aiva-admin-root .chat-input .input-options-container {
  position: relative;
  display: flex;
  align-items: center;
}
.aiva-admin-root .chat-input .floating-options {
  position: absolute;
  bottom: 44px;
  left: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 6px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  animation: aiva-fade-up 0.2s ease-out;
  z-index: 10;
}
@keyframes aiva-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.aiva-admin-root .center {
  background: var(--bg);
  display: flex; flex-direction: column; min-height: 0; overflow: hidden;
}
.aiva-admin-root .center-head {
  background: var(--panel); border-bottom: 1px solid var(--line);
  display: flex; align-items: center; padding: 0 18px; flex-shrink: 0; height: 50px; gap: 4px;
}
.aiva-admin-root .view-tab {
  padding: 10px 14px; font-size: 13px; font-weight: 500; color: var(--muted); cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px; display: flex; align-items: center; gap: 8px;
}
.aiva-admin-root .view-tab.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
.aiva-admin-root .view-tab .badge {
  font-size: 10px; background: #f1f5f9; color: var(--muted);
  padding: 1px 7px; border-radius: 999px; font-weight: 600;
}
.aiva-admin-root .view-tab.active .badge { background: var(--accent-soft); color: var(--accent); }
.aiva-admin-root .center-head .right { margin-left: auto; display: flex; gap: 6px; }
.aiva-admin-root .btn-soft {
  background: white; border: 1px solid var(--line); border-radius: 8px; padding: 6px 11px;
  font-size: 12px; cursor: pointer; color: var(--text);
}
.aiva-admin-root .btn-soft:hover { border-color: var(--accent); color: var(--accent); }
.aiva-admin-root .view-empty { color: var(--muted); font-size: 13px; text-align: center; padding: 60px 20px; }

.aiva-admin-root .canvas {
  flex: 1 1 0; min-height: 0; width: 100%;
  background-image: radial-gradient(circle, #d8dce6 1px, transparent 1px);
  background-size: 20px 20px; position: relative;
  display: flex; flex-direction: column;
}
.aiva-admin-root svg.flow-svg { flex: 1 1 0; width: 100%; height: 100%; user-select: none; }
.aiva-admin-root .trace-controls {
  position: absolute; top: 12px; right: 12px; z-index: 2;
  background: var(--panel); border: 1px solid var(--line);
  border-radius: 8px; padding: 4px; display: flex; gap: 2px; align-items: center;
  font-size: 12px; user-select: none;
  box-shadow: 0 2px 8px rgba(15,23,42,0.06);
}
.aiva-admin-root .trace-controls button {
  border: 0; background: transparent; cursor: pointer;
  padding: 4px 9px; border-radius: 6px; font-size: 13px; color: var(--text);
  font-weight: 600;
}
.aiva-admin-root .trace-controls button:hover { background: var(--accent-soft); color: var(--accent); }
.aiva-admin-root .trace-controls .zoom-pct {
  min-width: 44px; text-align: center; color: var(--muted);
  font-variant-numeric: tabular-nums; font-weight: 500;
}
.aiva-admin-root .trace-hint { color: var(--muted-2); font-style: italic; }
.aiva-admin-root .node { fill: white; stroke: var(--line); stroke-width: 1.5; }
.aiva-admin-root .node.active { stroke: var(--accent); stroke-width: 2.5; filter: drop-shadow(0 4px 14px rgba(79,70,229,.25)); }
.aiva-admin-root .node.tool { fill: #fafbff; }
.aiva-admin-root .node-label { font-size: 12px; font-weight: 600; fill: var(--text); }
.aiva-admin-root .node-label.tool-name { font-weight: 500; fill: var(--muted); }
.aiva-admin-root .node.tool.active + .node-label + .node-label.tool-name { fill: var(--accent); }
.aiva-admin-root .node-sub { font-size: 10px; fill: var(--muted); }
.aiva-admin-root .edge { stroke: #cbd5e1; stroke-width: 1.5; fill: none; }
.aiva-admin-root .edge.active { stroke: var(--accent); stroke-width: 2; stroke-dasharray: 6 4; animation: dash 1s linear infinite; }
@keyframes dash { to { stroke-dashoffset: -10; } }
.aiva-admin-root .trace-legend {
  background: var(--panel); border-top: 1px solid var(--line);
  padding: 10px 18px; font-size: 11px; color: var(--muted);
  display: flex; gap: 14px; flex-wrap: wrap; flex-shrink: 0;
}
.aiva-admin-root .trace-legend i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }

.aiva-admin-root .flow-scroll {
  flex: 1 1 0; min-height: 0; overflow-y: auto; padding: 18px 22px 30px;
}
.aiva-admin-root .token-debug-panel {
  background: #0f172a; color: #e2e8f0; border-radius: 10px; padding: 14px;
  margin-bottom: 18px; border: 1px solid rgba(148,163,184,.28);
  box-shadow: 0 10px 28px rgba(15,23,42,.12);
}
.aiva-admin-root .token-debug-head {
  display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 12px;
}
.aiva-admin-root .token-debug-title { font-size: 13.5px; font-weight: 700; }
.aiva-admin-root .token-debug-sub { color: #94a3b8; font-size: 11px; margin-top: 3px; }
.aiva-admin-root .token-debug-sub code {
  background: rgba(148,163,184,.16); border: 1px solid rgba(148,163,184,.22);
  border-radius: 5px; padding: 1px 4px; color: #cbd5e1;
}
.aiva-admin-root .token-debug-total { text-align: right; min-width: 116px; }
.aiva-admin-root .token-debug-total span { display: block; font-size: 22px; line-height: 1; font-weight: 750; font-variant-numeric: tabular-nums; }
.aiva-admin-root .token-debug-total small,
.aiva-admin-root .token-stat small { color: #94a3b8; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
.aiva-admin-root .token-debug-grid {
  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-bottom: 12px;
}
.aiva-admin-root .token-stat {
  background: rgba(15,23,42,.5); border: 1px solid rgba(148,163,184,.2);
  border-radius: 8px; padding: 9px 10px; min-width: 0;
}
.aiva-admin-root .token-stat span { display: block; color: #cbd5e1; font-size: 11px; margin-bottom: 4px; }
.aiva-admin-root .token-stat b { display: block; font-size: 16px; font-variant-numeric: tabular-nums; }
.aiva-admin-root .token-debug-columns { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.aiva-admin-root .token-debug-block {
  min-width: 0; background: rgba(2,6,23,.38); border: 1px solid rgba(148,163,184,.18);
  border-radius: 8px; overflow: hidden;
}
.aiva-admin-root .token-debug-block-title {
  padding: 8px 10px; border-bottom: 1px solid rgba(148,163,184,.18);
  font-size: 11.5px; font-weight: 650; display: flex; justify-content: space-between; gap: 8px;
}
.aiva-admin-root .token-debug-block-title span { color: #94a3b8; font-weight: 500; font-size: 10px; }
.aiva-admin-root .token-row {
  display: grid; grid-template-columns: minmax(82px, .65fr) minmax(0, 1fr) auto;
  align-items: center; gap: 8px; padding: 7px 10px; border-bottom: 1px solid rgba(148,163,184,.12);
  font-size: 11.5px;
}
.aiva-admin-root .token-row:last-child { border-bottom: 0; }
.aiva-admin-root .token-row-label { color: #e2e8f0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aiva-admin-root .token-row-detail { color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aiva-admin-root .token-row b { font-variant-numeric: tabular-nums; color: #f8fafc; }
.aiva-admin-root .token-row-tool { grid-template-columns: 8px minmax(82px, .65fr) minmax(0, 1fr) auto; }
.aiva-admin-root .token-dot { width: 7px; height: 7px; border-radius: 50%; background: #94a3b8; }
.aiva-admin-root .token-dot.ok { background: #22c55e; }
.aiva-admin-root .token-dot.bad { background: #ef4444; }
.aiva-admin-root .token-empty { color: #94a3b8; font-size: 11.5px; padding: 10px; }
@media (max-width: 1100px) {
  .aiva-admin-root .token-debug-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .aiva-admin-root .token-debug-columns { grid-template-columns: 1fr; }
}
.aiva-admin-root .step { position: relative; padding-left: 32px; padding-bottom: 14px; }
.aiva-admin-root .step::before {
  content: ""; position: absolute; left: 11px; top: 22px; bottom: 0; width: 2px; background: var(--line);
}
.aiva-admin-root .step:last-child::before { display: none; }
.aiva-admin-root .step .dot {
  position: absolute; left: 4px; top: 6px;
  width: 16px; height: 16px; border-radius: 50%;
  background: white; border: 2px solid var(--accent);
  box-shadow: 0 0 0 4px rgba(79,70,229,.08);
}
.aiva-admin-root .step.error .dot { border-color: var(--red); box-shadow: 0 0 0 4px rgba(239,68,68,.1); }
.aiva-admin-root .step.done .dot { background: var(--accent); }
.aiva-admin-root .step-card {
  background: var(--panel); border: 1px solid var(--line); border-radius: 10px;
  padding: 12px 14px; transition: border-color .15s; cursor: pointer;
}
.aiva-admin-root .step-card:hover { border-color: var(--accent); }
.aiva-admin-root .step-meta {
  display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); margin-bottom: 6px;
}
.aiva-admin-root .step-meta .actor { font-weight: 600; color: var(--text); font-size: 13px; }
.aiva-admin-root .step-meta .tag {
  font-size: 10.5px; padding: 2px 7px; border-radius: 999px;
  background: #f1f5f9; color: var(--muted); font-weight: 500;
}
.aiva-admin-root .step-meta .tag.intent { background: var(--accent-soft); color: var(--accent); }
.aiva-admin-root .step-meta .tag.tool { background: #ecfeff; color: #0e7490; }
.aiva-admin-root .step-meta .tag.tool.error { background: #fee2e2; color: #b91c1c; }
.aiva-admin-root .step-meta .tag.llm { background: #f5f3ff; color: #7c3aed; }
.aiva-admin-root .step-meta .tag.final { background: var(--green-soft); color: #15803d; }
.aiva-admin-root .step-meta .ms { margin-left: auto; font-variant-numeric: tabular-nums; font-size: 11.5px; }
.aiva-admin-root .step-title { font-size: 13.5px; font-weight: 500; margin-bottom: 6px; }
.aiva-admin-root .step-io {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px;
}
.aiva-admin-root .io-block {
  background: var(--code-bg); color: var(--code-fg); border-radius: 8px;
  padding: 10px 12px; font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  font-size: 11.5px; line-height: 1.55; overflow: auto; max-height: 220px;
}
.aiva-admin-root .io-block .io-label {
  display: block; font-size: 10px; color: #94a3b8; text-transform: uppercase;
  letter-spacing: .06em; margin-bottom: 6px; font-family: 'Inter', sans-serif;
}
.aiva-admin-root .io-block pre { margin: 0; white-space: pre-wrap; word-break: break-word; }

.aiva-admin-root .result-scroll {
  flex: 1 1 auto; height: 100%; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 18px 22px 30px;
  display: flex; flex-direction: column; gap: 16px;
  overscroll-behavior: contain;
}
.aiva-admin-root .result-scroll.result-scroll-embedded {
  padding: 0;
  gap: 0;
}
.aiva-admin-root .result-scroll.result-scroll-embedded .result-item {
  flex: 1 1 auto;
  min-height: 0;
}
.aiva-admin-root .result-item { min-width: 0; }
.aiva-admin-root .result-card {
  background: var(--panel); border: 1px solid var(--line); border-radius: 12px; overflow: hidden;
}
.aiva-admin-root .rc-head {
  padding: 12px 16px; border-bottom: 1px solid var(--line);
  display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 13.5px;
}
.aiva-admin-root .rc-head .src { margin-left: auto; font-size: 11px; color: var(--muted); font-weight: 400; }
.aiva-admin-root .rc-body { padding: 14px 16px; }
.aiva-admin-root .raw-json {
  margin: 0; padding: 12px; background: #0f172a; color: #e2e8f0;
  border-radius: 8px; font-size: 11.5px; line-height: 1.5; overflow: auto; max-height: 320px;
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  white-space: pre-wrap; word-break: break-word;
}
.aiva-admin-root .result-text { margin-bottom: 10px; font-size: 13px; }

.aiva-admin-root .cv-host { display: flex; flex-direction: column; gap: 10px; font-size: 12.5px; color: var(--text); }
.aiva-admin-root .cv-empty { color: var(--muted); font-size: 12px; padding: 12px; text-align: center; border: 1px dashed var(--line); border-radius: 8px; }

.aiva-admin-root .cv-table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
.aiva-admin-root .cv-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.aiva-admin-root .cv-table thead th {
  background: #f8fafc; color: var(--muted); font-weight: 600;
  font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em;
  text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--line);
}
.aiva-admin-root .cv-table tbody td {
  padding: 7px 10px; border-bottom: 1px solid var(--line); vertical-align: top;
}
.aiva-admin-root .cv-table tbody tr:last-child td { border-bottom: 0; }
.aiva-admin-root .cv-table tbody tr:hover { background: rgba(15,23,42,0.025); }
.aiva-admin-root .cv-num { text-align: right; }

.aiva-admin-root .cv-mono {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
.aiva-admin-root .cv-arrow { color: var(--muted-2); margin: 0 4px; }
.aiva-admin-root .cv-sub { color: var(--muted); font-size: 11.5px; }

.aiva-admin-root .cv-tag {
  display: inline-block; font-size: 10.5px; padding: 1px 7px;
  border-radius: 999px; background: var(--accent-soft); color: var(--accent);
  font-weight: 600; letter-spacing: .03em; text-transform: uppercase;
}
.aiva-admin-root .cv-pill {
  display: inline-block; font-size: 10.5px; padding: 1px 7px;
  border-radius: 999px; background: #f1f5f9; color: var(--muted);
  font-weight: 600; letter-spacing: .03em; text-transform: uppercase;
}
.aiva-admin-root .cv-pill-ok { background: var(--green-soft); color: #15803d; }
.aiva-admin-root .cv-pill-warn { background: var(--orange-soft); color: #b45309; }
.aiva-admin-root .cv-pill-bad { background: #fee2e2; color: #b91c1c; }

.aiva-admin-root .cv-panel {
  border: 1px solid var(--line); border-radius: 10px; padding: 12px;
  background: var(--panel); display: flex; flex-direction: column; gap: 10px;
}
.aiva-admin-root .cv-grid-2 {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;
}
.aiva-admin-root .cv-grid-2.cv-tight { gap: 6px 14px; }

.aiva-admin-root .cv-kv { display: flex; flex-direction: column; gap: 2px; }
.aiva-admin-root .cv-kv-label {
  font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em;
  color: var(--muted); font-weight: 600;
}
.aiva-admin-root .cv-kv-value { font-size: 12.5px; color: var(--text); word-break: break-word; }

.aiva-admin-root .cv-section-label {
  font-size: 10.5px; text-transform: uppercase; letter-spacing: .07em;
  color: var(--muted); font-weight: 700; margin-top: 4px;
}

.aiva-admin-root .cv-list { margin: 0; padding-left: 16px; }
.aiva-admin-root .cv-list li { margin: 2px 0; }
.aiva-admin-root .cv-list-tight { padding-left: 14px; font-size: 12px; }

.aiva-admin-root .cv-expense-group { display: flex; flex-direction: column; gap: 6px; }
.aiva-admin-root .cv-foot { margin-top: 4px; font-size: 12px; color: var(--muted); }

.aiva-admin-root .sidebar {
  background: var(--panel); border-left: 1px solid var(--line);
  display: flex; flex-direction: column; min-height: 0; overflow: hidden;
}
.aiva-admin-root .sb-head {
  padding: 14px 18px; border-bottom: 1px solid var(--line);
  font-weight: 600; font-size: 14px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between;
}
.aiva-admin-root .sb-head .sub { color: var(--muted); font-weight: 400; font-size: 12px; }
.aiva-admin-root .sb-tabs {
  display: flex; flex-wrap: wrap; gap: 4px; padding: 10px 12px 0;
  border-bottom: 1px solid var(--line); flex-shrink: 0;
}
.aiva-admin-root .sb-tabs .tab {
  padding: 7px 9px; font-size: 12px; border-radius: 8px 8px 0 0;
  cursor: pointer; color: var(--muted); border-bottom: 2px solid transparent; margin-bottom: -1px;
}
.aiva-admin-root .sb-tabs .tab.active { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
.aiva-admin-root .sb-list { flex: 1 1 0; min-height: 0; overflow-y: auto; padding: 12px; }
.aiva-admin-root .sb-empty { color: var(--muted); font-size: 12px; padding: 20px 4px; text-align: center; }
.aiva-admin-root .sb-section-title {
  font-size: 10.5px; text-transform: uppercase; letter-spacing: .07em;
  color: var(--muted); font-weight: 700; margin: 10px 4px 6px;
}
.aiva-admin-root .sb-section-title:first-child { margin-top: 0; }

.aiva-admin-root .sb-search { position: relative; padding: 10px 12px 4px; }
.aiva-admin-root .sb-search input {
  width: 100%;
  padding: 7px 28px 7px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 12.5px;
  background: var(--panel);
  color: var(--text);
  outline: none;
}
.aiva-admin-root .sb-search input:focus { border-color: var(--accent); }
.aiva-admin-root .sb-search-clear {
  position: absolute; right: 18px; top: 50%; transform: translateY(-40%);
  border: 0; background: transparent; color: var(--muted);
  font-size: 16px; line-height: 1; cursor: pointer; padding: 2px 6px;
}
.aiva-admin-root .sb-search-clear:hover { color: var(--text); }

.aiva-admin-root .sb-group-head {
  display: flex; align-items: center; gap: 6px;
  width: 100%;
  margin: 10px 0 6px;
  padding: 4px 4px;
  background: transparent; border: 0; cursor: pointer;
  font-size: 10.5px; text-transform: uppercase; letter-spacing: .07em;
  color: var(--muted); font-weight: 700; text-align: left;
}
.aiva-admin-root .sb-group-head:first-child { margin-top: 0; }
.aiva-admin-root .sb-group-head:hover { color: var(--text); }
.aiva-admin-root .sb-group-chev {
  display: inline-block; width: 10px; font-size: 10px; color: var(--muted-2);
}
.aiva-admin-root .sb-group-head.open .sb-group-chev { color: var(--accent); }
.aiva-admin-root .sb-group-title { flex: 1 1 auto; }
.aiva-admin-root .sb-group-count {
  background: #f1f5f9; color: var(--muted);
  font-size: 10.5px; font-weight: 700; letter-spacing: .02em;
  padding: 1px 7px; border-radius: 999px; text-transform: none;
}
.aiva-admin-root .sb-search-summary {
  font-size: 11px; color: var(--muted); padding: 8px 4px 0; text-align: center;
}
.aiva-admin-root .item {
  border: 1px solid var(--line); border-radius: 10px;
  padding: 10px 11px; margin-bottom: 8px; transition: all .15s; cursor: pointer;
}
.aiva-admin-root .item:hover { border-color: var(--accent); }
.aiva-admin-root .item.firing { border-color: var(--accent); background: var(--accent-soft); }
.aiva-admin-root .item-row { display: flex; align-items: center; gap: 10px; }
.aiva-admin-root .item-icon {
  width: 30px; height: 30px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; font-weight: 700; color: white; flex-shrink: 0;
}
.aiva-admin-root .item-name { font-size: 12.5px; font-weight: 600; line-height: 1.3; }
.aiva-admin-root .item-type { font-size: 10.5px; color: var(--muted); margin-top: 1px; }
.aiva-admin-root .item-status {
  margin-left: auto; font-size: 10px; padding: 2px 7px; border-radius: 999px;
  background: #f1f5f9; color: var(--muted); font-weight: 600; letter-spacing: .04em;
}
.aiva-admin-root .item-status.on { background: var(--green-soft); color: #15803d; }
.aiva-admin-root .item-details { margin-top: 9px; font-size: 11.5px; color: var(--muted); display: none; }
.aiva-admin-root .item.expanded .item-details { display: block; }
.aiva-admin-root .det-row {
  display: flex; justify-content: space-between; padding: 3px 0;
  border-top: 1px dashed var(--line);
}
.aiva-admin-root .det-row:first-child { border-top: 0; }
.aiva-admin-root .det-row code {
  background: #f1f5f9; padding: 1px 6px; border-radius: 4px;
  font-size: 10.5px; color: var(--text);
  font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
  max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

.aiva-admin-root ::-webkit-scrollbar { width: 8px; height: 8px; }
.aiva-admin-root ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
.aiva-admin-root ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
.aiva-admin-root ::-webkit-scrollbar-track { background: transparent; }

.aiva-admin-root .sb-manage-actions { display: flex; gap: 8px; padding: 8px 12px 4px; }
.aiva-admin-root .item.disabled { opacity: 0.65; }
.aiva-admin-root .btn-soft.primary { background: var(--accent); color: white; }
.aiva-admin-root .btn-soft svg { vertical-align: -2px; margin-right: 4px; }
.aiva-admin-root .btn-soft.logout-btn {
  color: var(--red);
  border-color: rgba(239, 68, 68, 0.3);
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.aiva-admin-root .btn-soft.logout-btn:hover {
  background: rgba(239, 68, 68, 0.08);
  border-color: var(--red);
}

.aiva-admin-root .doc-panel { display: flex; flex-direction: column; gap: 10px; }
.aiva-admin-root .doc-upload {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  border: 1px dashed #b9c3d6;
  border-radius: 10px;
  padding: 10px;
  background: #f8fafc;
  transition: border-color .15s, background .15s;
}
.aiva-admin-root .doc-upload.dragging {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.aiva-admin-root .doc-upload-icon {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e0f2fe;
  color: #0369a1;
}
.aiva-admin-root .doc-upload-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.aiva-admin-root .doc-upload-copy strong {
  font-size: 12.5px;
  color: var(--text);
  line-height: 1.2;
}
.aiva-admin-root .doc-upload-copy span {
  font-size: 10.5px;
  color: var(--muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.aiva-admin-root .doc-note {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  padding: 8px 9px;
  border-radius: 9px;
  background: #fffbeb;
  color: #92400e;
  font-size: 11.5px;
  line-height: 1.35;
}
.aiva-admin-root .doc-note svg { flex: 0 0 auto; margin-top: 1px; }
.aiva-admin-root .doc-error {
  padding: 8px 9px;
  border-radius: 9px;
  background: #fee2e2;
  color: #991b1b;
  font-size: 11.5px;
  line-height: 1.35;
}
.aiva-admin-root .doc-item {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 10px;
  background: var(--panel);
  margin-bottom: 8px;
}
.aiva-admin-root .doc-item.failed { border-color: rgba(239, 68, 68, .35); }
.aiva-admin-root .doc-item-row {
  display: flex;
  align-items: center;
  gap: 9px;
}
.aiva-admin-root .doc-file-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ecfeff;
  color: #0e7490;
  flex: 0 0 auto;
}
.aiva-admin-root .doc-file-main { flex: 1 1 auto; min-width: 0; }
.aiva-admin-root .doc-file-name {
  font-size: 12.5px;
  font-weight: 650;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.aiva-admin-root .doc-file-meta {
  font-size: 10.5px;
  color: var(--muted);
  margin-top: 1px;
}
.aiva-admin-root .doc-status {
  font-size: 9.5px;
  letter-spacing: .04em;
  text-transform: uppercase;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 999px;
  color: var(--muted);
  background: #f1f5f9;
}
.aiva-admin-root .doc-status.indexed { color: #15803d; background: var(--green-soft); }
.aiva-admin-root .doc-status.indexing { color: #0369a1; background: #e0f2fe; }
.aiva-admin-root .doc-status.failed { color: #b91c1c; background: #fee2e2; }
.aiva-admin-root .doc-error-inline {
  margin-top: 8px;
  color: #b91c1c;
  font-size: 11px;
  line-height: 1.35;
}
.aiva-admin-root .doc-item-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--line);
  color: var(--muted);
  font-size: 10.5px;
}
.aiva-admin-root .icon-btn.danger {
  color: var(--red);
  border-color: rgba(239, 68, 68, .3);
  background: white;
}
.aiva-admin-root .icon-btn.danger:hover {
  background: rgba(239, 68, 68, .08);
}

.tool-edit-overlay {
  position: fixed; inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex; align-items: center; justify-content: center;
  z-index: 50;
}
.tool-edit-modal {
  width: 520px; max-width: 92vw;
  background: #ffffff; color: #0f172a;
  border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.25);
  overflow: hidden;
  font-family: 'Inter', -apple-system, system-ui, Segoe UI, sans-serif;
}
.tool-edit-head { display: flex; align-items: center; padding: 14px 16px; border-bottom: 1px solid #e2e6ee; }
.tool-edit-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; max-height: 60vh; overflow: auto; }
.tool-edit-body label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #64748b; }
.tool-edit-body input, .tool-edit-body textarea {
  border: 1px solid #e2e6ee; border-radius: 6px; padding: 8px 10px; font-size: 13px; color: #0f172a;
  background: #f8fafc; font-family: inherit;
}
.tool-edit-body textarea { resize: vertical; }
.tool-edit-foot { display: flex; gap: 8px; justify-content: flex-end; padding: 12px 16px; border-top: 1px solid #e2e6ee; background: #f8fafc; }
`;

export default AdminPage;
