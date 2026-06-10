'use client';
import { useState, useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UploadCloud, FileText, CheckCircle, AlertCircle, Loader2, X, Lock, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { useUIStore, useChatStore } from '@/store';
import type { CsvImportResult } from '@/lib/types';

type UploadState = 'idle' | 'selected' | 'confirm' | 'uploading' | 'processing' | 'done' | 'error';

interface ProcessingStep {
  name: string;
  status: string;
}

interface ProgressPayload {
  steps: ProcessingStep[];
  percent: number;
  done: boolean;
  hasFailures: boolean;
}

const ACCEPTED = '.csv,.xlsx,.pdf';

const BANKS = [
  { id: 'hdfc',  label: 'HDFC Bank',   hint: 'Customer ID (printed on statement)' },
  { id: 'icici', label: 'ICICI Bank',  hint: 'First 4 letters of name (uppercase) + DOB as DDMM · e.g. SNEJ0512' },
  { id: 'sbi',   label: 'SBI',         hint: 'Account number + DOB as DDMMYYYY' },
  { id: 'axis',  label: 'Axis Bank',   hint: 'DOB as DDMMYYYY · e.g. 15061998' },
  { id: 'kotak', label: 'Kotak Bank',  hint: 'DOB as DDMMYYYY' },
  { id: 'other', label: 'Other / Unknown', hint: 'Try your date of birth (DDMMYYYY) or mobile number' },
];

export function UploadDialog() {
  const { uploadDialogOpen, setUploadDialog } = useUIStore();
  const queryClient = useQueryClient();
  const [state, setState] = useState<UploadState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [selectedBank, setSelectedBank] = useState('');
  const [showBankPicker, setShowBankPicker] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);

  // ── SSE: stream background job progress once upload completes ──────────────
  useEffect(() => {
    if (state !== 'processing' || !jobIds.length) return;

    const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api'}/uploads/progress?jobs=${jobIds.map(encodeURIComponent).join(',')}`;
    const es = new EventSource(url, { withCredentials: true });

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(e.data) as ProgressPayload;
        setProcessingSteps(payload.steps);
        if (payload.done) {
          es.close();
          queryClient.invalidateQueries();
          setState('done');
        }
      } catch {
        // ignore malformed frames
      }
    };

    es.onerror = () => {
      es.close();
      // Fail gracefully — user already has their transactions
      setState('done');
    };

    return () => es.close();
  }, [state, jobIds, queryClient]);

  const handleFile = useCallback((f: File) => {
    const ext = f.name.toLowerCase();
    if (!ext.endsWith('.csv') && !ext.endsWith('.xlsx') && !ext.endsWith('.pdf')) {
      toast.error('Supported: CSV, XLSX, PDF');
      return;
    }
    setFile(f);
    setState('selected');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const upload = async () => {
    if (!file) return;
    setState('uploading');
    setProgress(10);

    const steps = [
      { pct: 30 }, { pct: 60 }, { pct: 85 },
    ];
    let stepIdx = 0;
    const tick = setInterval(() => {
      if (stepIdx < steps.length) { setProgress(steps[stepIdx].pct); stepIdx++; }
    }, 600);

    try {
      const form = new FormData();
      form.append('file', file);
      if (password) form.append('password', password);
      const { data } = await api.post<CsvImportResult>('/uploads/csv', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      clearInterval(tick);
      setProgress(100);
      setResult(data);

      if (data.inserted > 0) {
        setTimeout(() => confetti({ particleCount: 60, spread: 60, origin: { y: 0.5 } }), 200);
        queryClient.invalidateQueries();
        useChatStore.getState().clearHistory();
        toast.success(`${data.inserted} transactions imported`);

        if (data.jobIds?.length) {
          setJobIds(data.jobIds);
          // Show all 3 steps as waiting initially
          setProcessingSteps([
            { name: 'Generating embeddings', status: 'waiting' },
            { name: 'Detecting subscriptions', status: 'waiting' },
            { name: 'Computing insights', status: 'waiting' },
          ]);
          setState('processing');
        } else {
          setState('done');
        }
      } else {
        setState('done');
      }
    } catch (err: unknown) {
      clearInterval(tick);
      const rawMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';
      const SAFE_UPLOAD_MSGS = ['password', 'format', 'empty', 'header', 'unsupported', 'row limit', 'column limit', 'invalid csv'];
      const msg = SAFE_UPLOAD_MSGS.some((k) => rawMsg.toLowerCase().includes(k)) ? rawMsg : 'Upload failed. Please check your file and try again.';
      setErrorMsg(msg);
      setState('error');
    }
  };

  const reset = () => {
    setState('idle');
    setFile(null);
    setPassword('');
    setSelectedBank('');
    setShowBankPicker(false);
    setResult(null);
    setProgress(0);
    setErrorMsg('');
    setJobIds([]);
    setProcessingSteps([]);
  };

  const close = () => {
    setUploadDialog(false);
    setTimeout(reset, 300);
  };

  return (
    <Dialog open={uploadDialogOpen} onOpenChange={(open) => { if (!open && state !== 'uploading') close(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Import Bank Statement</DialogTitle>
        </DialogHeader>

        {state === 'idle' && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById('csv-input')?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-150 ${
              dragOver
                ? 'border-[var(--color-brand)] bg-[var(--color-brand-muted)]'
                : 'border-border hover:border-[var(--color-brand)]/50 hover:bg-secondary/50'
            }`}
          >
            <UploadCloud className={`h-10 w-10 mx-auto mb-3 transition-transform duration-150 ${dragOver ? 'scale-110 text-[var(--color-brand)]' : 'text-muted-foreground'}`} />
            <p className="text-sm font-medium text-foreground mb-1">Drop your statement here</p>
            <p className="text-xs text-muted-foreground">CSV, XLSX or PDF · Max 10MB</p>
            <p className="text-xs text-muted-foreground mt-2">HDFC · ICICI · SBI · Axis · Kotak</p>
            <input id="csv-input" type="file" accept={ACCEPTED} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        )}

        {state === 'selected' && file && (
          <div className="space-y-4">
            {/* File row */}
            <div className="flex items-center gap-3 p-3 bg-secondary rounded-xl">
              <FileText className="h-5 w-5 text-[var(--color-brand)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={reset} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Bank selector */}
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Your bank</p>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowBankPicker((v) => !v)}
                  className="w-full flex items-center justify-between px-3 h-9 rounded-lg border border-border bg-background text-sm hover:bg-secondary transition-colors"
                >
                  <span className={selectedBank ? 'text-foreground' : 'text-muted-foreground'}>
                    {BANKS.find((b) => b.id === selectedBank)?.label ?? 'Select bank…'}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
                {showBankPicker && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-popover shadow-md overflow-hidden">
                    {BANKS.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => { setSelectedBank(b.id); setShowBankPicker(false); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-secondary transition-colors ${selectedBank === b.id ? 'text-[var(--color-brand)] font-medium' : 'text-foreground'}`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Password field — always visible */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Lock className="h-3 w-3" />
                <span>Password <span className="font-normal">(if statement is protected)</span></span>
              </div>
              <Input
                type="password"
                placeholder={selectedBank
                  ? (BANKS.find((b) => b.id === selectedBank)?.hint ?? 'Enter password')
                  : 'Select your bank above for a hint'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 text-sm"
              />
              {selectedBank && (
                <p className="text-[10px] text-muted-foreground">
                  {BANKS.find((b) => b.id === selectedBank)?.hint}
                </p>
              )}
            </div>

            <Button onClick={() => setState('confirm')} className="w-full bg-foreground text-background hover:bg-foreground/85">
              <UploadCloud className="h-4 w-4 mr-2" />
              Import {file.name}
            </Button>
          </div>
        )}

        {state === 'confirm' && file && (
          <div className="space-y-4 py-2">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-400">
              <p className="font-semibold mb-1">⚠ This will replace all existing data</p>
              <p className="text-amber-400/80">
                Uploading <span className="font-medium text-amber-300">{file.name}</span> will
                delete all your current transactions and re-run subscription detection.
                This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 border-white/10" onClick={() => setState('selected')}>
                Go back
              </Button>
              <Button onClick={upload} className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-semibold">
                Confirm &amp; Replace
              </Button>
            </div>
          </div>
        )}

        {state === 'uploading' && (
          <div className="space-y-4 py-4">
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--color-brand)]" />
            </div>
            <Progress value={progress} className="h-1.5" />
            <p className="text-sm text-center text-muted-foreground">
              {progress < 30 ? 'Uploading...' : progress < 60 ? 'Parsing transactions...' : progress < 85 ? 'Categorizing...' : 'Detecting subscriptions...'}
            </p>
          </div>
        )}

        {state === 'processing' && result && (
          <div className="space-y-5 py-2">
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="h-10 w-10 text-[var(--color-success)]" />
              <p className="text-base font-semibold text-foreground">{result.inserted} transactions imported</p>
              <p className="text-xs text-muted-foreground">AI is processing your data in the background\u2026</p>
            </div>
            <div className="space-y-2.5">
              {processingSteps.map((step, i) => {
                const isDone = step.status === 'completed';
                const isFailed = step.status === 'failed';
                const isActive = step.status === 'active';
                return (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    {isDone ? (
                      <CheckCircle className="h-4 w-4 text-[var(--color-success)] flex-shrink-0" />
                    ) : isFailed ? (
                      <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                    ) : isActive ? (
                      <Loader2 className="h-4 w-4 text-[var(--color-brand)] animate-spin flex-shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border border-border flex-shrink-0" />
                    )}
                    <span className={isDone ? 'text-muted-foreground line-through' : 'text-foreground'}>
                      {step.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {state === 'done' && result && (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="h-10 w-10 text-[var(--color-success)]" />
              <p className="text-base font-semibold text-foreground">{result.inserted} transactions imported</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[var(--color-success-muted)] rounded-lg p-3">
                <p className="text-lg font-bold text-[var(--color-success)] font-mono">{result.inserted}</p>
                <p className="text-xs text-muted-foreground">Added</p>
              </div>
              <div className="bg-secondary rounded-lg p-3">
                <p className="text-lg font-bold text-foreground font-mono">{result.skipped}</p>
                <p className="text-xs text-muted-foreground">Duplicates</p>
              </div>
              <div className={`rounded-lg p-3 ${result.failed > 0 ? 'bg-red-50 dark:bg-red-950/20' : 'bg-secondary'}`}>
                <p className={`text-lg font-bold font-mono ${result.failed > 0 ? 'text-destructive' : 'text-foreground'}`}>{result.failed}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>
            <Button onClick={close} className="w-full bg-foreground text-background hover:bg-foreground/85">
              View your dashboard →
            </Button>
          </div>
        )}

        {state === 'error' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <AlertCircle className="h-10 w-10 text-destructive" />
            <p className="text-sm text-muted-foreground text-center">{errorMsg || 'Upload failed. Check your file and try again.'}</p>
            {errorMsg.toLowerCase().includes('password') && (
              <p className="text-xs text-muted-foreground text-center">Try entering the correct password for your bank statement.</p>
            )}
            <Button variant="outline" onClick={reset} className="w-full">Try again</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
