import { describe, expect, it, vi } from "vitest";

// Server-action plumbing that has no meaning outside a request (see
// award-job.test.ts). Business rules and Prisma lookups run real.
vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn().mockResolvedValue({
    id: "test-user",
    displayName: "Test User",
  }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  createJob,
  toggleJobFavorite,
  updateJobCustomerAction,
  updateJobStatusAction,
} from "@/app/jobs/actions";

// A thrown action error reaches the browser as a generic "An error occurred"
// in production, so these user-facing failures must come back as data.
describe("job actions return user-facing errors", () => {
  const missingJobId = "missing-job-for-action-error-test";

  it("rejects an invalid status", async () => {
    await expect(
      updateJobStatusAction(missingJobId, "NOT_A_STATUS"),
    ).resolves.toEqual({ error: "Invalid job status." });
  });

  it("reports a missing job on status and contractor changes", async () => {
    await expect(
      updateJobStatusAction(missingJobId, "QUOTING"),
    ).resolves.toEqual({ error: "Job was not found." });
    await expect(
      updateJobCustomerAction(missingJobId, null),
    ).resolves.toEqual({ error: "Job was not found." });
    await expect(toggleJobFavorite(missingJobId)).resolves.toEqual({
      error: "Job not found.",
    });
  });

  it("returns form validation errors from createJob", async () => {
    const result = await createJob(new FormData());
    expect(result).toEqual({ error: expect.stringMatching(/Project name/) });
  });
});
