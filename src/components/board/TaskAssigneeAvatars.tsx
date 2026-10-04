import { cn } from "@/lib/utils";
import type { TaskAssignee } from "@/types/board";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  emailInitial,
  emailToHandle,
  avatarGradient,
} from "@/lib/memberDisplay";

/** How many avatar circles are shown before collapsing into "+N". */
const MAX_VISIBLE = 2;

export function TaskAssigneeAvatars({
  assignees,
}: {
  assignees: TaskAssignee[];
}) {
  if (assignees.length === 0) {
    return null;
  }

  const visible = assignees.slice(0, MAX_VISIBLE);
  const overflow = assignees.length - MAX_VISIBLE;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="group/assignees -space-x-1.5 flex shrink-0 cursor-pointer items-center rounded-full outline-none"
        aria-label={`Assigned users (${assignees.length})`}
      >
        {visible.map((assignee) => (
          <AvatarCircle key={assignee.user_id} assignee={assignee} />
        ))}
        {overflow > 0 && (
          <span className="relative flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground ring-2 ring-background transition-colors group-hover/assignees:bg-primary/15">
            +{overflow}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Assigned users</DropdownMenuLabel>
          {assignees.map((assignee) => (
            <div
              key={assignee.user_id}
              className="flex items-center gap-2 px-1.5 py-1"
            >
              <AvatarCircle assignee={assignee} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{assignee.email}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {emailToHandle(assignee.email)}
                </span>
              </span>
            </div>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AvatarCircle({
  assignee,
  className,
}: {
  assignee: TaskAssignee;
  className?: string;
}) {
  return (
    <span
      title={assignee.email}
      className={cn(
        "relative flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white ring-2 ring-background",
        avatarGradient(assignee.user_id || assignee.email),
        className,
      )}
    >
      {emailInitial(assignee.email)}
    </span>
  );
}
