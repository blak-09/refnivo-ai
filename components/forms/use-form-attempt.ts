import * as React from "react";
import type { ActionResult } from "@/lib/utils/action-result";

/**
 * React 19 resets uncontrolled <form> fields after an action completes. When
 * the action fails validation we echo the submitted values back; remounting
 * the form (via this key) makes every field — including <select> — pick up
 * those values as its new default.
 */
export function useFormAttempt(state: ActionResult<unknown> | null): number {
  const [attempt, setAttempt] = React.useState(0);
  const [seen, setSeen] = React.useState(state);
  // Derive during render (React-recommended) instead of setState inside an effect.
  if (state !== seen) {
    setSeen(state);
    if (state && !state.ok && state.values) setAttempt((n) => n + 1);
  }
  return attempt;
}
