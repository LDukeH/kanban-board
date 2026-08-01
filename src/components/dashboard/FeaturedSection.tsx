import { cn } from "@/lib/utils";
import { FEATURED_GRADIENTS } from "@/lib/colors";
import { Workflow, BarChart3, Zap, Layers, ArrowRight } from "lucide-react";

interface FeaturedItem {
  title: string;
  description: string;
  icon: typeof Workflow;
  gradient: string;
}

const FEATURED_ITEMS: FeaturedItem[] = [
  {
    title: "Automations",
    description: "Streamline repetitive workflows with powerful rules.",
    icon: Zap,
    gradient: FEATURED_GRADIENTS[0],
  },
  {
    title: "Analytics",
    description: "Track progress and velocity with rich insights.",
    icon: BarChart3,
    gradient: FEATURED_GRADIENTS[1],
  },
  {
    title: "Templates",
    description: "Kickstart projects with battle-tested board layouts.",
    icon: Layers,
    gradient: FEATURED_GRADIENTS[2],
  },
  {
    title: "Integrations",
    description: "Connect your favorite tools in a single click.",
    icon: Workflow,
    gradient: FEATURED_GRADIENTS[3],
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
        <button className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80">
          View all
          <ArrowRight className="size-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURED_ITEMS.map((item) => (
          <div
            key={item.title}
            className={cn(
              "group relative cursor-pointer overflow-hidden rounded-xl bg-gradient-to-br p-4 text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg",
              item.gradient,
            )}
          >
            <div className="relative flex h-full flex-col">
              <div className="flex size-9 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                <item.icon className="size-5" />
              </div>
              <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
              <p className="mt-1 text-xs leading-snug text-white/85">
                {item.description}
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-white/90 opacity-0 transition-opacity group-hover:opacity-100">
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
