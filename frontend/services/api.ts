
import { AdminSnapshot, AgentKey, ChatMessage, LoginPayload, StreamEvent } from '../types';


export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
const WS_BASE = (import.meta.env.VITE_WS_BASE_URL || API_BASE).replace(/\/$/, '').replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
const LOGIN_API_URL = (import.meta.env.VITE_LOGIN_API_URL || `${API_BASE}/auth/login`).replace(/([^:]\/)\/+/g, '$1');
const REFRESH_API_URL = (import.meta.env.VITE_REFRESH_API_URL || `${API_BASE}/auth/refresh`).replace(/([^:]\/)\/+/g, '$1');

interface LoginApiResponse {
    success?: boolean;
    message?: string;
    data?: {
        accessToken?: string;
        refreshToken?: string;
        accessTokenExpiresIn?: string;
        refreshTokenExpiresIn?: string;
    };
}

interface LoginResult {
    success: boolean;
    message: string;
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresIn?: string;
    refreshTokenExpiresIn?: string;
}

export const apiService = {
    apiBase: API_BASE,

    async streamChat(
        body: {
            message: string;
            agent?: AgentKey;
            user_id?: string;
            session_id?: string;
            context?: Record<string, any>;
        },
        onEvent: (event: StreamEvent) => void,
        signal?: AbortSignal,
    ): Promise<void> {
        const accessToken =
            typeof body.context?.access_token === 'string' ? body.context.access_token : '';

        const response = await fetch(`${API_BASE}/chat/stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify({
                ...body,
                agent: body.agent || 'root',
                user_id: body.user_id || 'default-user',
            }),
            signal,
        });

        if (!response.ok || !response.body) {
            throw new Error(`Chat stream failed with HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                const parsed = parseSseChunk(buffer);
                if (parsed) onEvent(parsed);
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            buffer = buffer.replace(/\r\n/g, '\n');
            const chunks = buffer.split('\n\n');
            buffer = chunks.pop() || '';
            for (const chunk of chunks) {
                const parsed = parseSseChunk(chunk);
                if (parsed) onEvent(parsed);
            }
        }
    },

    async fetchArtifact(artifactId: string): Promise<any | null> {
        try {
            const res = await fetch(`${API_BASE}/artifacts/${encodeURIComponent(artifactId)}`, {
                headers: { accept: 'application/json' },
            });
            if (!res.ok) return null;
            return await res.json();
        } catch {
            return null;
        }
    },

    async fetchAdminSnapshot(): Promise<AdminSnapshot | null> {
        try {
            const res = await fetch(`${API_BASE}/admin/dashboard`, {
                headers: { accept: 'application/json' },
            });
            if (!res.ok) return null;
            return await res.json();
        } catch {
            return null;
        }
    },

    connectAdminDashboard(onSnapshot: (snapshot: AdminSnapshot) => void): WebSocket {
        const socket = new WebSocket(`${WS_BASE}/admin/dashboard/ws`);
        socket.addEventListener('message', (event) => {
            try {
                const payload = JSON.parse(event.data);
                if (payload?.type === 'snapshot' && payload.data) {
                    onSnapshot(payload.data as AdminSnapshot);
                }
            } catch (err) {
                console.warn('[admin ws] failed to parse snapshot', err);
            }
        });
        return socket;
    },

    async updateAgentStatus(agentId: string, status: 'enabled' | 'disabled' | 'maintenance'): Promise<boolean> {
        const res = await fetch(`${API_BASE}/admin/agents/${encodeURIComponent(agentId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        return res.ok;
    },

    async updateToolStatus(toolId: string, status: 'enabled' | 'disabled' | 'maintenance'): Promise<boolean> {
        const res = await fetch(`${API_BASE}/admin/tools/${encodeURIComponent(toolId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        return res.ok;
    },

    async createTool(body: {
        id: string;
        name: string;
        description?: string;
        kind: 'api' | 'mcp';
        config?: Record<string, any>;
        curl_command?: string | null;
        auth_secret_ref?: string | null;
    }): Promise<{ ok: boolean; message?: string }> {
        try {
            const res = await fetch(`${API_BASE}/admin/tools`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    description: '',
                    config: {},
                    ...body,
                    admin_user_id: 'dashboard',
                }),
            });
            if (res.ok) return { ok: true };
            let message = `Tool creation failed with HTTP ${res.status}`;
            try {
                const payload = await res.json();
                message = payload?.detail || payload?.message || message;
            } catch {
                // Keep the HTTP status fallback.
            }
            return { ok: false, message };
        } catch (error) {
            return { ok: false, message: error instanceof Error ? error.message : 'Tool creation failed.' };
        }
    },

    async fetchUserSessions(userId: string): Promise<ChatHistorySessionSummary[] | null> {
        try {
            const query = new URLSearchParams({ user_id: userId });
            const res = await fetch(`${API_BASE}/chat/sessions?${query.toString()}`, {
                headers: { accept: 'application/json' },
            });
            if (!res.ok) return null;
            const data = await res.json();
            return Array.isArray(data) ? (data as ChatHistorySessionSummary[]) : null;
        } catch (err) {
            console.warn('[user sessions] fetch failed', err);
            return null;
        }
    },

    async fetchSessionMessages(sessionId: string, context: Record<string, string> = {}): Promise<ChatMessage[] | null> {
        try {
            const query = new URLSearchParams({ limit: '50' });
            Object.entries(context).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    query.set(key, value);
                }
            });

            const res = await fetch(`${API_BASE}/sessions/${sessionId}/messages?${query.toString()}`, {
                headers: { accept: 'application/json' }
            });
            const text = await res.text();
            console.debug('[session history] raw response:', res.status, text);

            if (!res.ok) return null;

            let data: any;
            try {
                data = JSON.parse(text);
            } catch (err) {
                console.warn('[session history] response not json');
                return null;
            }

            // Support multiple shapes: array root, { messages: [...] }, { items: [...] }
            const msgsRaw = Array.isArray(data) ? data : data.messages || data.items || [];
            if (!Array.isArray(msgsRaw) || msgsRaw.length === 0) return null;

            // Map raw messages into interim objects so we can attach tool outputs
            const interim = msgsRaw.map((m: any, idx: number) => {
                const timestamp = m.timestamp || m.created_at || m.createdAt || m.time || Date.now();
                const mapped: any = {
                    id: m.id || m.message_id || `srv-${idx}-${Date.now()}`,
                    role: (m.role === 'tool' ? 'assistant' : (m.role || m.sender || (m.from === 'assistant' ? 'assistant' : (m.from === 'user' ? 'user' : (m.type === 'assistant' ? 'assistant' : 'user'))))),
                    content: m.content || m.text || m.body || '',
                    timestamp: new Date(timestamp),
                    metadata: m.metadata || m.meta || undefined,
                    toolResults: m.tool_results || m.toolResults || undefined,
                    __raw: m,
                } as ChatMessage & { __raw?: any };

                const isTool = (m.role === 'tool' || (m.from && m.from === 'tool'));
                const tool_call_id = m.tool_call_id || m.toolCallId || (m.tool_calls && m.tool_calls[0] && m.tool_calls[0].id) || null;
                return { raw: m, mapped, isTool, tool_call_id };
            });

            // Attach tool messages to their invoking assistant message where possible
            for (let i = 0; i < interim.length; i++) {
                const item = interim[i];
                if (!item.isTool) continue;

                let toolOutput: any = item.raw.content;
                try { toolOutput = JSON.parse(item.raw.content); } catch (e) { /* leave as string */ }
                const extractedToolView =
                    toolOutput?.tool_view ||
                    toolOutput?.resolved_view ||
                    (toolOutput?.tool_output && toolOutput.tool_output.resolved_view) ||
                    null;
                const fallbackText = toolOutput?.fallback_text || extractedToolView?.fallback_text;

                let attached = false;
                for (let j = i - 1; j >= 0; j--) {
                    const prev = interim[j];
                    if (!prev) continue;
                    if (prev.mapped.role === 'assistant') {
                        const prevRaw = prev.raw || {};
                        const toolCalls = prevRaw.tool_calls || prevRaw.toolCalls || [];
                        const hasCall = toolCalls.some((c: any) => c && (c.id === item.tool_call_id || c.id === item.raw.tool_call_id));
                        if (item.tool_call_id && hasCall) {
                            prev.mapped.toolResults = prev.mapped.toolResults || [];
                            prev.mapped.toolResults.push(toolOutput);
                            if (extractedToolView) {
                                prev.mapped.toolViews = prev.mapped.toolViews || [];
                                prev.mapped.toolViews.push(extractedToolView);
                                if (!prev.mapped.content && fallbackText) prev.mapped.content = fallbackText;
                            }
                            attached = true;
                            break;
                        }
                    }
                }

                if (!attached) {
                    // convert into an assistant message
                    item.mapped.role = 'assistant';
                    item.mapped.content = fallbackText || (typeof toolOutput === 'string' ? toolOutput : JSON.stringify(toolOutput, null, 2));
                    if (extractedToolView) {
                        item.mapped.toolViews = [extractedToolView];
                    }
                }
            }

            const mappedMessages = interim.filter(it => !it.isTool).map(it => it.mapped as ChatMessage);
            const dedupedMessages: ChatMessage[] = [];

            for (const message of mappedMessages) {
                const previous = dedupedMessages[dedupedMessages.length - 1];
                if (
                    previous &&
                    previous.role === 'assistant' &&
                    message.role === 'assistant' &&
                    normalizeMessageContent(previous.content) === normalizeMessageContent(message.content) &&
                    serializeOptional(previous.toolViews) === serializeOptional(message.toolViews) &&
                    serializeOptional(previous.toolResults) === serializeOptional(message.toolResults)
                ) {
                    dedupedMessages[dedupedMessages.length - 1] = {
                        ...previous,
                        metadata: message.metadata || previous.metadata,
                        timestamp: message.timestamp || previous.timestamp,
                    };
                    continue;
                }

                dedupedMessages.push(message);
            }

            return dedupedMessages;
        } catch (err) {
            console.warn('[session history] fetch failed', err);
            return null;
        }
    },

    async login(payload: LoginPayload): Promise<LoginResult> {
        try {
            const response = await fetch(LOGIN_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    companyId: payload.companyId,
                    accountNo: payload.accountNo || '',
                    userName: payload.userName,
                    password: payload.password,
                    source: payload.source
                })
            });

            const text = await response.text();
            let body: LoginApiResponse = {};
            try {
                body = text ? JSON.parse(text) : {};
            } catch {
                body = {};
            }

            if (!response.ok) {
                return {
                    success: false,
                    message: body.message || 'Login failed. Please verify credentials.'
                };
            }

            if (!body.success || !body.data?.accessToken) {
                return {
                    success: false,
                    message: body.message || 'Login failed. No access token returned.'
                };
            }

            return {
                success: true,
                message: body.message || 'Login successful',
                ...body.data
            };
        } catch (error) {
            console.error('[login] request failed', error);
            return {
                success: false,
                message: 'Unable to login at the moment. Please try again.'
            };
        }
    },

    async refreshToken(refreshToken: string): Promise<LoginResult> {
        try {
            const response = await fetch(REFRESH_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });

            const text = await response.text();
            let body: LoginApiResponse = {};
            try {
                body = text ? JSON.parse(text) : {};
            } catch {
                body = {};
            }

            if (!response.ok) {
                return {
                    success: false,
                    message: body.message || `Refresh failed (${response.status}).`
                };
            }

            if (!body.success || !body.data?.accessToken) {
                return {
                    success: false,
                    message: body.message || 'Refresh failed. No access token returned.'
                };
            }

            return {
                success: true,
                message: body.message || 'Refresh successful',
                ...body.data
            };
        } catch (error) {
            console.error('[refresh] request failed', error);
            return {
                success: false,
                message: 'Unable to refresh token at the moment.'
            };
        }
    },

    async saveMemory(content: string, options?: { sessionId?: string; tags?: string[]; metadata?: Record<string, any> }): Promise<{ doc_id?: string } | null> {
        try {
            const body: Record<string, any> = { content };
            if (options?.sessionId) body.session_id = options.sessionId;
            if (options?.tags?.length) body.tags = options.tags;
            if (options?.metadata) body.metadata = options.metadata;

            const res = await fetch(`${API_BASE}/memory`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    accept: 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!res.ok) return null;
            const data = await res.json();
            return data?.result || null;
        } catch (err) {
            console.warn('[memory] save failed', err);
            return null;
        }
    },

    async uploadReceipt(file: File): Promise<{ file_path: string; filename: string } | null> {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch(`${API_BASE}/upload/receipt`, {
                method: 'POST',
                body: formData,
                headers: {
                    accept: 'application/json'
                }
            });

            if (!res.ok) return null;
            return await res.json();
        } catch (err) {
            console.error('[upload receipt] failed', err);
            return null;
        }
    },

    async uploadFile(file: File, options?: { sessionId?: string; index?: boolean }): Promise<UploadFileResponse | null> {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const params = new URLSearchParams();
            if (options?.sessionId) params.set('session_id', options.sessionId);
            if (options?.index === false) params.set('index', 'false');
            const qs = params.toString() ? `?${params}` : '';

            const res = await fetch(`${API_BASE}/upload/file${qs}`, {
                method: 'POST',
                body: formData,
                headers: { accept: 'application/json' }
            });

            if (!res.ok) return null;
            return await res.json();
        } catch (err) {
            console.error('[upload file] failed', err);
            return null;
        }
    },

    async transcribeVoice(blob: Blob, options?: { sessionId?: string; filename?: string }): Promise<{ transcript: string; file_path: string } | null> {
        try {
            const formData = new FormData();
            const filename = options?.filename || `voice-${Date.now()}.webm`;
            formData.append('file', blob, filename);

            const params = new URLSearchParams();
            if (options?.sessionId) params.set('session_id', options.sessionId);
            const qs = params.toString() ? `?${params}` : '';

            const res = await fetch(`${API_BASE}/upload/voice${qs}`, {
                method: 'POST',
                body: formData,
                headers: { accept: 'application/json' }
            });

            if (!res.ok) return null;
            const data = await res.json();
            if (data?.error) {
                console.warn('[transcribe voice] backend error:', data.error);
            }
            return { transcript: data?.transcript || '', file_path: data?.file_path || '' };
        } catch (err) {
            console.error('[transcribe voice] failed', err);
            return null;
        }
    }

};

export interface ChatHistorySessionSummary {
    id: string;
    user_id: string;
    agent_id: string;
    title: string;
    status: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    created_at: string;
    updated_at: string;
}

export interface UploadFileResponse {
    file_path: string;
    filename: string;
    kind: string;
    mime_type?: string | null;
    text?: string;
    summary?: string;
    extras?: Record<string, any>;
    indexed: boolean;
    doc_id?: string | null;
    error?: string | null;
}

function normalizeMessageContent(content: string | undefined): string {
    return (content || '').replace(/\s+/g, ' ').trim();
}

function serializeOptional(value: unknown): string {
    if (value === undefined || value === null) return '';
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function parseSseChunk(chunk: string): StreamEvent | null {
    const normalized = chunk.replace(/\r\n/g, '\n').trim();
    if (!normalized) return null;
    const lines = normalized.split('\n');
    const type = lines.find((line) => line.startsWith('event:'))?.slice(6).trim();
    const data = lines
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('\n');
    if (!type || !data) return null;
    return { type, data: JSON.parse(data) } as StreamEvent;
}
