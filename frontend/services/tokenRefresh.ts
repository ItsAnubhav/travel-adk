import { apiService } from './api';

const TOKEN_SESSION_KEY = 'aiva:loginTokens';
const REFRESH_INTERVAL_MS = 50 * 60 * 1000;
const REFRESH_CATCHUP_MS = 50 * 60 * 1000;
const REFRESH_BEFORE_EXPIRY_MS = 2 * 60 * 1000;
const EXPIRED_SESSION_MESSAGE = 'Your session token has expired. Please log in again.';

interface StoredTokens {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpiresIn?: string;
    refreshTokenExpiresIn?: string;
}

interface SchedulerOptions {
    onLogout?: (message?: string) => void;
}

let timeoutId: number | null = null;
let lastRefreshAt = 0;
let inFlight: Promise<boolean> | null = null;
let onLogoutCb: ((message?: string) => void) | null = null;

const decodeJwtPayload = (token?: string): Record<string, any> | null => {
    if (!token) return null;
    try {
        const [, payload] = token.split('.');
        if (!payload) return null;
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(normalized.length + ((4 - normalized.length % 4) % 4), '=');
        return JSON.parse(window.atob(padded));
    } catch {
        return null;
    }
};

const accessTokenExpiryMs = (token?: string): number | null => {
    const exp = decodeJwtPayload(token)?.exp;
    if (typeof exp !== 'number' || !Number.isFinite(exp)) return null;
    return exp * 1000;
};

const shouldRefreshAccessToken = (tokens: StoredTokens | null): boolean => {
    const expiresAt = accessTokenExpiryMs(tokens?.accessToken);
    if (!expiresAt) return false;
    return expiresAt - Date.now() <= REFRESH_BEFORE_EXPIRY_MS;
};

const isAccessTokenExpired = (tokens: StoredTokens | null): boolean => {
    const expiresAt = accessTokenExpiryMs(tokens?.accessToken);
    return Boolean(expiresAt && expiresAt <= Date.now());
};

const readTokens = (): StoredTokens | null => {
    try {
        const raw = localStorage.getItem(TOKEN_SESSION_KEY) || sessionStorage.getItem(TOKEN_SESSION_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as StoredTokens;
    } catch {
        return null;
    }
};

const writeTokens = (tokens: StoredTokens) => {
    localStorage.setItem(TOKEN_SESSION_KEY, JSON.stringify(tokens));
};

const clearScheduledRefresh = () => {
    if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
    }
};

const scheduleNextRefresh = () => {
    clearScheduledRefresh();

    const stored = readTokens();
    const expiresAt = accessTokenExpiryMs(stored?.accessToken);
    const refreshDelay = expiresAt ? expiresAt - Date.now() - REFRESH_BEFORE_EXPIRY_MS : REFRESH_INTERVAL_MS;
    const delay = expiresAt
        ? Math.max(1000, Math.min(REFRESH_INTERVAL_MS, refreshDelay))
        : REFRESH_INTERVAL_MS;

    timeoutId = window.setTimeout(async () => {
        await refreshTokenNow();
    }, delay);
};

const currentSessionId = (): string | null => {
    try {
        const sid = new URLSearchParams(window.location.search).get('session_id');
        return sid && sid.trim() ? sid : null;
    } catch {
        return null;
    }
};

export const refreshTokenNow = async (): Promise<boolean> => {
    if (inFlight) return inFlight;

    inFlight = (async (): Promise<boolean> => {
        const stored = readTokens();
        if (!stored?.refreshToken) {
            console.warn('[token-refresh] no refresh token in storage, skipping');
            if (isAccessTokenExpired(stored)) {
                onLogoutCb?.(EXPIRED_SESSION_MESSAGE);
            }
            return false;
        }

        const result = await apiService.refreshToken(stored.refreshToken);
        if (!result.success || !result.accessToken) {
            console.warn('[token-refresh] refresh failed:', result.message);
            onLogoutCb?.(EXPIRED_SESSION_MESSAGE);
            return false;
        }

        if (isAccessTokenExpired({ accessToken: result.accessToken })) {
            console.warn('[token-refresh] refresh returned an expired access token');
            onLogoutCb?.(EXPIRED_SESSION_MESSAGE);
            return false;
        }

        writeTokens({
            accessToken: result.accessToken,
            refreshToken: result.refreshToken || stored.refreshToken,
            accessTokenExpiresIn: result.accessTokenExpiresIn || stored.accessTokenExpiresIn,
            refreshTokenExpiresIn: result.refreshTokenExpiresIn || stored.refreshTokenExpiresIn,
        });
        lastRefreshAt = Date.now();
        scheduleNextRefresh();

        console.debug('[token-refresh] token refreshed successfully');
        return true;
    })();

    try {
        return await inFlight;
    } finally {
        inFlight = null;
    }
};

const handleVisibilityChange = () => {
    const stored = readTokens();
    if (document.visibilityState === 'visible' && (shouldRefreshAccessToken(stored) || Date.now() - lastRefreshAt > REFRESH_CATCHUP_MS)) {
        refreshTokenNow();
    }
};

const handleFocus = () => {
    const stored = readTokens();
    if (shouldRefreshAccessToken(stored) || Date.now() - lastRefreshAt > REFRESH_CATCHUP_MS) {
        refreshTokenNow();
    }
};

export const startTokenRefreshScheduler = (opts?: SchedulerOptions) => {
    if (timeoutId !== null) return;
    onLogoutCb = opts?.onLogout || null;
    lastRefreshAt = Date.now();

    const stored = readTokens();
    if (isAccessTokenExpired(stored) && !stored?.refreshToken) {
        onLogoutCb?.(EXPIRED_SESSION_MESSAGE);
        return;
    }

    if (shouldRefreshAccessToken(stored)) {
        refreshTokenNow();
    } else {
        scheduleNextRefresh();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
};

export const stopTokenRefreshScheduler = () => {
    clearScheduledRefresh();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleFocus);
    onLogoutCb = null;
    lastRefreshAt = 0;
};
