
import React, { useState, useEffect } from 'react';
import { LoginPayload } from './types';
import { apiService } from './services/api';
import { startTokenRefreshScheduler, stopTokenRefreshScheduler } from './services/tokenRefresh';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';
import FlightTestPage from './pages/FlightTestPage';
import DashboardPage from './pages/DashboardPage';

const LOGIN_SESSION_KEY = 'aiva:login';
const TOKEN_SESSION_KEY = 'aiva:loginTokens';
const LOGIN_PATH = '/login';
const CHAT_PATH = '/';
const ADMIN_PATH = '/admin';
const DASHBOARD_PATH = '/dashboard';
const EMBED_PATH = '/embed/chat';
const TEST_PATH = '/test';

const isProtectedPath = (path: string): boolean =>
  path === ADMIN_PATH || path === DASHBOARD_PATH;

interface EmbedBootstrap {
  loginPayload: LoginPayload;
  accessToken: string;
}

const readEmbedBootstrap = (): EmbedBootstrap | null => {
  const search = new URLSearchParams(window.location.search);
  const token = search.get('token') || search.get('access_token');
  const companyId = search.get('companyId') || search.get('company_id');
  const userName = search.get('userName') || search.get('user_name');
  const source = search.get('source') || 'SBT';
  if (!token || !companyId || !userName) return null;
  return {
    accessToken: token,
    loginPayload: {
      companyId,
      accountNo: search.get('accountNo') || search.get('account_no') || '',
      userName,
      password: '',
      source,
      uid: search.get('uid') || undefined,
      saUserId: search.get('saUserId') || search.get('sa_user_id') || undefined,
      subAgentId: search.get('subAgentId') || search.get('subagent_id') || undefined,
      corporateId: search.get('corporateId') || search.get('corporate_id') || undefined,
    } as LoginPayload,
  };
};

const App: React.FC = () => {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname || CHAT_PATH);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [postLoginPath, setPostLoginPath] = useState(() =>
    isProtectedPath(window.location.pathname) ? window.location.pathname : ADMIN_PATH,
  );
  const isEmbed = currentPath === EMBED_PATH;
  const isAdmin = currentPath === ADMIN_PATH;
  const embedBootstrap = React.useMemo(
    () => (isEmbed || isAdmin ? readEmbedBootstrap() : null),
    [isEmbed, isAdmin],
  );

  const [loginPayload, setLoginPayload] = useState<LoginPayload | null>(() => {
    if (embedBootstrap) {
      localStorage.setItem(LOGIN_SESSION_KEY, JSON.stringify(embedBootstrap.loginPayload));
      return embedBootstrap.loginPayload;
    }
    try {
      const stored = localStorage.getItem(LOGIN_SESSION_KEY) || sessionStorage.getItem(LOGIN_SESSION_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored) as LoginPayload;
      if (!parsed?.companyId || !parsed?.userName || !parsed?.source) {
        return null;
      }
      localStorage.setItem(LOGIN_SESSION_KEY, JSON.stringify(parsed));
      return parsed;
    } catch {
      return null;
    }
  });

  const [hasToken, setHasToken] = useState(() => {
    if (embedBootstrap) {
      localStorage.setItem(TOKEN_SESSION_KEY, JSON.stringify({ accessToken: embedBootstrap.accessToken }));
      return true;
    }
    try {
      const raw = localStorage.getItem(TOKEN_SESSION_KEY) || sessionStorage.getItem(TOKEN_SESSION_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as { accessToken?: string };
      if (parsed?.accessToken) {
        localStorage.setItem(TOKEN_SESSION_KEY, JSON.stringify(parsed));
      }
      return Boolean(parsed?.accessToken);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname || CHAT_PATH);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateTo = (path: string) => {
    if (window.location.pathname === path) return;
    const nextUrl = `${path}${window.location.search}`;
    window.history.replaceState({}, '', nextUrl);
    setCurrentPath(path);
  };

  useEffect(() => {
    if (currentPath === EMBED_PATH || currentPath === TEST_PATH) return;
    const isAuthenticated = Boolean(loginPayload) && hasToken;
    if (!isAuthenticated && isProtectedPath(currentPath)) {
      setPostLoginPath(currentPath);
      navigateTo(LOGIN_PATH);
      return;
    }
    if (isAuthenticated && currentPath === LOGIN_PATH) {
      navigateTo(postLoginPath);
    }
  }, [currentPath, loginPayload, hasToken, postLoginPath]);

  useEffect(() => {
    const isAuthenticated = Boolean(loginPayload) && hasToken;
    if (!isAuthenticated) return;

    startTokenRefreshScheduler({
      onLogout: (message?: string) => {
        localStorage.removeItem(LOGIN_SESSION_KEY);
        sessionStorage.removeItem(LOGIN_SESSION_KEY);
        localStorage.removeItem(TOKEN_SESSION_KEY);
        sessionStorage.removeItem(TOKEN_SESSION_KEY);
        setAuthMessage(message || 'Your session has expired. Please log in again.');
        setLoginPayload(null);
        setHasToken(false);
        navigateTo(LOGIN_PATH);
      }
    });

    return () => stopTokenRefreshScheduler();
  }, [loginPayload, hasToken]);

  const handleLogin = async (payload: LoginPayload) => {
    setAuthMessage(null);
    const loginResult = await apiService.login(payload);
    if (!loginResult.success) {
      throw new Error(loginResult.message || 'Login failed.');
    }

    localStorage.setItem(TOKEN_SESSION_KEY, JSON.stringify({
      accessToken: loginResult.accessToken,
      refreshToken: loginResult.refreshToken,
      accessTokenExpiresIn: loginResult.accessTokenExpiresIn,
      refreshTokenExpiresIn: loginResult.refreshTokenExpiresIn
    }));

    const { password: _password, ...safePayload } = payload;
    setLoginPayload(safePayload);
    localStorage.setItem(LOGIN_SESSION_KEY, JSON.stringify(safePayload));
    setHasToken(true);
    navigateTo(postLoginPath);
  };

  const isAuthenticated = Boolean(loginPayload) && hasToken;

  if (currentPath === TEST_PATH) {
    return <FlightTestPage />;
  }

  if (currentPath === EMBED_PATH) {
    if (!isAuthenticated || !loginPayload) {
      return (
        <div className="min-h-screen w-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6 text-sm">
          <div className="max-w-md text-center">
            <h1 className="text-base font-semibold mb-2">Embed authentication required</h1>
            <p className="text-slate-400 text-xs leading-relaxed">
              The host must pass <code>token</code>, <code>companyId</code>, <code>userName</code> and <code>source</code> as query parameters when loading <code>/embed/chat</code>.
            </p>
          </div>
        </div>
      );
    }
    return <ChatPage loginPayload={loginPayload} embedMode />;
  }

  if (currentPath === ADMIN_PATH) {
    const isFramed = typeof window !== 'undefined' && window.self !== window.top;
    if (isFramed) {
      if (!isAuthenticated || !loginPayload) {
        return (
          <div className="min-h-screen w-screen bg-slate-950 text-slate-200 flex items-center justify-center p-6 text-sm">
            <div className="max-w-md text-center">
              <h1 className="text-base font-semibold mb-2">Embed authentication required</h1>
              <p className="text-slate-400 text-xs leading-relaxed">
                The host must pass <code>token</code>, <code>companyId</code>, <code>userName</code> and <code>source</code> as query parameters when loading <code>/admin</code> in an iframe.
              </p>
            </div>
          </div>
        );
      }
      return <AdminPage loginPayload={loginPayload} embedMode />;
    }
    if (!isAuthenticated || !loginPayload) {
      return <LoginPage onLogin={handleLogin} initialErrorMessage={authMessage} />;
    }
    return <AdminPage loginPayload={loginPayload} />;
  }

  if (currentPath === DASHBOARD_PATH) {
    if (!isAuthenticated || !loginPayload) {
      return <LoginPage onLogin={handleLogin} initialErrorMessage={authMessage} />;
    }
    return <DashboardPage loginPayload={loginPayload} />;
  }

  if (currentPath === LOGIN_PATH && !isAuthenticated) {
    return <LoginPage onLogin={handleLogin} initialErrorMessage={authMessage} />;
  }

  if (!isAuthenticated || !loginPayload) {
    return <LoginPage onLogin={handleLogin} initialErrorMessage={authMessage} />;
  }

  return <AdminPage loginPayload={loginPayload} />;
};

export default App;
