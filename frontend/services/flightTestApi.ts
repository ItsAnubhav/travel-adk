const DEFAULT_BASE_URL = 'https://preprod.quadlabs.net/forge';
// const DEFAULT_BASE_URL = 'https://localhost:7137';

export const FLIGHT_BASE_URL = (
    import.meta.env.VITE_FLIGHT_API_BASE_URL || DEFAULT_BASE_URL
).replace(/\/$/, '');

export type FlightEndpointKey = 'airShopping' | 'offerPrice' | 'fareRule' | 'fareRuleAsk' | 'orderCreate';

export interface FlightEndpointDef {
    key: FlightEndpointKey;
    label: string;
    path: string;
    description: string;
}

export const FLIGHT_ENDPOINTS: Record<FlightEndpointKey, FlightEndpointDef> = {
    airShopping: {
        key: 'airShopping',
        label: 'Air Shopping',
        path: '/api/v1/flights/air-shopping',
        description: 'Search for available flight offers for a given origin, destination, and travel dates.',
    },
    offerPrice: {
        key: 'offerPrice',
        label: 'Offer Price',
        path: '/api/v1/flights/offer-price',
        description: 'Re-price a chosen offer to confirm the live fare and breakdown.',
    },
    fareRule: {
        key: 'fareRule',
        label: 'Fare Rule',
        path: '/api/v1/flights/fare-rule?aiSummary=true',
        description: 'Fetch fare rules for the selected offer.',
    },
    fareRuleAsk: {
        key: 'fareRuleAsk',
        label: 'Fare Rule Ask',
        path: '/api/v1/flights/fare-rule/ask',
        description: 'Ask a natural-language question about a previously-fetched fare rule.',
    },
    orderCreate: {
        key: 'orderCreate',
        label: 'Order Create',
        path: '/api/v1/flights/order-create',
        description: 'Create a booking order for the selected, priced offer.',
    },
};

const TOKEN_SESSION_KEY = 'aiva:loginTokens';

export function getStoredAccessToken(): string | null {
    try {
        const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const fromUrl = search?.get('token') || search?.get('access_token');
        if (fromUrl) return fromUrl;

        if (typeof window === 'undefined') return null;
        const raw = localStorage.getItem(TOKEN_SESSION_KEY) || sessionStorage.getItem(TOKEN_SESSION_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { accessToken?: string };
        return parsed?.accessToken || null;
    } catch {
        return null;
    }
}

export interface FlightApiResult<T = any> {
    ok: boolean;
    status: number;
    statusText: string;
    durationMs: number;
    url: string;
    requestBody: any;
    responseText: string;
    data: T | null;
    parseError?: string;
    networkError?: string;
}

export async function callFlightApi<T = any>(
    endpoint: FlightEndpointDef,
    body: any,
    options: {
        headers?: Record<string, string>;
        signal?: AbortSignal;
        baseUrl?: string;
        accessToken?: string | null;
    } = {},
): Promise<FlightApiResult<T>> {
    const baseUrl = (options.baseUrl || FLIGHT_BASE_URL).replace(/\/$/, '');
    const url = `${baseUrl}${endpoint.path}`;
    const started = performance.now();
    const token = options.accessToken === undefined ? getStoredAccessToken() : options.accessToken;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
    };
    if (token && !headers.Authorization && !headers.authorization) {
        headers.Authorization = `Bearer ${token}`;
    }
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: options.signal,
        });
        const responseText = await res.text();
        let data: T | null = null;
        let parseError: string | undefined;
        if (responseText) {
            try {
                data = JSON.parse(responseText) as T;
            } catch (err: any) {
                parseError = err?.message || 'Failed to parse response as JSON';
            }
        }
        return {
            ok: res.ok,
            status: res.status,
            statusText: res.statusText,
            durationMs: Math.round(performance.now() - started),
            url,
            requestBody: body,
            responseText,
            data,
            parseError,
        };
    } catch (err: any) {
        return {
            ok: false,
            status: 0,
            statusText: 'Network error',
            durationMs: Math.round(performance.now() - started),
            url,
            requestBody: body,
            responseText: '',
            data: null,
            networkError: err?.message || String(err),
        };
    }
}
