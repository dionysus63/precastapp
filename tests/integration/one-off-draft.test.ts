import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Server-action plumbing that has no meaning outside a request (see
// one-off-drill-sheets.test.ts). Job numbering and the saved structures run
// real.
vi.mock("@/lib/auth/session", () => ({
  requirePermission: vi.fn().mockResolvedValue({
    id: "test-user",
    displayName: "Draft Tester",
  }),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/job-folders", () => ({
  createJobFoldersForJob: vi.fn().mockResolvedValue("C:\\test-job-folders\\job"),
}));

import { createOneOffDrillSheets } from "@/app/quotes/one-off-actions";
import {
  deleteOneOffDraft,
  saveOneOffDraft,
} from "@/app/quotes/one-off-draft-actions";
import { createJobRecord } from "@/lib/job-create";
import { prisma } from "@/lib/prisma";
import {
  parseOneOffDraftState,
  type OneOffDraftState,
} from "@/lib/quotes/one-off-draft";
import {
  loadOneOffDraftForResume,
  loadOneOffDraftSummaries,
} from "@/lib/quotes/one-off-draft-load";
import {
  buildRowsFromSetup,
  computeCircularOneOffRow,
  createEmptySection,
  createEmptySetup,
  type OneOffCircularOptions,
} from "@/lib/quotes/one-off-drill-sheets";

const tag = `ONEOFFDRAFT-${Date.now()}`;
// An odd mold size no real catalog uses, so the scratch row can't collide.
const DIAMETER = 9.41;

let templateId: string;
let diameterConfigId: string;
let options: OneOffCircularOptions;

beforeAll(async () => {
  const template = await prisma.structureTemplate.create({
    data: {
      name: `${tag} MH`,
      shape: "CIRCULAR",
      wallThicknessInches: 8,
      diameters: { create: { insideDiameterFeet: DIAMETER } },
    },
  });
  templateId = template.id;
  const config = await prisma.structureDiameterConfig.create({
    data: {
      insideDiameterFeet: DIAMETER,
      wallThicknessInches: 8,
      maxBaseHeightFeet: 4,
      maxRiserHeightFeet: 4,
      keyHeightFeet: 0.33,
    },
  });
  diameterConfigId = config.id;

  options = {
    templates: [
      {
        id: templateId,
        name: template.name,
        agencyStandard: null,
        wallThicknessInches: 8,
        baseSlabThicknessInches: 8,
        topSlabThicknessInches: 16,
        minimumBrickInches: 4,
        connectionType: "KOR_N_SEAL",
        sumpMode: "DEFAULT",
        sumpFixedInches: null,
        openingToJointMinTopInches: 4,
        openingToJointMinBottomInches: 4,
        topSlabOpeningInches: null,
        defaultCastingProductId: null,
        defaultCastingHeightFeet: null,
        diameters: [{ id: "d", insideDiameterFeet: DIAMETER }],
      },
    ],
    castings: [{ id: "cast", name: "Frame", heightFeet: 0.5 }],
    pipeOpeningSizes: [],
    diameterConfigs: [
      {
        label: null,
        insideDiameterFeet: DIAMETER,
        wallThicknessInches: 8,
        maxBaseHeightFeet: 4,
        maxRiserHeightFeet: 4,
        keyHeightFeet: 0.33,
        wallPricePerFoot: 0,
        basePrice: 0,
      },
    ],
  };
});

afterAll(async () => {
  await prisma.oneOffDraft.deleteMany({ where: { name: { startsWith: tag } } });
  await prisma.jobStructure.deleteMany({ where: { structureTemplateId: templateId } });
  await prisma.job.deleteMany({ where: { projectName: { startsWith: tag } } });
  await prisma.structureTemplate.deleteMany({ where: { id: templateId } });
  await prisma.structureDiameterConfig.deleteMany({ where: { id: diameterConfigId } });
  await prisma.$disconnect();
});

/** A circular grid with `numbers.length` rows, the first one fully ready. */
function circularSection(numbers: string[]) {
  const setup = {
    ...createEmptySetup("CIRCULAR"),
    templateId,
    diameterFeet: String(DIAMETER),
    castingProductId: "cast",
    pipeType: "PVC",
    pipeSize: "8",
    quantity: String(numbers.length),
  };
  const rows = buildRowsFromSetup(setup, 2);
  rows.forEach((row, index) => {
    row.structureNumber = numbers[index];
  });
  rows[0].rimElevation = "100";
  rows[0].openings[0].invert = "92";
  return { setup, rows, openingCount: 2 };
}

function newJobDraft(projectName: string): OneOffDraftState {
  return {
    version: 1,
    job: {
      mode: "new",
      fields: {
        customerId: null,
        customerName: "Walk-up Contractor",
        projectName,
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
    jobConfirmed: true,
    shapeChoice: "CIRCULAR",
    rectUnlocked: false,
    circular: circularSection(["MH-1", "MH-2"]),
    rect: createEmptySection("RECTANGULAR"),
  };
}

function unwrap<T>(result: T | { error: string }): T {
  if (result && typeof result === "object" && "error" in result) {
    throw new Error(result.error);
  }
  return result as T;
}

describe("saving a One-Off for later", () => {
  it("saves a new-job draft, names it after the job, and lists it", async () => {
    const state = newJobDraft(`${tag} Unnamed`);
    const saved = unwrap(await saveOneOffDraft({ id: null, name: "   ", state }));

    expect(saved.name).toBe(`New job — ${tag} Unnamed (Walk-up Contractor)`);
    expect(saved.savedBy).toBe("Draft Tester");

    const stored = await prisma.oneOffDraft.findUniqueOrThrow({
      where: { id: saved.id },
    });
    expect(stored.jobId).toBeNull();
    expect(parseOneOffDraftState(stored.draftJson)).toEqual(state);

    const summary = (await loadOneOffDraftSummaries()).find(
      (entry) => entry.id === saved.id,
    );
    expect(summary).toMatchObject({
      name: saved.name,
      jobLabel: `New job — ${tag} Unnamed (Walk-up Contractor)`,
      jobMissing: false,
      shapeChoice: "CIRCULAR",
      rowCount: 2,
      savedBy: "Draft Tester",
    });

    // Tidy: the name doesn't start with the tag, so afterAll won't catch it.
    await prisma.oneOffDraft.delete({ where: { id: saved.id } });
  });

  it("updates a draft in place and renames it", async () => {
    const first = unwrap(
      await saveOneOffDraft({
        id: null,
        name: `${tag} first`,
        state: newJobDraft(`${tag} Renamed`),
      }),
    );
    const changed = newJobDraft(`${tag} Renamed`);
    changed.circular.rows![1].rimElevation = "101";
    const second = unwrap(
      await saveOneOffDraft({ id: first.id, name: `${tag} second`, state: changed }),
    );

    expect(second.id).toBe(first.id);
    expect(second.name).toBe(`${tag} second`);
    const stored = await prisma.oneOffDraft.findMany({
      where: { name: { startsWith: `${tag} ` } },
    });
    expect(stored).toHaveLength(1);
    expect(parseOneOffDraftState(stored[0].draftJson)?.circular.rows?.[1].rimElevation).toBe(
      "101",
    );

    unwrap(await deleteOneOffDraft(first.id));
    expect(await prisma.oneOffDraft.findUnique({ where: { id: first.id } })).toBeNull();
  });

  it("refuses an empty draft and malformed state", async () => {
    expect(await saveOneOffDraft({ id: null, name: "x", state: "nonsense" })).toEqual({
      error: "There is nothing to save yet.",
    });
    expect(
      await saveOneOffDraft({
        id: null,
        name: "x",
        state: { ...newJobDraft("x"), job: null, circular: createEmptySection("CIRCULAR") },
      }),
    ).toEqual({ error: "Pick a job or build a grid before saving a draft." });
  });

  it("reloads an existing job on resume and notices when it is gone", async () => {
    const job = await createJobRecord({
      year: new Date().getFullYear(),
      customerId: null,
      customerName: "Walk-up Contractor",
      projectName: `${tag} Existing`,
      projectAddress: "9 Elm St",
      city: null,
      state: null,
      zip: null,
      status: "AWARDED",
      bidDate: null,
      awardedDate: new Date(),
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      notes: null,
    });
    const state: OneOffDraftState = {
      ...newJobDraft(`${tag} Existing`),
      job: { mode: "existing", jobId: job.id },
    };
    const saved = unwrap(await saveOneOffDraft({ id: null, name: "", state }));
    expect(saved.name).toBe(`${job.jobNumber} — ${tag} Existing (Walk-up Contractor)`);

    const stored = await prisma.oneOffDraft.findUniqueOrThrow({ where: { id: saved.id } });
    expect(stored.jobId).toBe(job.id);

    const resumed = await loadOneOffDraftForResume(saved.id);
    expect(resumed).not.toBeNull();
    expect(resumed!.jobMissing).toBe(false);
    expect(resumed!.job).toMatchObject({
      id: job.id,
      jobNumber: job.jobNumber,
      projectAddress: "9 Elm St",
      structureNumbers: [],
      sheetCount: 0,
    });
    expect(resumed!.state).toEqual(state);

    await prisma.job.delete({ where: { id: job.id } });

    const afterDelete = await loadOneOffDraftForResume(saved.id);
    expect(afterDelete!.jobMissing).toBe(true);
    expect(afterDelete!.job).toBeNull();
    const summary = (await loadOneOffDraftSummaries()).find((entry) => entry.id === saved.id);
    expect(summary).toMatchObject({ jobMissing: true, jobLabel: "Job no longer exists" });

    // Saving that draft again, still pointing at the deleted job, is refused.
    expect(await saveOneOffDraft({ id: saved.id, name: saved.name, state })).toEqual({
      error: "That job was not found. It may have been deleted.",
    });
    await prisma.oneOffDraft.delete({ where: { id: saved.id } });
  });

  it("keeps the work as a new draft when the saved one was deleted elsewhere", async () => {
    const saved = unwrap(
      await saveOneOffDraft({ id: null, name: `${tag} gone`, state: newJobDraft(`${tag} Gone`) }),
    );
    await prisma.oneOffDraft.delete({ where: { id: saved.id } });

    const again = unwrap(
      await saveOneOffDraft({ id: saved.id, name: `${tag} gone`, state: newJobDraft(`${tag} Gone`) }),
    );
    expect(again.id).not.toBe(saved.id);
    expect(await prisma.oneOffDraft.count({ where: { name: `${tag} gone` } })).toBe(1);
  });

  it("removes the draft once its sheets are created", async () => {
    const state = newJobDraft(`${tag} Created`);
    const saved = unwrap(
      await saveOneOffDraft({ id: null, name: `${tag} created`, state }),
    );

    const row = state.circular.rows![0];
    const computed = computeCircularOneOffRow(row, options);
    expect(computed.ready).toBe(true);
    const draftJob = state.job;
    if (draftJob?.mode !== "new") {
      throw new Error("expected a new-job draft");
    }
    const result = unwrap(
      await createOneOffDrillSheets({
        job: { mode: "new", ...draftJob.fields },
        sheets: [
          {
            shape: "CIRCULAR",
            structureNumber: row.structureNumber,
            config: { ...computed.config, castingProductId: null },
          },
        ],
        draftId: saved.id,
      }),
    );
    expect(result.errors).toEqual([]);
    expect(result.sheets).toHaveLength(1);
    expect(await prisma.oneOffDraft.findUnique({ where: { id: saved.id } })).toBeNull();
  });
});
