import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RotateCcw, Send, Copy, Check, AlertTriangle } from 'lucide-react';
import {
    callFlightApi,
    FLIGHT_BASE_URL,
    FlightApiResult,
    FlightEndpointDef,
} from '../../services/flightTestApi';
import ResponseSummary from './ResponseSummary';

interface ApiTestPanelProps {
    endpoint: FlightEndpointDef;
    sampleRequest: any;
    initialRequest?: any;
    accessToken?: string | null;
    onResult?: (result: FlightApiResult) => void;
}

const ApiTestPanel: React.FC<ApiTestPanelProps> = ({ endpoint, sampleRequest, initialRequest, accessToken, onResult }) => {
    const seed = initialRequest ?? sampleRequest;
    const [requestText, setRequestText] = useState<string>(() => JSON.stringify(seed, null, 2));
    const [requestError, setRequestError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<FlightApiResult | null>(null);
    const [copied, setCopied] = useState<'request' | 'response' | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (initialRequest === undefined) return;
        setRequestText(JSON.stringify(initialRequest, null, 2));
    }, [initialRequest]);

    const fullUrl = useMemo(() => `${FLIGHT_BASE_URL}${endpoint.path}`, [endpoint.path]);

    const parsedBody = useMemo(() => {
        try {
            return { ok: true as const, value: JSON.parse(requestText) };
        } catch (err: any) {
            return { ok: false as const, error: err?.message || 'Invalid JSON' };
        }
    }, [requestText]);

    useEffect(() => {
        if (parsedBody.ok) {
            setRequestError(null);
        } else {
            setRequestError(parsedBody.error);
        }
    }, [parsedBody]);

    const onReset = () => {
        setRequestText(JSON.stringify(sampleRequest, null, 2));
        setResult(null);
        setRequestError(null);
    };

    const onSend = async () => {
        if (!parsedBody.ok) return;
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setLoading(true);
        try {
            const res = await callFlightApi(endpoint, parsedBody.value, {
                signal: controller.signal,
                accessToken: accessToken,
            });
            setResult(res);
            onResult?.(res);
        } finally {
            setLoading(false);
        }
    };

    const onFormat = () => {
        if (!parsedBody.ok) return;
        setRequestText(JSON.stringify(parsedBody.value, null, 2));
    };

    const copy = async (kind: 'request' | 'response') => {
        const text = kind === 'request' ? requestText : result?.responseText || '';
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(kind);
            setTimeout(() => setCopied(null), 1500);
        } catch {
            // ignore
        }
    };

    const statusTone =
        !result ? 'neutral' :
        result.networkError ? 'bad' :
        result.ok ? 'ok' :
        'warn';

    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                    <div>
                        <div className="text-xs uppercase tracking-wider text-slate-500">Endpoint</div>
                        <div className="font-mono text-sm text-slate-200 break-all">
                            <span className="text-emerald-400 mr-2">POST</span>
                            {fullUrl}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{endpoint.description}</div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onFormat}
                            disabled={!parsedBody.ok || loading}
                            className="text-xs px-3 py-1.5 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
                            title="Format JSON"
                        >
                            Format
                        </button>
                        <button
                            onClick={onReset}
                            disabled={loading}
                            className="text-xs px-3 py-1.5 rounded-md border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1.5"
                            title="Reset to sample"
                        >
                            <RotateCcw size={12} />
                            Reset
                        </button>
                        <button
                            onClick={onSend}
                            disabled={!parsedBody.ok || loading}
                            className="text-xs px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 flex items-center gap-1.5"
                        >
                            {loading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                            {loading ? 'Sending…' : 'Send Request'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-800 bg-slate-900/50 flex flex-col">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
                        <div className="text-xs uppercase tracking-wider text-slate-400">Request body</div>
                        <button
                            onClick={() => copy('request')}
                            className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                        >
                            {copied === 'request' ? <Check size={12} /> : <Copy size={12} />}
                            {copied === 'request' ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                    <textarea
                        value={requestText}
                        onChange={(e) => setRequestText(e.target.value)}
                        spellCheck={false}
                        className="custom-scrollbar w-full h-[420px] resize-y bg-slate-950/60 text-slate-100 font-mono text-xs leading-relaxed p-3 outline-none border-0"
                    />
                    {requestError && (
                        <div className="px-4 py-2 text-xs text-amber-400 border-t border-slate-800 flex items-center gap-1.5">
                            <AlertTriangle size={12} />
                            {requestError}
                        </div>
                    )}
                </div>

                <div className="rounded-lg border border-slate-800 bg-slate-900/50 flex flex-col">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                            <div className="text-xs uppercase tracking-wider text-slate-400">Response</div>
                            {result && (
                                <span
                                    className={
                                        'text-[10px] px-2 py-0.5 rounded-full font-mono ' +
                                        (statusTone === 'ok'
                                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                            : statusTone === 'warn'
                                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                                : statusTone === 'bad'
                                                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                                    : 'bg-slate-700/40 text-slate-300 border border-slate-600/40')
                                    }
                                >
                                    {result.networkError
                                        ? 'Network error'
                                        : `${result.status} ${result.statusText}`}
                                </span>
                            )}
                            {result && (
                                <span className="text-[10px] text-slate-500 font-mono">{result.durationMs} ms</span>
                            )}
                        </div>
                        <button
                            onClick={() => copy('response')}
                            disabled={!result?.responseText}
                            className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-40 flex items-center gap-1"
                        >
                            {copied === 'response' ? <Check size={12} /> : <Copy size={12} />}
                            {copied === 'response' ? 'Copied' : 'Copy'}
                        </button>
                    </div>
                    <div className="flex-1 min-h-[420px] flex flex-col">
                        {!result && (
                            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                                Send a request to see the response here.
                            </div>
                        )}
                        {result?.networkError && (
                            <div className="p-4 text-xs text-rose-300 flex items-start gap-2">
                                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                <div>
                                    <div className="font-semibold">Network error</div>
                                    <div className="font-mono break-all">{result.networkError}</div>
                                    <div className="mt-2 text-slate-400">
                                        This is usually caused by CORS or the API host being unreachable from the browser.
                                    </div>
                                </div>
                            </div>
                        )}
                        {result && !result.networkError && (
                            <>
                                <ResponseSummary endpointKey={endpoint.key} result={result} />
                                <pre className="custom-scrollbar flex-1 m-0 p-3 bg-slate-950/60 text-slate-100 font-mono text-xs leading-relaxed overflow-auto border-t border-slate-800">
                                    {prettyResponse(result)}
                                </pre>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

function prettyResponse(result: FlightApiResult): string {
    if (result.data !== null && result.data !== undefined) {
        try {
            return JSON.stringify(result.data, null, 2);
        } catch {
            // fall through
        }
    }
    return result.responseText || '';
}

export default ApiTestPanel;
