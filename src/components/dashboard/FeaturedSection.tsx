import { cn } from "@/lib/utils";
import { Workflow, BarChart3, Zap, Layers, X } from "lucide-react";
import { usePersistentFlag } from "@/hooks/usePersistentFlag";

interface FeaturedItem {
  title: string;
  description: string;
  icon: typeof Workflow;
  iconClass: string;
}

const FEATURED_ITEMS: FeaturedItem[] = [
  {
    title: "Automations",
    description: "Streamline repetitive workflows with powerful rules.",
    icon: Zap,
    iconClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  {
    title: "Analytics",
    description: "Track progress and velocity with rich insights.",
    icon: BarChart3,
    iconClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    title: "Templates",
    description: "Kickstart projects with battle-tested board layouts.",
    icon: Layers,
    iconClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    title: "Integrations",
    description: "Connect your favorite tools in a single click.",
    icon: Workflow,
    iconClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
];

/** Promotional feature cards. */
export function FeaturedSection({ className }: { className?: string }) {
  const { value: dismissed, setValue } = usePersistentFlag(
    "kanban-featured-dismissed",
    false,
  );

  if (dismissed) return null;

  return (
    <section className={cn(className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Get more done
          </h2>
          <p className="text-xs text-muted-foreground">
            Features on the way to supercharge your workflow.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setValue(true)}
          aria-label="Dismiss Get more done"
          title="Dismiss"
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-control text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURED_ITEMS.map((item) => (
          <div
            key={item.title}
            className="rounded-card border border-border bg-card/60 p-4"
          >
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-2">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-control",
                    item.iconClass,
                  )}
                >
                  <item.icon className="size-5" aria-hidden />
                </div>
                <span className="shrink-0 rounded-control bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Coming soon
                </span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                {item.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
