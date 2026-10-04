import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  describeTemplateOutcome,
  materializeBoardTemplate,
  type BoardTemplate,
  type TemplateMaterializeResult,
} from "@/lib/templates";
import { useRecentStore } from "@/stores/recentStore";
import type { Board } from "@/types/board";

interface CreateFromTemplateVariables {
  template: BoardTemplate;
  name: string;
  description?: string;
}

/** Owns "create a board from a template" (Feature 4). */
export function useBoardTemplates(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  const createFromTemplateMutation = useMutation<
    TemplateMaterializeResult,
    Error,
    CreateFromTemplateVariables
  >({
    mutationFn: ({ template, name, description }) =>
      materializeBoardTemplate(workspaceId!, template, name, description),
    onSuccess: (result) => {
      // The board exists even when a later column/label call failed, so it must appear in the workspace list either way.
      queryClient.setQueryData<Board[]>(
        ["workspaces", workspaceId, "boards"],
        (old) => (old ? [...old, result.board] : [result.board]),
      );
      useRecentStore.getState().recordBoard({
        id: result.board.id,
        name: result.board.name,
        workspaceId: result.board.workspaceId,
      });

      // Drop the columns/labels caches so the board's first read shows exactly what was created.
      queryClient.removeQueries({
        queryKey: ["boards", result.board.id, "columns"],
      });
      queryClient.removeQueries({
        queryKey: ["boards", result.board.id, "labels"],
      });
    },
  });

  return {
    /** Resolves with the full materialisation result — including any per-row failures — so the caller can report exactly what was created. */
    createBoardFromTemplate: createFromTemplateMutation.mutateAsync,
    isCreatingFromTemplate: createFromTemplateMutation.isPending,
    describeOutcome: describeTemplateOutcome,
  };
}
