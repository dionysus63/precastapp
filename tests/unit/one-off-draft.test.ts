import { describe, expect, it } from "vitest";

import {
  countDraftRows,
  defaultDraftName,
  describeDraftJob,
  describeDraftShape,
  normalizeDraftName,
  parseOneOffDraftState,
  serializeOneOffDraftState,
  type OneOffDraftState,
} from "@/lib/quotes/one-off-draft";
import {
  ONE_OFF_MAX_OPENINGS,
  buildRowsFromSetup,
  createEmptySection,
  createEmptySetup,
} from "@/lib/quotes/one-off-drill-sheets";

function sampleState(): OneOffDraftState {
  const setup = {
    ...createEmptySetup("CIRCULAR"),
    templateId: "tpl",
    diameterFeet: "4",
    castingProductId: "cast",
    pipeType: "PVC SDR35",
    pipeSize: "8",
    quantity: "2",
    startNumber: "3",
  };
  const rows = buildRowsFromSetup(setup, 2);
  rows[0].rimElevation = "100.5";
  rows[0].openings[0].invert = "95.25";
  rows[0].openings[0].angle = "90";
  rows[1].openings[1] = { invert: "94", angle: "", wall: "LEFT" };
  return {
    version: 1,
    job: { mode: "existing", jobId: "job-1" },
    jobConfirmed: true,
    shapeChoice: "BOTH",
    rectUnlocked: true,
    circular: { setup, rows, openingCount: 2 },
    rect: createEmptySection("RECTANGULAR"),
  };
}

describe("one-off draft state", () => {
  it("round-trips through JSON unchanged", () => {
    const state = sampleState();
    const parsed = parseOneOffDraftState(serializeOneOffDraftState(state));
    expect(parsed).toEqual(state);
  });

  it("accepts an already-parsed object from the client", () => {
    const state = sampleState();
    expect(parseOneOffDraftState(JSON.parse(JSON.stringify(state)))).toEqual(
      state,
    );
  });

  it("rejects things that aren't a draft", () => {
    expect(parseOneOffDraftState("not json")).toBeNull();
    expect(parseOneOffDraftState(null)).toBeNull();
    expect(parseOneOffDraftState([1, 2])).toBeNull();
  });

  it("falls back field by field instead of failing on a malformed draft", () => {
    const parsed = parseOneOffDraftState({
      job: { mode: "existing", jobId: "" },
      jobConfirmed: true,
      shapeChoice: "TRIANGLE",
      circular: {
        openingCount: 99,
        setup: { templateId: 5 },
        rows: [
          { id: "r1", structureNumber: "MH-1", openings: [{ invert: 7, wall: "SIDEWAYS" }] },
          { structureNumber: "no id" },
          "junk",
        ],
      },
      rect: "nope",
    });
    expect(parsed).not.toBeNull();
    // A blank job id is no job, so the step can't count as confirmed.
    expect(parsed!.job).toBeNull();
    expect(parsed!.jobConfirmed).toBe(false);
    expect(parsed!.shapeChoice).toBeNull();
    expect(parsed!.circular.openingCount).toBe(ONE_OFF_MAX_OPENINGS);
    expect(parsed!.circular.setup.templateId).toBe("");
    expect(parsed!.circular.setup.prefix).toBe("MH-");
    expect(parsed!.circular.rows).toHaveLength(1);
    const row = parsed!.circular.rows![0];
    expect(row.openings).toHaveLength(ONE_OFF_MAX_OPENINGS);
    expect(row.openings[0]).toEqual({ invert: "", angle: "", wall: "UP" });
    expect(parsed!.rect).toEqual(createEmptySection("RECTANGULAR"));
  });

  it("keeps a new-job draft's typed fields and contractor label", () => {
    const state: OneOffDraftState = {
      ...sampleState(),
      job: {
        mode: "new",
        fields: {
          customerId: null,
          customerName: "ACME",
          projectName: "Main St",
          projectAddress: "",
          city: "",
          state: "",
          zip: "",
          contactName: "",
          contactPhone: "",
          contactEmail: "",
        },
        customerLabel: "",
      },
    };
    const parsed = parseOneOffDraftState(serializeOneOffDraftState(state));
    expect(parsed!.job).toEqual(state.job);
    expect(describeDraftJob(parsed!.job, null)).toBe("New job — Main St (ACME)");
  });
});

describe("describing a draft", () => {
  it("counts only the rows the chosen shape would create", () => {
    const state = sampleState();
    expect(countDraftRows(state)).toBe(2);
    expect(countDraftRows({ ...state, shapeChoice: "RECTANGULAR" })).toBe(0);
    expect(countDraftRows({ ...state, shapeChoice: null })).toBe(0);
  });

  it("labels the job, or says when it is gone", () => {
    const job = { jobNumber: "J26-0412", projectName: "Main St", customerName: "ACME" };
    expect(describeDraftJob({ mode: "existing", jobId: "x" }, job)).toBe(
      "J26-0412 — Main St (ACME)",
    );
    expect(describeDraftJob({ mode: "existing", jobId: "x" }, null)).toBe(
      "Job no longer exists",
    );
    expect(describeDraftJob(null, null)).toBe("");
    expect(describeDraftShape("BOTH")).toBe("Circular + rectangular");
  });

  it("names a draft after its job, else the date", () => {
    expect(defaultDraftName("J26-0412 — Main St (ACME)")).toBe(
      "J26-0412 — Main St (ACME)",
    );
    expect(defaultDraftName("", new Date(2026, 9, 31))).toBe("One-Off Oct 31");
    expect(normalizeDraftName("  two   words \n")).toBe("two words");
    expect(normalizeDraftName("x".repeat(200))).toHaveLength(80);
  });
});
