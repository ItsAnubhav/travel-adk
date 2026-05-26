import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Bot, MessageSquare, LayoutPanelLeft } from 'lucide-react';
import { useSession } from '../hooks/useSession';
import { useChat } from '../hooks/useChat';
import { LoginPayload } from '../types';
import { apiService } from '../services/api';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/chat/ChatInput';
import ThinkingIndicator from '../components/chat/ThinkingIndicator';
import Sidebar from '../components/layout/Sidebar';
import Header from '../components/layout/Header';
import ResultView from '../components/ResultView';
import { extractRichResults, RichResult } from '../components/RichResultRenderer';
import { mockExpenseReportResponse } from '../mocks/expenseReport';

type ActiveTab = 'chat' | 'result';


const DateSeparator: React.FC<{ date: Date }> = ({ date }) => (
  <div className="flex items-center gap-4 my-6 px-8">
    <div className="flex-1 h-px bg-slate-800" />
    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">
      {date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
    </span>
    <div className="flex-1 h-px bg-slate-800" />
  </div>
);

interface ChatPageProps {
  loginPayload: LoginPayload;
  embedMode?: boolean;
}

const readEmbedTabPreference = (): ActiveTab | null => {
  const search = new URLSearchParams(window.location.search);
  const tab = (search.get('tab') || '').toLowerCase();
  if (tab === 'chat' || tab === 'result') return tab as ActiveTab;
  return null;
};

const TOKEN_SESSION_KEY = 'aiva:loginTokens';

const readAccessToken = (): string => {
  try {
    const raw = localStorage.getItem(TOKEN_SESSION_KEY) || sessionStorage.getItem(TOKEN_SESSION_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { accessToken?: string };
    return parsed?.accessToken || '';
  } catch {
    return '';
  }
};

const ChatPage: React.FC<ChatPageProps> = ({ loginPayload, embedMode = false }) => {
  const params = useSession();
  const defaultSessionContext = React.useMemo(() => {
    const now = new Date();
    const base: Record<string, any> = {
      company_id: loginPayload.companyId || params.cId,
      accountNo: loginPayload.accountNo,
      name: loginPayload.userName,
      user_name: loginPayload.userName,
      source: loginPayload.source,
      uid: loginPayload.uid,
      sa_user_id: loginPayload.saUserId,
      subagent_id: loginPayload.subAgentId,
      client_id: loginPayload.subAgentId,
      corporate_id: loginPayload.corporateId,
      access_token: readAccessToken(),
      current_date: now.toISOString(),
      current_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    if (params.bRef && params.bRef !== 'N/A') {
      base.booking_ref = params.bRef;
    }

    return Object.fromEntries(
      Object.entries(base).filter(([, value]) => value !== undefined && value !== null && value !== '' && value !== 'N/A')
    );
  }, [params.bRef, params.cId, loginPayload]);

  const { messages, isConnected, isThinking, sendMessage, clearMessages, injectMockMessage } = useChat({
    sessionId: params.sid,
    contextParams: defaultSessionContext,
    enabled: true
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShouldAutoScroll(isNearBottom);
  };

  useEffect(() => {
    if (scrollRef.current && shouldAutoScroll) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isThinking]);

  const richResults = useMemo<RichResult[]>(() => {
    const out: RichResult[] = [];
    for (const m of messages) out.push(...extractRichResults(m));
    return out;
  }, [messages]);

  const embedTabPreference = useMemo(() => (embedMode ? readEmbedTabPreference() : null), [embedMode]);
  const [activeTab, setActiveTab] = useState<ActiveTab>(embedTabPreference || 'chat');
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const seenResultIdsRef = useRef<Set<string>>(new Set());
  const embedReadyPostedRef = useRef(false);

  const postToEmbedHost = React.useCallback((payload: Record<string, any>) => {
    if (!embedMode || typeof window === 'undefined' || window.parent === window) return;
    try {
      window.parent.postMessage({ source: 'aiva', ...payload }, '*');
    } catch (err) {
      console.warn('[embed] postMessage failed', err);
    }
  }, [embedMode]);

  useEffect(() => {
    if (!embedMode || embedReadyPostedRef.current) return;
    embedReadyPostedRef.current = true;
    postToEmbedHost({ type: 'aiva:ready', sessionId: params.sid });
  }, [embedMode, params.sid, postToEmbedHost]);

  useEffect(() => {
    if (!embedMode) return;
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object' || data.source === 'aiva') return;
      const type = data.type;
      if (type === 'aiva:select.result' && typeof data.id === 'string') {
        setSelectedResultId(data.id);
        setActiveTab('result');
        return;
      }
      if (type === 'aiva:set.tab' && (data.tab === 'chat' || data.tab === 'result')) {
        setActiveTab(data.tab as ActiveTab);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [embedMode]);

  useEffect(() => {
    const seen = seenResultIdsRef.current;
    const newOnes = richResults.filter(r => !seen.has(r.id));
    newOnes.forEach(r => seen.add(r.id));

    // Auto-switch only for fresh results (created in the last ~4s) so historical
    // results loaded from localStorage / server history don't yank focus.
    const now = Date.now();
    const recent = newOnes.filter(r => now - r.timestamp.getTime() < 4000);
    recent.forEach(r => postToEmbedHost({
      type: 'aiva:result.created',
      id: r.id,
      kind: r.kind,
      label: r.label,
      timestamp: r.timestamp.toISOString(),
    }));

    if (recent.length) {
      const newest = recent[recent.length - 1];
      setSelectedResultId(newest.id);
      if (!embedTabPreference) setActiveTab('result');
      return;
    }

    if (!selectedResultId && richResults.length) {
      setSelectedResultId(richResults[richResults.length - 1].id);
    }
  }, [richResults, selectedResultId, postToEmbedHost, embedTabPreference]);

  useEffect(() => {
    if (!embedMode || !selectedResultId) return;
    postToEmbedHost({ type: 'aiva:result.selected', id: selectedResultId });
  }, [embedMode, selectedResultId, postToEmbedHost]);

  const handleViewResult = React.useCallback((id: string) => {
    setSelectedResultId(id);
    setActiveTab('result');
  }, []);

  const handleSlashCommand = React.useCallback(async (command: string, args: string) => {
    const now = new Date();
    if (command === 'memory') {
      if (!args) {
        injectMockMessage({
          id: 'mem-help-' + Date.now(),
          role: 'assistant',
          content: 'Usage: `/memory <text>` — saves <text> to long-term memory.',
          timestamp: now,
        });
        return;
      }
      const saved = await apiService.saveMemory(args, { sessionId: params.sid });
      injectMockMessage({
        id: 'mem-' + Date.now(),
        role: 'assistant',
        content: saved
          ? `Saved to memory: "${args.length > 120 ? args.slice(0, 117) + '...' : args}"`
          : 'Could not save memory. Please try again.',
        timestamp: now,
      });
      return;
    }

    injectMockMessage({
      id: 'cmd-unknown-' + Date.now(),
      role: 'assistant',
      content: `Unknown command: /${command}`,
      timestamp: now,
    });
  }, [injectMockMessage, params.sid]);

  const startNewChat = React.useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('session_id');
    window.location.href = url.toString();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      if (key === 'k') {
        e.preventDefault();
        window.dispatchEvent(new Event('chat:focus-input'));
        return;
      }

      if (key === 'n' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        startNewChat();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [startNewChat]);

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ text: string }>;
      if (customEvent.detail?.text) {
        sendMessage(customEvent.detail.text);
        setActiveTab('chat');
      }
    };
    window.addEventListener('aiva:send-message', handler);
    return () => window.removeEventListener('aiva:send-message', handler);
  }, [sendMessage]);

  const renderMessages = () => {
    const rendered: React.ReactNode[] = [];
    let lastDate: string | null = null;

    messages.forEach((msg) => {
      const dateStr = msg.timestamp.toDateString();
      if (dateStr !== lastDate) {
        rendered.push(<DateSeparator key={`sep-${dateStr}`} date={msg.timestamp} />);
        lastDate = dateStr;
      }
      rendered.push(<ChatMessage key={msg.id} message={msg} onViewResult={handleViewResult} onSendMessage={sendMessage} />);
    });

    if (isThinking) {
      rendered.push(<ThinkingIndicator key="thinking" />);
    }

    return rendered;
  };

  const hideTabBar = embedMode && embedTabPreference !== null;

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {!embedMode && (
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          params={params}
          isConnected={isConnected}
          onReset={clearMessages}
        />
      )}

      <main className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
        {!embedMode && <Header onMenuClick={() => setIsSidebarOpen(true)} />}

        {!hideTabBar && (
        <div className="flex items-center gap-1 px-4 md:px-8 pt-2 pb-1 border-b border-slate-800/40 bg-slate-950/60 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'chat'
                ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <MessageSquare size={14} />
            Chat
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('result')}
            className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'result'
                ? 'bg-indigo-600/20 text-indigo-200 border border-indigo-500/40'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <LayoutPanelLeft size={14} />
            Result
            {richResults.length > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 text-[10px] rounded-md font-bold ${
                activeTab === 'result'
                  ? 'bg-indigo-500/30 text-indigo-100'
                  : 'bg-slate-800 text-slate-300'
              }`}>
                {richResults.length}
              </span>
            )}
          </button>
        </div>
        )}

        {activeTab === 'result' && (
          <div className="flex-1 min-h-0 flex flex-col">
            <ResultView
              results={richResults}
              selectedId={selectedResultId}
              onSelect={setSelectedResultId}
            />
          </div>
        )}

        {activeTab === 'chat' && (
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto custom-scrollbar px-2 pt-6 sm:px-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 max-w-2xl mx-auto text-center">
              <div className="w-20 h-20 bg-indigo-600/10 rounded-3xl flex items-center justify-center text-indigo-500 mb-8 border border-indigo-500/20 shadow-2xl">
                <Bot size={44} />
              </div>
              <h2 className="text-3xl font-extrabold text-white mb-4">System Operational</h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-10 max-w-sm">
                Connected with session <code>{params.sid.slice(0, 12)}...</code>. Parameters synchronized for <strong>{loginPayload.companyId || params?.cId}</strong>.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {["Check workflow status", "Analyze active context"].map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="px-5 py-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-2xl text-xs text-slate-400 text-left transition-all"
                  >
                    {q}
                  </button>
                ))}
                <button
                  onClick={() => {
                    injectMockMessage({
                      id: 'test-rich-ui',
                      role: 'assistant',
                      content: 'Here are the flight results and payment options you requested.',
                      timestamp: new Date(),
                      toolResults: [
                        {
                          tool_name: 'search_flights',
                          success: true,
                          flights: [
                            {
                              id: 'f1',
                              airline: 'TechAir',
                              airlineCode: 'TA',
                              flightNumber: 'TA123',
                              departure: { city: 'San Francisco', code: 'SFO', time: '08:00 AM' },
                              arrival: { city: 'New York', code: 'JFK', time: '04:30 PM' },
                              duration: '5h 30m',
                              price: { amount: 450, currency: '$' },
                              stops: 0
                            },
                            {
                              id: 'f2',
                              airline: 'CloudJet',
                              airlineCode: 'CJ',
                              flightNumber: 'CJ456',
                              departure: { city: 'San Francisco', code: 'SFO', time: '10:15 AM' },
                              arrival: { city: 'New York', code: 'JFK', time: '07:45 PM' },
                              duration: '6h 30m',
                              price: { amount: 380, currency: '$' },
                              stops: 1
                            }
                          ]
                        },
                        {
                          tool_name: 'list_credit_cards',
                          success: true,
                          cards: [
                            {
                              id: 'c1',
                              type: 'visa',
                              last4: '4242',
                              cardHolder: 'John Doe',
                              expiry: '12/25',
                              issuer: 'Chase'
                            },
                            {
                              id: 'c2',
                              type: 'mastercard',
                              last4: '8888',
                              cardHolder: 'John Doe',
                              expiry: '09/26',
                              issuer: 'Citi'
                            }
                          ]
                        }
                      ]
                    });
                  }}
                  className="px-5 py-4 bg-indigo-900/20 hover:bg-indigo-900/40 border border-indigo-500/30 rounded-2xl text-xs text-indigo-300 text-left transition-all col-span-1 sm:col-span-2"
                >
                  Test Rich UI (Flights & Cards)
                </button>

                <button
                  onClick={() => {
                    injectMockMessage({
                      id: 'test-booking',
                      role: 'assistant',
                      content: 'Here is the detailed itinerary for your confirmed booking. This message now features a split layout to view your conversational response on the right alongside the beautiful itinerary widget on the left.',
                      timestamp: new Date(),
                      toolViews: [
                        {
                          channel: 'chat',
                          view: {
                            view_type: 'booking_itinerary',
                            payload: {
                              booking_ref: 'AIVA-8821',
                              booking_status: 'confirmed',
                              booking_date: '2024-10-01T10:30:00Z',
                              passengers: [
                                { id: 'p1', name: 'Jane Smith', type: 'Adult' },
                                { id: 'p2', name: 'John Doe', type: 'Adult' }
                              ],
                              itinerary: [
                                {
                                  airline: 'TechAir',
                                  flight_number: 'TA-999',
                                  origin: 'SFO',
                                  destination: 'LHR',
                                  departure: '2024-10-15T08:00:00Z',
                                  arrival: '2024-10-15T21:00:00Z',
                                  status: 'confirmed'
                                },
                                {
                                  airline: 'TechAir',
                                  flight_number: 'TA-1000',
                                  origin: 'LHR',
                                  destination: 'CDG',
                                  departure: '2024-10-16T10:00:00Z',
                                  arrival: '2024-10-16T12:00:00Z',
                                  status: 'confirmed'
                                }
                              ]
                            }
                          }
                        }
                      ],
                      toolResults: [
                        {
                          tool_name: 'get_booking_details',
                          success: true,
                          booking: {
                            reference: 'AIVA-8821',
                            status: 'confirmed',
                            passengerName: 'Jane Smith',
                            flight: {
                              airline: 'TechAir',
                              flightNumber: 'TA-999',
                              origin: 'San Francisco (SFO)',
                              destination: 'London (LHR)',
                              date: 'Mon, 15 Oct 2024'
                            }
                          }
                        }
                      ]
                    });
                  }}
                  className="px-5 py-4 bg-emerald-900/20 hover:bg-emerald-900/40 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 text-left transition-all"
                >
                  Test Booking Details
                </button>

                <button
                  onClick={() => {
                    injectMockMessage({
                      id: 'test-expense-report',
                      role: 'assistant',
                      content: 'Here is your expense report.',
                      timestamp: new Date(),
                      toolResults: [
                        {
                          tool_name: 'get_expense_report',
                          success: true,
                          report: mockExpenseReportResponse
                        }
                      ]
                    });
                  }}
                  className="px-5 py-4 bg-cyan-900/20 hover:bg-cyan-900/40 border border-cyan-500/30 rounded-2xl text-xs text-cyan-300 text-left transition-all"
                >
                  Test Expense Report
                </button>


                <button
                  onClick={() => {
                    injectMockMessage({
                      id: 'test-policies',
                      role: 'assistant',
                      content: 'Here are the fare rules and cancellation policy for your trip.',
                      timestamp: new Date(),
                      toolResults: [
                        {
                          tool_name: 'get_fare_rules',
                          success: true,
                          rules: [
                            { title: 'Cancellation', description: 'Refundable with a fee of $150 before departure.', category: 'cancellation', fee: '$150' },
                            { title: 'Baggage', description: '2 Checked bags included (23kg each).', category: 'baggage' }
                          ]
                        },
                        {
                          tool_name: 'get_cancellation_policy',
                          success: true,
                          policy: {
                            refundable: true,
                            deadline: '24 hours before flight',
                            notes: ['Full refund within 24h of booking', 'Fee applies thereafter']
                          }
                        }
                      ]
                    });
                  }}
                  className="px-5 py-4 bg-amber-900/20 hover:bg-amber-900/40 border border-amber-500/30 rounded-2xl text-xs text-amber-300 text-left transition-all"
                >
                  Test Policies
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col w-full pb-10">
              {renderMessages()}
            </div>
          )}
        </div>
        )}

        <ChatInput
          onSend={sendMessage}
          onSlashCommand={handleSlashCommand}
          disabled={!isConnected}
          placeholder={isConnected ? 'Send message...' : 'Connecting...'}
        />
      </main>
    </div>
  );
};

export default ChatPage;
