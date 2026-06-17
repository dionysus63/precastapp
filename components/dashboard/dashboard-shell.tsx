import { Header } from "./header";
import { Sidebar } from "./sidebar";

type DashboardShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function DashboardShell({
  title,
  subtitle,
  children,
}: DashboardShellProps) {
  return (
    <div className="flex min-h-screen bg-slate-50/80">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <Header title={title} subtitle={subtitle} />
        <main className="flex-1 px-5 py-5">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
