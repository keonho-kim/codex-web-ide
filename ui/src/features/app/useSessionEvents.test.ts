import { expect, test } from "bun:test";
import { createBatchedInvalidator } from "@/features/app/useSessionEvents";

test("batches duplicate session event query invalidations", async () => {
  const invalidated: unknown[][] = [];
  const invalidate = createBatchedInvalidator({
    invalidateQueries: ({ queryKey }: { queryKey: readonly unknown[] }) => {
      invalidated.push([...queryKey]);
      return Promise.resolve();
    },
  });

  invalidate(["sessions"]);
  invalidate(["sessions"]);
  invalidate(["git", "session-1"]);
  invalidate.flush();

  expect(invalidated).toEqual([["sessions"], ["git", "session-1"]]);
});
