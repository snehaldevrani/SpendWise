import { Sidebar } from '@/components/layout/sidebar';
import { UploadDialog } from '@/components/upload-dialog';
import { AuthGuard } from '@/components/auth-guard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 md:ml-[240px] overflow-y-auto p-4 lg:p-8">
          {children}
        </main>
        <UploadDialog />
      </div>
    </AuthGuard>
  );
}
