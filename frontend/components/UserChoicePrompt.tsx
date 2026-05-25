import React, { useState } from 'react';

interface UserChoicePromptProps {
  question: string;
  options: string[];
  allowFreeText?: boolean;
  onSelect: (text: string) => void;
  disabled?: boolean;
}

const UserChoicePrompt: React.FC<UserChoicePromptProps> = ({
  question,
  options,
  allowFreeText = true,
  onSelect,
  disabled = false,
}) => {
  const [freeText, setFreeText] = useState('');
  const [answered, setAnswered] = useState(false);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || answered || disabled) return;
    setAnswered(true);
    onSelect(trimmed);
  };

  const handleFreeTextKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(freeText);
    }
  };

  const locked = answered || disabled;

  return (
    <div className="mt-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
      <div className="text-sm font-medium text-slate-100 mb-2">{question}</div>
      <div className="flex flex-col gap-1.5">
        {options.map((opt, idx) => (
          <button
            key={`${idx}-${opt}`}
            type="button"
            onClick={() => submit(opt)}
            disabled={locked}
            className={`flex items-center gap-3 text-left rounded-md px-3 py-2 text-sm border transition-colors ${
              locked
                ? 'border-slate-800 bg-slate-900/40 text-slate-500 cursor-not-allowed'
                : 'border-slate-700 bg-slate-900 text-slate-100 hover:border-indigo-500 hover:bg-indigo-500/10'
            }`}
          >
            <span className="inline-flex w-5 h-5 items-center justify-center rounded bg-slate-800 text-[11px] text-slate-300 font-semibold">
              {idx + 1}
            </span>
            <span className="flex-1">{opt}</span>
          </button>
        ))}
      </div>
      {allowFreeText && (
        <input
          type="text"
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          onKeyDown={handleFreeTextKey}
          placeholder="Tell the assistant what to do instead"
          disabled={locked}
          className={`mt-2 w-full rounded-md px-3 py-2 text-sm border bg-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 ${
            locked ? 'border-slate-800 text-slate-500' : 'border-slate-700 text-slate-100'
          }`}
        />
      )}
      {answered && (
        <div className="mt-2 text-[11px] text-slate-500">Response sent.</div>
      )}
    </div>
  );
};

export default UserChoicePrompt;
