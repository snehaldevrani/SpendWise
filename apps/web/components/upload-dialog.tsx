'use client';
import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UploadCloud, FileText, CheckCircle, AlertCircle, Loader2, X, Lock } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api';
import { useUIStore } from '@/store';
import type { CsvImportResult } from '@/lib/types';

type UploadState = 'idle' | 'selected' | 'uploading' | 'done' | 'error';

const ACCEPTED = '.csv,.xlsx,.xls';

export function UploadDialog() {
  const { uploadDialogOpen, setUploadDialog } = useUIStore();
  const queryClient = useQueryClient();
  const [state, setState] = useState<UploadState>('idle');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFile = useCallback((f: File) => {
    const ext = f.name.toLowerCase();
    if (!ext.endsWith('.csv') && !ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      toast.error('Supported: CSV, XLS, XLSX');
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
      setState('done');

      if (data.inserted > 0) {
        setTimeout(() => confetti({ particleCount: 60, spread: 60, origin: { y: 0.5 } }), 200);
        queryClient.invalidateQueries();
        toast.success(`${data.inserted} transactions imported`);
      }
    } catch (err: unknown) {
      clearInterval(tick);
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Upload failed';
      setErrorMsg(msg);
      setState('error');
    }
  };

  const reset = () => {
    setState('idle');
    setFile(null);
    setPassword('');
    setResult(null);
    setProgress(0);
    setErrorMsg('');
  };

  const close = () => {
    setUploadDialog(false);
    setTimeout(reset, 300);
  };

  const needsPassword = file && /\.(xlsx?|xls)$/i.test(file.name);

  return (
    <Dialog open={uploadDialogOpen} onOpenChange={close}>
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
            <p className="text-xs text-muted-foreground">CSV, XLS, or XLSX · Max 10MB</p>
            <p className="text-xs text-muted-foreground mt-2">HDFC · ICICI · SBI · Axis · Kotak</p>
            <input id="csv-input" type="file" accept={ACCEPTED} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        )}

        {state === 'selected' && file && (
          <div className="space-y-4">
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

            {needsPassword && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  <span>Password (if file is protected)</span>
                </div>
                <Input
                  type="password"
                  placeholder="e.g. first 4 letters of name + DOB (DDMM)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9 text-sm"
                />
                <p className="text-[10px] text-muted-foreground">
                  HDFC: Customer ID · ICICI: NAME(4) + DOB(DDMM) · SBI: AccNo + DOB · Axis: DOB(DDMMYYYY)
                </p>
              </div>
            )}

            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-xs text-amber-800 dark:text-amber-400 font-medium">
                This will replace your existing data with the new file.
              </p>
            </div>

            <Button onClick={upload} className="w-full bg-foreground text-background hover:bg-foreground/85">
              <UploadCloud className="h-4 w-4 mr-2" />
              Import {file.name}
            </Button>
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
