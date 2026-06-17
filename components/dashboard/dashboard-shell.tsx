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
    <div className="flex min-h-screen bg-zinc-50">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Header title={title} subtitle={subtitle} />
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}
