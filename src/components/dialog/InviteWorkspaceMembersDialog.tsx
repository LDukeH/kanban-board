import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  useSearchUsers,
  useWorkspaceMembers,
  useWorkspaceMemberActions,
} from "@/hooks/useWorkspaces";
import { cn } from "@/lib/utils";
import {
  Search,
  Loader2,
  Check,
  UserPlus,
  Users,
} from "lucide-react";
import type { SearchedUser } from "@/types/workspace";
import {
  emailInitial,
  emailToHandle,
  avatarGradient,
} from "@/lib/memberDisplay";

interface InviteWorkspaceMembersDialogProps {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteWorkspaceMembersDialog({
  workspaceId,
  open,
  onOpenChange,
}: InviteWorkspaceMembersDialogProps) {
  // Debounced search input → query consumed by `useSearchUsers`.
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SearchedUser[]>([]);
  const [error, setError] = useState<string | null>(null);

  const search = useSearchUsers(query);
  const membersQuery = useWorkspaceMembers(workspaceId);
  const { addMember, isAdding } = useWorkspaceMemberActions(workspaceId);

  const members = membersQuery.data ?? [];

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const existingEmails = new Set(
    members.map((m) => m.email.toLowerCase()),
  );

  const availableUsers = (search.data ?? []).filter(
    (u) => !existingEmails.has(u.email.toLowerCase()),
  );

  function toggleSelect(user: SearchedUser) {
    setSelected((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user],
    );
  }

  async function handleAdd() {
    if (selected.length === 0) return;
    setError(null);
    try {
      await Promise.all(
        selected.map((user) =>
          addMember({ email: user.email, role: "member" }),
        ),
      );
      onOpenChange(false);
    } catch (err) {
      setError("Failed to invite members. Please try again.");
      console.error("Invite members failed:", err);
    }
  }

  const hasQuery = query.trim().length >= 2;
return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-md">
        <DialogTitle>Invite Workspace Members</DialogTitle>
        <DialogDescription className="mt-1">
          Search users by email and add them as members.
        </DialogDescription>

        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            autoFocus
          />
        </div>

        <div className="mt-3 max-h-64 overflow-y-auto">
          {!hasQuery ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Type at least 2 characters to search.
            </p>
          ) : search.isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : availableUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
              <Users className="size-5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No users found{query.trim() ? ` for “${query.trim()}”` : ""}.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {availableUsers.map((user) => {
                const isSelected = selected.some((u) => u.id === user.id);
                return (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => toggleSelect(user)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted",
                        isSelected && "bg-muted",
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white",
                          avatarGradient(user.id || user.email),
                        )}
                      >
                        {emailInitial(user.email)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {user.email}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {emailToHandle(user.email)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "flex size-5 items-center justify-center rounded-full border transition-colors",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-transparent",
                        )}
                      >
                        <Check className="size-3.5" />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {error && (
          <p className="mt-3 text-xs text-destructive">{error}</p>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {selected.length
              ? `${selected.length} selected`
              : "Select users to invite"}
          </p>
          <div className="flex items-center gap-2">
            <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
            <Button
              disabled={selected.length === 0 || isAdding}
              onClick={handleAdd}
            >
              {isAdding && <Loader2 className="size-4 animate-spin" />}
              <UserPlus className="size-4" />
              Add
            </Button>
          </div>
        </div>
      </DialogPopup>
    </Dialog>
  );
}