import { useCallback, useState } from "react";
import { readFlag, writeFlag } from "@/lib/persistentFlag";

/** Boolean UI state (an expanded panel, a dismissed card) that survives reloads via localStorage. */
export function usePersistentFlag(key: string, defaultValue = false) {
  const [value, setValue] = useState<boolean>(() =>
    readFlag(key, defaultValue),
  );

  const set = useCallback(
    (next: boolean) => {
      setValue(next);
      writeFlag(key, next);
    },
    [key],
  );

  const toggle = useCallback(() => {
    setValue((current) => {
      const next = !current;
      writeFlag(key, next);
      return next;
    });
  }, [key]);

  return { value, setValue: set, toggle };
}