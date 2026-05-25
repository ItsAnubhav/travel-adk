import React, { useState, useEffect, useMemo } from 'react';
import { ChatMessage as ChatMessageType, ToolResult } from '../types';
import {
  Copy,
  ThumbsUp,
  ThumbsDown,
  Terminal,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Check,
  Bot,
  ArrowUpRight,
  BadgeInfo,
  FileIcon,
  Image as ImageIcon,
} from 'lucide-react';
import { extractRichResults, RichResult } from './RichResultRenderer';
import UserChoicePrompt from './UserChoicePrompt';

const ReceiptAttachment: React.FC<{ filename: string; path: string }> = ({ filename }) => {
  const isPdf = filename.toLowerCase().endsWith('.pdf');
  const isDoc = filename.toLowerCase().endsWith('.doc') || filename.toLowerCase().endsWith('.docx');

  return (
    <div className="mt-2 flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 group/attachment transition-all hover:bg-slate-800">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center border shadow-sm ${
        isPdf ? 'bg-rose-500/20 text-rose-400 border-rose-500/20' :
        isDoc ? 'bg-blue-500/20 text-blue-400 border-blue-500/20' :
        'bg-indigo-500/20 text-indigo-400 border-indigo-500/20'
      }`}>
        {isPdf || isDoc ? <FileIcon size={20} /> : <ImageIcon size={20} />}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium text-slate-100 truncate">{filename}</span>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
          {isPdf ? 'PDF Receipt' : isDoc ? 'Document Receipt' : 'Image Receipt'}
        </span>
      </div>
      <div className="ml-auto opacity-0 group-hover/attachment:opacity-100 transition-opacity">
        <BadgeInfo size={14} className="text-slate-500" />
      </div>
    </div>
  );
};

const formatRelativeTime = (date: Date) => {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffInSeconds < 60) return 'just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return date.toLocaleDateString();
};

const MarkdownRenderer: React.FC<{ content: string }> = ({ content }) => {
  const lines = content.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        if (line.startsWith('### ')) return <h3 key={idx} className="text-lg font-bold mt-2 text-white">{line.slice(4)}</h3>;
        if (line.startsWith('## ')) return <h2 key={idx} className="text-xl font-bold mt-3 text-white">{line.slice(3)}</h2>;
        if (line.startsWith('# ')) return <h1 key={idx} className="text-2xl font-bold mt-4 text-white">{line.slice(2)}</h1>;
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={idx} className="ml-4 list-disc">{line.slice(2)}</li>;
        if (line.match(/^\d+\. /)) return <li key={idx} className="ml-4 list-decimal">{line.replace(/^\d+\. /, '')}</li>;

        const formatted = line
          .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
          .replace(/`(.*?)`/g, '<code class="bg-slate-800/50 px-1 rounded text-pink-400 font-mono text-sm">$1</code>');

        return <p key={idx} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: formatted }} />;
      })}
    </div>
  );
};

const ExecutionLogsAccordion: React.FC<{ tools: ToolResult[] }> = ({ tools }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!tools.length) return null;

  return (
    <div className="mt-3">
      <div className="border border-slate-800 rounded-xl overflow-hidden bg-black/20">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-3 py-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Terminal size={12} />
            <span>Execution Logs ({tools.length})</span>
          </div>
          {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {isOpen && (
          <div className="px-3 py-2 border-t border-slate-800 divide-y divide-slate-800/50">
            {tools.map((tool, i) => (
              <div key={i} className="py-1.5 flex items-center justify-between gap-4">
                <span className="text-[10px] font-mono text-slate-400 truncate">{tool.tool_name}</span>
                {tool.success ? (
                  <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle size={12} className="text-rose-500 shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ResultButtons: React.FC<{
  results: RichResult[];
  onViewResult?: (id: string) => void;
}> = ({ results, onViewResult }) => {
  if (!results.length || !onViewResult) return null;

  if (results.length === 1) {
    const r = results[0];
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => onViewResult(r.id)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-200 text-xs font-semibold transition-colors"
        >
          <ArrowUpRight size={14} />
          View Result
          <span className="text-indigo-300/70 font-normal">— {r.label}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {results.map((r) => (
        <button
          key={r.id}
          type="button"
          onClick={() => onViewResult(r.id)}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-200 text-xs font-semibold transition-colors"
        >
          <ArrowUpRight size={14} />
          {r.label}
        </button>
      ))}
    </div>
  );
};

interface ChatMessageProps {
  message: ChatMessageType;
  onViewResult?: (resultId: string) => void;
  onSendMessage?: (text: string) => void;
}

interface ChoicePrompt {
  question: string;
  options: string[];
  allowFreeText: boolean;
}

const extractChoicePrompt = (message: ChatMessageType): ChoicePrompt | null => {
  for (const tool of message.toolResults || []) {
    if ((tool as any).ui_component !== 'user_choice_prompt') continue;
    const payload: any = (tool as any).payload || {};
    const question = typeof payload.question === 'string' ? payload.question : '';
    const options = Array.isArray(payload.options)
      ? payload.options.filter((o: unknown): o is string => typeof o === 'string' && o.trim() !== '')
      : [];
    if (!question || options.length === 0) continue;
    return {
      question,
      options,
      allowFreeText: payload.allow_free_text !== false,
    };
  }
  return null;
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onViewResult, onSendMessage }) => {
  const isAssistant = message.role === 'assistant';
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [relativeTime, setRelativeTime] = useState(formatRelativeTime(message.timestamp));

  useEffect(() => {
    const timer = setInterval(() => {
      setRelativeTime(formatRelativeTime(message.timestamp));
    }, 30000);
    return () => clearInterval(timer);
  }, [message.timestamp]);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const richResults = useMemo(() => extractRichResults(message), [message]);
  const choicePrompt = useMemo(() => extractChoicePrompt(message), [message]);
  const hasRenderableAssistantContent = Boolean(
    message.content.trim() ||
    richResults.length ||
    choicePrompt ||
    message.toolResults?.length ||
    message.metadata?.image_path,
  );

  if (isAssistant && !hasRenderableAssistantContent) return null;

  return (
    <div className={`flex w-full px-4 py-2 md:px-8 ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      <div className="flex flex-col max-w-[85%] sm:max-w-[70%] group">
        <div className="flex flex-col flex-1 min-w-0">
          {isAssistant && (
            <div className="flex items-center gap-2 mb-1 px-1">
              <div className="w-7 h-7 rounded-full flex items-center justify-center bg-indigo-600/20 border border-indigo-600/30 text-indigo-400">
                <Bot size={14} />
              </div>
              <span className="text-xs text-slate-500 font-medium">Assistant</span>
            </div>
          )}

          <div className={`relative px-4 py-3 rounded-2xl shadow-sm transition-all ${isAssistant
            ? 'bg-slate-900 border border-slate-800 text-slate-200'
            : 'bg-indigo-600 rounded-tr-none text-white shadow-lg shadow-indigo-600/10'
            }`}>
            <div className="text-sm md:text-[15px]">
              <MarkdownRenderer content={message.content} />
              {message.metadata?.image_path && (
                <ReceiptAttachment
                  filename={message.metadata.original_filename || 'receipt.jpg'}
                  path={message.metadata.image_path}
                />
              )}
              {message.isStreaming && (
                <span className="inline-block w-1.5 h-4 ml-1 bg-indigo-400 animate-pulse align-middle" />
              )}
            </div>

            {isAssistant && choicePrompt && onSendMessage && (
              <UserChoicePrompt
                question={choicePrompt.question}
                options={choicePrompt.options}
                allowFreeText={choicePrompt.allowFreeText}
                onSelect={onSendMessage}
              />
            )}
            {isAssistant && (
              <ResultButtons results={richResults} onViewResult={onViewResult} />
            )}

            {isAssistant && message.toolResults && message.toolResults.length > 0 && (
              <ExecutionLogsAccordion tools={message.toolResults} />
            )}
          </div>

          <div className={`flex items-center gap-3 mt-1.5 px-1 ${isAssistant ? 'justify-start' : 'justify-end'}`}>
            <div
              className="text-[10px] text-slate-600 font-medium cursor-default"
              title={message.timestamp.toLocaleString()}
            >
              {relativeTime}
            </div>

            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                title="Copy"
              >
                {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
              </button>

              {isAssistant && (
                <>
                  <button
                    onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
                    className={`p-1 transition-colors ${feedback === 'up' ? 'text-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}
                    title="Helpful"
                  >
                    <ThumbsUp size={12} fill={feedback === 'up' ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
                    className={`p-1 transition-colors ${feedback === 'down' ? 'text-rose-500' : 'text-slate-500 hover:text-slate-300'}`}
                    title="Not helpful"
                  >
                    <ThumbsDown size={12} fill={feedback === 'down' ? 'currentColor' : 'none'} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
