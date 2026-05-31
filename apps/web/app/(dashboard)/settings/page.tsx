'use client';
import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle, User, Database } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { api } from '@/lib/api';
import type { UserPreferences } from '@/lib/api';
import { useAuthStore } from '@/store';

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const qc = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [clearDialog, setClearDialog] = useState(false);

  const prefsQuery = useQuery<UserPreferences>({
    queryKey: ['user-preferences'],
    queryFn: () => api.get<UserPreferences>('/users/preferences').then((r) => r.data),
  });

  const [localPrefs, setLocalPrefs] = useState<UserPreferences>({
    weeklyEmail: true, newSubAlert: true, spikeAlert: false, timezone: 'Asia/Kolkata',
  });

  // Sync local state when server data arrives
  useEffect(() => {
    if (prefsQuery.data) setLocalPrefs(prefsQuery.data);
  }, [prefsQuery.data]);

  const updatePrefs = useMutation({
    mutationFn: (prefs: Partial<UserPreferences>) => api.patch<UserPreferences>('/users/preferences', prefs).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['user-preferences'], data);
      toast.success('Preferences saved');
    },
    onError: () => toast.error('Failed to save preferences'),
  });

  const handleToggle = (key: keyof UserPreferences, value: boolean) => {
    const next = { ...localPrefs, [key]: value };
    setLocalPrefs(next);
    updatePrefs.mutate({ [key]: value });
  };

  const deleteAccount = useMutation({
    mutationFn: () => api.delete('/users/me').then((r) => r.data),
    onSuccess: () => { logout(); toast.success('Account deleted'); router.push('/login'); },
    onError: () => toast.error('Failed to delete account'),
  });

  const clearData = useMutation({
    mutationFn: () => api.delete('/transactions/all').then((r) => r.data),
    onSuccess: () => {
      setClearDialog(false);
      qc.invalidateQueries();
      toast.success('All transaction data cleared');
      router.refresh();
    },
    onError: () => toast.error('Failed to clear data'),
  });

  const notificationItems = [
    { id: 'weeklyEmail' as keyof UserPreferences, label: 'Weekly AI summary email', description: 'Get a weekly savings report every Monday' },
    { id: 'newSubAlert' as keyof UserPreferences, label: 'New subscription detected', description: 'Alert when a recurring charge is found' },
    { id: 'spikeAlert' as keyof UserPreferences, label: 'Unusual spending spike', description: 'Alert when spending is significantly higher than usual' },
  ];

  return (
    <div className="max-w-2xl space-y-6 pb-20 lg:pb-0">
      {/* Profile */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Profile</h2>
        </div>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-1.5 block">Email</Label>
            <div className="flex items-center gap-2">
              <Input value={user?.email ?? ''} readOnly className="h-10 bg-secondary cursor-not-allowed" />
              <span className="text-xs text-[var(--color-success)] font-medium whitespace-nowrap">Verified</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Database className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
        </div>
        <div className="space-y-4">
          {notificationItems.map((item) => (
            <div key={item.id} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              </div>
              <Switch
                checked={localPrefs[item.id] as boolean}
                onCheckedChange={(v) => handleToggle(item.id, v)}
                disabled={prefsQuery.isLoading || updatePrefs.isPending}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Danger zone */}
      <Card className="p-6 border-destructive/20 bg-red-50/40 dark:bg-red-950/10">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <h2 className="text-sm font-semibold text-destructive">Danger Zone</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Clear all transaction data</p>
              <p className="text-xs text-muted-foreground mt-0.5">Deletes all transactions and subscriptions. Use this before re-uploading fresh CSVs.</p>
            </div>
            <Button variant="outline" size="sm" className="border-amber-500/50 text-amber-600 hover:bg-amber-500 hover:text-white flex-shrink-0" onClick={() => setClearDialog(true)}>
              <Database className="h-3.5 w-3.5 mr-1.5" />Clear data
            </Button>
          </div>
          <div className="border-t border-destructive/10 pt-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Delete account</p>
              <p className="text-xs text-muted-foreground mt-0.5">Permanently deletes your account, all transactions, and AI data. Cannot be undone.</p>
            </div>
            <Button variant="outline" size="sm" className="border-destructive/50 text-destructive hover:bg-destructive hover:text-white flex-shrink-0" onClick={() => setDeleteDialog(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />Delete
            </Button>
          </div>
        </div>
      </Card>

      {/* Clear data dialog */}
      <Dialog open={clearDialog} onOpenChange={setClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear all transaction data?</DialogTitle>
            <DialogDescription>This removes all transactions and detected subscriptions. Your account stays intact.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setClearDialog(false)}>Cancel</Button>
            <Button className="flex-1 bg-amber-500 text-white hover:bg-amber-600" disabled={clearData.isPending} onClick={() => clearData.mutate()}>
              {clearData.isPending ? 'Clearing...' : 'Yes, clear data'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete account dialog */}
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>This will permanently delete all your data. Type <strong>DELETE</strong> to confirm.</DialogDescription>
          </DialogHeader>
          <Input placeholder="Type DELETE to confirm" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} className="mt-2" />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setDeleteDialog(false); setDeleteConfirm(''); }}>Cancel</Button>
            <Button className="flex-1 bg-destructive text-white hover:bg-destructive/90" disabled={deleteConfirm !== 'DELETE' || deleteAccount.isPending} onClick={() => deleteAccount.mutate()}>
              {deleteAccount.isPending ? 'Deleting...' : 'Delete permanently'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
