
import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Paperclip, Loader2, Mic, X, Check, Plus } from 'lucide-react';
import { apiService } from '../../services/api';

interface ChatInputProps {
    onSend: (text: string, metadata?: Record<string, any>) => void;
    onSlashCommand?: (command: string, args: string) => Promise<void> | void;
    disabled?: boolean;
    placeholder?: string;
}

const SLASH_COMMAND_REGEX = /^\/(\w+)(?:\s+([\s\S]*))?$/;

const ChatInput: React.FC<ChatInputProps> = ({ onSend, onSlashCommand, disabled, placeholder }) => {
    const [input, setInput] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<{file: File; result?: any; previewUrl?: string}[]>([]);
    const isAnyFileUploading = pendingFiles.some(pf => !pf.result);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const lastSubmitTimeRef = useRef<number>(0);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = '0px';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
    }, [input]);

    useEffect(() => {
        const handler = () => textareaRef.current?.focus();
        window.addEventListener('chat:focus-input', handler);
        return () => window.removeEventListener('chat:focus-input', handler);
    }, []);

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const trimmed = input.trim();
        const isAnyFileUploading = pendingFiles.some(pf => !pf.result);
        
        if ((!trimmed && pendingFiles.length === 0) || disabled || isAnyFileUploading) return;

        const now = Date.now();
        if (now - lastSubmitTimeRef.current < 100) {
            return;
        }
        lastSubmitTimeRef.current = now;

        const slashMatch = trimmed.match(SLASH_COMMAND_REGEX);
        if (slashMatch && onSlashCommand) {
            const [, command, args] = slashMatch;
            setInput('');
            await onSlashCommand(command.toLowerCase(), (args || '').trim());
            return;
        }

        const fileResults = pendingFiles.map(pf => pf.result).filter(Boolean);
        const metadata: Record<string, any> = {};
        
        if (fileResults.length > 0) {
            metadata.files = fileResults;
            // Support old image_path for backward compatibility
            if (fileResults.length === 1 && fileResults[0].mime_type?.startsWith('image/')) {
                metadata.image_path = fileResults[0].file_path;
                metadata.original_filename = fileResults[0].filename;
            }
        }

        onSend(input, metadata);
        setInput('');
        setPendingFiles([]);
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRecorderRef.current = recorder;
            audioChunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    audioChunksRef.current.push(e.data);
                }
            };

            recorder.onstop = async () => {
                if (audioChunksRef.current.length === 0) return;
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                setIsTranscribing(true);
                try {
                    const result = await apiService.transcribeVoice(audioBlob);
                    if (result && result.transcript) {
                        setInput(result.transcript);
                    }
                } catch (error) {
                    console.error('Error transcribing voice:', error);
                } finally {
                    setIsTranscribing(false);
                }
                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Could not access microphone. Please check permissions.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const cancelRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            audioChunksRef.current = [];
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const removeFile = (index: number) => {
        setPendingFiles((prev) => {
            const fileToRemove = prev[index];
            if (fileToRemove.previewUrl) {
                URL.revokeObjectURL(fileToRemove.previewUrl);
            }
            return prev.filter((_, i) => i !== index);
        });
    };

    const uploadSingleFile = async (file: File) => {
        try {
            const result = await apiService.uploadFile(file, { index: false });
            if (result && result.file_path) {
                setPendingFiles((prev) =>
                    prev.map(pf => pf.file === file ? { ...pf, result } : pf)
                );
            }
        } catch (error) {
            console.error('Error uploading file:', error);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || disabled) return;

        if (fileInputRef.current) fileInputRef.current.value = '';

        const newFiles = Array.from(files).map(f => ({
            file: f,
            previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined
        }));
        
        setPendingFiles((prev) => [...prev, ...newFiles]);

        for (const item of newFiles) {
            uploadSingleFile(item.file);
        }
    };
    return (
        <div className="shrink-0 px-3 pb-4 pt-3 sm:px-6 sm:pb-6">
            <div className="mx-auto max-w-4xl">
                <form
                    onSubmit={handleSubmit}
                    className="relative overflow-hidden rounded-[1.9rem] border border-white/10 bg-slate-900/95 shadow-[0_24px_70px_rgba(2,6,23,0.45)] transition-colors focus-within:border-slate-600"
                >
                    {pendingFiles.length > 0 && (
                        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 overflow-x-auto custom-scrollbar">
                            {pendingFiles.map((pf, idx) => (
                                <div key={idx} className="relative group bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-xl p-2 flex items-center gap-3 min-w-[150px] max-w-[220px]">
                                    {pf.previewUrl ? (
                                        <div className="relative w-12 h-12 shrink-0 rounded-lg overflow-hidden">
                                            <img src={pf.previewUrl} alt="preview" className="w-full h-full object-cover" />
                                            {!pf.result && (
                                                <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center rounded-lg">
                                                    <Loader2 size={16} className="animate-spin text-indigo-400" />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="relative w-12 h-12 shrink-0 bg-slate-700/50 rounded-lg flex items-center justify-center text-slate-400">
                                            <Paperclip size={20} />
                                            {!pf.result && (
                                                <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center rounded-lg">
                                                    <Loader2 size={16} className="animate-spin text-indigo-400" />
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium text-slate-200 truncate">{pf.file.name}</div>
                                        <div className="text-[10px] text-slate-500">{(pf.file.size / 1024).toFixed(1)} KB</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeFile(idx)}
                                        className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-slate-700 text-slate-300 rounded-full flex items-center justify-center hover:bg-slate-600 hover:text-white transition-colors"
                                        aria-label="Remove file"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    {isRecording ? (
                        <div className="flex items-center justify-between px-4 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-4">
                            <div className="flex items-center flex-1">
                                <Plus size={20} className="text-slate-400 mr-3" />
                                <div className="flex-1 flex items-center">
                                    <div className="border-t border-dotted border-slate-600 flex-1 mr-3"></div>
                                    <div className="flex items-center space-x-1 mr-3">
                                        <div className="w-1 h-4 bg-indigo-500 animate-pulse"></div>
                                        <div className="w-1 h-6 bg-indigo-500 animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                                        <div className="w-1 h-8 bg-indigo-500 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                                        <div className="w-1 h-5 bg-indigo-500 animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                                        <div className="w-1 h-3 bg-indigo-500 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center space-x-3">
                                <button
                                    type="button"
                                    onClick={cancelRecording}
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition"
                                    aria-label="Cancel recording"
                                >
                                    <X size={20} />
                                </button>
                                <button
                                    type="button"
                                    onClick={stopRecording}
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white text-slate-950 hover:bg-slate-100 transition"
                                    aria-label="Finish recording"
                                >
                                    <Check size={20} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center px-4 pb-3 pt-3 sm:px-5 sm:pb-4 sm:pt-4">
{/* 
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                                accept="image/*,.pdf,.doc,.docx"
                                multiple
                                className="hidden"
                            />
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => fileInputRef.current?.click()}
                                className="mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-800 text-slate-400 shadow-sm transition hover:bg-slate-700 hover:text-white disabled:opacity-50"
                                aria-label="Upload files"
                            >
                                <Paperclip size={20} />
                            </button>
*/}

                            <button
                                type="button"
                                disabled={disabled || isUploading || isTranscribing}
                                onClick={startRecording}
                                className="mr-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-800 text-slate-400 shadow-sm transition hover:bg-slate-700 hover:text-white disabled:opacity-50"
                                aria-label="Voice input"
                            >
                                {isTranscribing ? (
                                    <Loader2 size={20} className="animate-spin text-indigo-400" />
                                ) : (
                                    <Mic size={20} />
                                )}
                            </button>

                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                        e.preventDefault();
                                        handleSubmit();
                                        return;
                                    }
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit();
                                    }
                                }}
                                placeholder={isAnyFileUploading ? 'Uploading files...' : (isTranscribing ? 'Transcribing voice...' : placeholder)}
                                disabled={disabled || isTranscribing}
                                rows={1}
                                className="custom-scrollbar min-h-[24px] w-full max-h-[220px] resize-none overflow-y-auto bg-transparent py-1 pr-14 text-[15px] leading-6 text-slate-100 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={(!input.trim() && pendingFiles.length === 0) || disabled || isAnyFileUploading || isTranscribing}
                                className="absolute bottom-3 right-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white text-slate-950 shadow-sm transition hover:bg-slate-100 disabled:border-slate-700 disabled:bg-slate-700 disabled:text-slate-300 sm:bottom-4 sm:right-4"
                                aria-label="Send message"
                            >
                                <ArrowUp size={20} strokeWidth={2.4} />
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default ChatInput;
