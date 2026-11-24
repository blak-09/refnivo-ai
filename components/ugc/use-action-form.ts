"use client";

import * as React from "react";
import { useActionState } from "react";
import type { ActionResult } from "@/lib/utils/action-result";

/**
 * useActionState for forms that must keep what the user typed: the submit is
 * dispatched from onSubmit inside a transition, so React never resets the
 * uncontrolled fields after a failed (or successful) submission.
 */
export function useActionForm(action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>) {
  const [state, dispatch, pending] = useActionState(action, null);
  const onSubmit = React.useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null);
      React.startTransition(() => dispatch(fd));
    },
    [dispatch],
  );
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  return { state, pending, onSubmit, errors, error: state && !state.ok ? state.error : null };
}
