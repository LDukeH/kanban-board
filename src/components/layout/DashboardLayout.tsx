import { Sidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface DashboardLayoutProps {
  children: ReactNode;
  className?: string;
}

export function DashboardLayout({ children, className }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className={cn("flex flex-1 flex-col overflow-y-auto", className)}>
        {children}
      </main>
    </div>
  );
}
