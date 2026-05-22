import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgentKey, ChatMessage, ResolvedToolView, StreamEvent, ToolResult } from '../types';
import { apiService } from '../services/api';

interface UseChatProps {
  sessionId: string;
  contextParams?: Record<string, any>;
  enabled?: boolean;
  agent?: AgentKey;
  userId?: string;
  onStreamEvent?: (event: StreamEvent) => void;
}

export const useChat = ({
  sessionId,
  contextParams,
  enabled = true,
  agent = 'root',
  userId = 'default-user',
  onStreamEvent,
}: UseChatProps) => {
  const abortRef = useRef<AbortController | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isConnected, setIsConnected] = useState(enabled);
  const [messages, setMessages] = useState<ChatMessage[]>(() => readStoredMessages(sessionId));

  const stableContext = useMemo(
    () => ({ ...(contextParams || {}), channel: 'chat' }),
    [JSON.stringify(contextParams || {})],
  );

  useEffect(() => {
    setIsConnected(enabled);
  }, [enabled]);

  useEffect(() => {
    setMessages(readStoredMessages(sessionId));
  }, [sessionId]);

  useEffect(() => {
    try {
      localStorage.setItem(`omniagent:messages:${sessionId}`, JSON.stringify(messages));
    } catch {
      // Local persistence is best effort only.
    }
  }, [messages, sessionId]);

  const upsertAssistant = useCallback((updater: (current?: ChatMessage) => ChatMessage) => {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.role === 'assistant' && (last.isStreaming || !last.content.trim())) {
        next[next.length - 1] = updater(last);
        return next;
      }
      next.push(updater(undefined));
      return next;
    });
  }, []);

  const attachToolView = useCallback(async (payload: Record<string, any>) => {
    const envelope = findArtifactEnvelope(payload);
    const artifactId = envelope?.artifact_id;
    const component = envelope?.ui_component;
    const toolName = extractToolName(payload);

    let artifact: any | null = null;
    if (artifactId) {
      artifact = await apiService.fetchArtifact(String(artifactId));
    }

    const viewType = normalizeViewType(String(component || artifact?.component || toolName || 'tool_result'));
    const normalizedPayload = normalizeArtifactPayload(viewType, artifact?.payload ?? payload, artifact?.summary);
    const fallbackText = meaningfulFallback(artifact?.summary?.title || envelope?.message);
    const toolResult: ToolResult = {
      tool_name: toolName,
      success: true,
      artifact_id: artifactId,
      ui_component: component,
      payload: artifact?.payload ?? payload,
      summary: artifact?.summary,
      custom_ui: {
        view_type: viewType,
        payload: normalizedPayload,
        fallback_text: fallbackText,
      },
    };
    const toolView: ResolvedToolView = {
      tool_name: toolName,
      channel: 'chat',
      view: {
        view_type: viewType,
        payload: normalizedPayload,
        fallback_text: fallbackText,
      },
      fallback_text: fallbackText,
      metadata: { artifact_id: artifactId, component },
    };
    const resultKey = toolResultKey(toolView, toolResult);

    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i -= 1) {
        if (next[i].role !== 'assistant') continue;
        const existingViews = next[i].toolViews || [];
        const existingResults = next[i].toolResults || [];
        const alreadyAttached =
          existingViews.some((view, idx) => toolResultKey(view, existingResults[idx]) === resultKey) ||
          existingResults.some((result) => toolResultKey(undefined, result) === resultKey);
        if (alreadyAttached) return next;
        next[i] = {
          ...next[i],
          content: next[i].content || fallbackText,
          toolViews: [...existingViews, toolView],
          toolResults: [...existingResults, toolResult],
        };
        return next;
      }
      return [
        ...next,
        {
          id: `tool-${Date.now()}-${Math.random()}`,
          role: 'assistant',
          content: fallbackText,
          timestamp: new Date(),
          toolViews: [toolView],
          toolResults: [toolResult],
        },
      ];
    });
  }, []);

  const handleStreamEvent = useCallback(async (event: StreamEvent) => {
    onStreamEvent?.(event);

    if (event.type === 'message') {
      const text = event.data.text || '';
      upsertAssistant((current) => ({
        id: current?.id || `assistant-${Date.now()}-${Math.random()}`,
        role: 'assistant',
        content: mergeStreamingText(current?.content || '', text, Boolean(event.data.final)),
        timestamp: current?.timestamp || new Date(),
        metadata: current?.metadata,
        toolResults: current?.toolResults,
        toolViews: current?.toolViews,
        isStreaming: !event.data.final,
      }));
      return;
    }

    if (event.type === 'tool_response') {
      await attachToolView(event.data);
      return;
    }

    if (event.type === 'error') {
      upsertAssistant((current) => ({
        id: current?.id || `error-${Date.now()}-${Math.random()}`,
        role: 'assistant',
        content: `### Warning\n${event.data.message}`,
        timestamp: current?.timestamp || new Date(),
        metadata: current?.metadata,
        toolResults: current?.toolResults,
        toolViews: current?.toolViews,
        isStreaming: false,
      }));
    }
  }, [attachToolView, onStreamEvent, upsertAssistant]);

  const sendMessage = useCallback(async (text: string, metadata?: Record<string, any>) => {
    if ((!text.trim() && !metadata) || !enabled || isThinking) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const messageId = `msg-${Date.now()}-${Math.random()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: messageId,
        role: 'user',
        content: text,
        timestamp: new Date(),
        metadata: { ...metadata, messageId },
      },
      {
        id: `assistant-${messageId}`,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true,
      },
    ]);

    setIsThinking(true);
    setIsConnected(true);

    try {
      await apiService.streamChat(
        {
          message: text || summarizeAttachment(metadata),
          session_id: sessionId,
          user_id: userId,
          agent,
          context: stableContext,
        },
        (event) => {
          void handleStreamEvent(event);
        },
        controller.signal,
      );
    } catch (err) {
      if (!controller.signal.aborted) {
        const message = err instanceof Error ? err.message : 'Chat request failed.';
        await handleStreamEvent({ type: 'error', data: { message } });
      }
    } finally {
      setIsThinking(false);
      setMessages((prev) => prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg)));
    }
  }, [agent, enabled, handleStreamEvent, isThinking, sessionId, stableContext, userId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    try {
      localStorage.removeItem(`omniagent:messages:${sessionId}`);
    } catch {
      // ignore
    }
  }, [sessionId]);

  const injectMockMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const stopChat = useCallback(() => {
    abortRef.current?.abort();
    setIsThinking(false);
    setMessages((prev) => prev.map((msg) => (msg.isStreaming ? { ...msg, isStreaming: false } : msg)));
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    messages,
    isConnected,
    isThinking,
    sendMessage,
    clearMessages,
    injectMockMessage,
    stopChat,
  };
};

function readStoredMessages(sessionId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(`omniagent:messages:${sessionId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    return parsed.map((m) => ({ ...m, timestamp: new Date(m.timestamp as any), isStreaming: false }));
  } catch {
    return [];
  }
}

function mergeStreamingText(current: string, incoming: string, final: boolean): string {
  if (!incoming) return current;
  if (!current || incoming.startsWith(current) || final) return incoming;
  if (current.endsWith(incoming)) return current;
  return `${current}${incoming}`;
}

function toolResultKey(view?: ResolvedToolView, result?: ToolResult): string {
  const artifactId = String(view?.metadata?.artifact_id || result?.artifact_id || '');
  const component = String(view?.metadata?.component || result?.ui_component || '');
  const toolName = String(view?.tool_name || result?.tool_name || '');
  const viewType = String(view?.view?.view_type || (result?.custom_ui as any)?.view_type || '');
  if (artifactId) return [artifactId, component, toolName, viewType].join('::');
  return [component, toolName, viewType, stableStringify(view?.view?.payload ?? result?.payload ?? result)].join('::');
}

function meaningfulFallback(value: unknown): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text === 'Tool result ready.' ? '' : text;
}

function stableStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function findArtifactEnvelope(value: unknown): any {
  if (!value || typeof value !== 'object') return null;
  const node = value as any;
  if (node.ui_component && node.artifact_id) return node;
  for (const child of Object.values(node)) {
    const found = findArtifactEnvelope(child);
    if (found) return found;
  }
  return null;
}

function extractToolName(value: unknown): string {
  if (!value || typeof value !== 'object') return 'tool';
  const node = value as any;
  return String(node.name || node.tool_name || node.function_name || node.id || node.response?.name || 'tool');
}

function normalizeViewType(component: string): string {
  const aliases: Record<string, string> = {
    flight_search_results: 'flight_results',
    booking_details: 'booking_card',
    fare_rule: 'fare_rules',
  };
  return aliases[component] || component;
}

function normalizeArtifactPayload(viewType: string, payload: any, summary?: Record<string, any>): any {
  if (viewType === 'flight_results') {
    if (Array.isArray(payload?.flights) && payload?.summary) return payload;
    const offers = collectOfferLikeRows(payload).slice(0, 80);
    if (!offers.length) return payload;
    return {
      summary: {
        origin: summary?.origin || summary?.route?.split('-')?.[0]?.trim() || '',
        destination: summary?.destination || summary?.route?.split('-')?.[1]?.trim() || '',
        depart_date: summary?.depart_date || '',
        return_date: summary?.return_date || null,
        trip_type: summary?.return_date ? 'RT' : 'OW',
        cabin: summary?.cabin || '',
        pax: { adults: 1, children: 0, infants: 0 },
        currency: offers[0]?.price?.currency || 'INR',
        total_results: offers.length,
      },
      flights: offers,
      metadata: { source: 'artifact' },
    };
  }

  if (viewType === 'booking_card') {
    const data = payload?.data ?? payload;
    const master = data?.bookingDetails?.masterDetails ?? data?.masterDetails ?? data;
    return {
      booking: {
        reference: master?.bookingRef || summary?.booking_ref || master?.reference || '',
        status: String(master?.status || 'confirmed').toLowerCase(),
        passengerName: master?.passengerName || master?.leadPassenger || '',
        flight: {
          airline: master?.airline || '',
          flightNumber: master?.flightNumber || '',
          origin: master?.originCode || master?.origin || '',
          destination: master?.destinationCode || master?.destination || '',
          date: master?.tripStartDate || '',
        },
      },
    };
  }

  return payload;
}

function collectOfferLikeRows(value: any): any[] {
  const rows: any[] = [];
  const visit = (node: any) => {
    if (!node || rows.length > 120) return;
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (typeof node !== 'object') return;

    const keys = Object.keys(node).map((key) => key.toLowerCase());
    const looksLikeOffer =
      keys.some((key) => key.includes('offerid') || key === 'id') &&
      keys.some((key) => key.includes('total') || key.includes('price') || key.includes('amount'));
    if (looksLikeOffer) rows.push(flattenOffer(node));
    Object.values(node).forEach(visit);
  };
  visit(value);
  return rows;
}

function flattenOffer(offer: any) {
  const text = JSON.stringify(offer);
  const amountText =
    text.match(/"totalAmount"?\s*:\s*"?([^",}]+)/)?.[1] ||
    text.match(/"amount"?\s*:\s*"?([^",}]+)/)?.[1] ||
    '0';
  const totalAmount = Number(String(amountText).replace(/[^\d.]/g, '')) || 0;
  const origin = offer.origin || offer.departureAirport || offer.from || '';
  const destination = offer.destination || offer.arrivalAirport || offer.to || '';
  return {
    id: String(offer.offerId || offer.offerID || offer.id || Math.random()),
    offerID: String(offer.offerId || offer.offerID || offer.id || ''),
    validatingCarrierCode: offer.ownerCode || offer.airlineCode || offer.OwnerCode || 'Carrier',
    airlineCode: offer.ownerCode || offer.airlineCode || offer.OwnerCode || '',
    airlineName: offer.airlineName || offer.owner || offer.ownerCode || offer.airlineCode || 'Carrier',
    price: { totalAmount, currency: offer.currency || offer.Currency || 'INR' },
    legs: [
      {
        direction: 'OUT',
        departureAirport: origin,
        arrivalAirport: destination,
        stops: Number(offer.stops || 0),
        stopAirports: [],
        segments: [],
      },
    ],
    raw_offer: offer,
  };
}

function summarizeAttachment(metadata?: Record<string, any>): string {
  const attachment = metadata?.attachment;
  if (!attachment) return 'Process the attached input.';
  return `Process the attached file ${attachment.filename || attachment.file_path || ''}`.trim();
}
