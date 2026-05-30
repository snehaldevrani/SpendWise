import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { MobileNav } from '@/components/layout/mobile-nav';
import { UploadDialog } from '@/components/upload-dialog';
import { AuthGuard } from '@/components/auth-guard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 ml-0 lg:ml-60">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 lg:p-8 page-enter">
            {children}
          </main>
        </div>
        <MobileNav />
        <UploadDialog />
      </div>
    </AuthGuard>
  );
}
