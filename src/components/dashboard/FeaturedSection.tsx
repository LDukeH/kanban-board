import { cn } from "@/lib/utils";
import { Workflow, BarChart3, Zap, Layers, ArrowRight } from "lucide-react";

interface FeaturedItem {
  title: string;
  description: string;
  icon: typeof Workflow;
  /** Soft tint for the icon chip — keeps the card quiet so "Your boards" stays the focus. */
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

export function FeaturedSection() {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Get more done
          </h2>
          <p className="text-xs text-muted-foreground">
            Explore features and templates to supercharge your workflow.
          </p>
        </div>
        <button className="flex cursor-pointer items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80">
          View all
          <ArrowRight className="size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURED_ITEMS.map((item) => (
          <div
            key={item.title}
            className="group relative cursor-pointer rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex h-full flex-col">
              <div
                className={cn(
                  "flex size-10 items-center justify-center rounded-lg",
                  item.iconClass,
                )}
              >
                <item.icon className="size-5" />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-1 text-xs leading-snug text-muted-foreground">
                {item.description}
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Learn more
                <ArrowRight className="size-3.5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
