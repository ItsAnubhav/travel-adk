import React, { useEffect, useState } from 'react';
import { LoginPayload } from '../types';

const emptyLoginPayload: LoginPayload = {
  companyId: '',
  accountNo: '',
  userName: '',
  password: '',
  source: 'SBT'
};

interface LoginPageProps {
  onLogin: (payload: LoginPayload) => Promise<void>;
  initialErrorMessage?: string | null;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, initialErrorMessage = null }) => {
  const [form, setForm] = useState<LoginPayload>(emptyLoginPayload);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorMessage);

  useEffect(() => {
    setErrorMessage(initialErrorMessage);
  }, [initialErrorMessage]);

  const updateField = (field: keyof LoginPayload, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.companyId.trim() || !form.userName.trim() || !form.password.trim() || !form.source.trim()) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await onLogin({
        companyId: form.companyId.trim(),
        accountNo: '',
        userName: form.userName.trim(),
        password: form.password,
        source: form.source.trim()
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Login failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const demoCreds = {
    "companyCode" : "QLABS12345",
    "username" : "Syed",
    "password" : "Admin@123"
  }

  return (
    //apply demo creds for quick testing
    <div className="min-h-screen w-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-white">Login</h1>
          <p className="text-sm text-slate-400 mt-2">Enter credentials to access the chatbot.</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <label className="block text-xs text-slate-400">
            Company ID
            <input
              type="text"
              value={form.companyId} 
              onChange={(event) => updateField('companyId', event.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              required
            />
          </label>

          <label className="block text-xs text-slate-400">
            Username
            <input
              type="text"
              value={form.userName}
              onChange={(event) => updateField('userName', event.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              required
            />
          </label>

          <label className="block text-xs text-slate-400">
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) => updateField('password', event.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              required
            />
          </label>

          <label className="block text-xs text-slate-400">
            Source
            <select
              value={form.source}
              onChange={(event) => updateField('source', event.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
              required
            >
              <option value="SBT">SBT</option>
              <option value="MO">MO</option>
            </select>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold py-2.5 transition-colors"
          >
            {isSubmitting ? 'Logging in...' : 'Login'}
          </button>

          {errorMessage && (
            <p className="text-xs text-rose-400">{errorMessage}</p>
          )}
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
