import { Sidebar } from "@/components/layout/Sidebar";
import { cn } from "@/lib/utils";
import { useState, useEffect, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardLayoutProps {
  children: ReactNode;
  className?: string;
}

export function DashboardLayout({ children, className }: DashboardLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close the sidebar when resizing up to desktop.
  useEffect(() => {
    const onResize = () => {
      if (typeof window !== "undefined" && window.innerWidth >= 768) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden bg-background relative">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className={cn("flex flex-1 flex-col overflow-y-auto", className)}>
        {/* Mobile header: hamburger toggle only (page headers render below) */}
        <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-border md:hidden">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </main>
    </div>
  );
}
