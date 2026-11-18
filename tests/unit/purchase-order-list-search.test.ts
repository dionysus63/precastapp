import { describe, expect, it } from "vitest";
import {
  buildPurchaseOrderListOrderBy,
  buildPurchaseOrderListWhere,
  nextPurchaseOrderListSort,
  parsePurchaseOrderJobFilter,
  parsePurchaseOrderListFilters,
  parsePurchaseOrderListSort,
  purchaseOrderJobFilterOptions,
  purchaseOrderJobFilterToken,
} from "@/lib/purchase-order-list-search";
import { purchaseOrderJobLabel } from "@/lib/purchase-order-utils";

describe("the sorted column of the purchase orders list", () => {
  it("reads a known column and its direction", () => {
    expect(parsePurchaseOrderListSort("job", "desc")).toEqual({
      column: "job",
      direction: "desc",
    });
    expect(parsePurchaseOrderListSort("contractor", undefined)).toEqual({
      column: "contractor",
      direction: "asc",
    });
    expect(parsePurchaseOrderListSort(["total", "po"], "sideways")).toEqual({
      column: "total",
      direction: "asc",
    });
  });

  it("reads an unknown or missing column as not sorted", () => {
    expect(parsePurchaseOrderListSort(undefined, "desc")).toBeNull();
    expect(parsePurchaseOrderListSort("status", "asc")).toBeNull();
  });

  it("starts a new column A to Z and reverses the sorted one", () => {
    expect(nextPurchaseOrderListSort(null, "job")).toEqual({
      column: "job",
      direction: "asc",
    });
    expect(
      nextPurchaseOrderListSort({ column: "job", direction: "asc" }, "job"),
    ).toEqual({ column: "job", direction: "desc" });
    expect(
      nextPurchaseOrderListSort({ column: "job", direction: "desc" }, "job"),
    ).toEqual({ column: "job", direction: "asc" });
    expect(
      nextPurchaseOrderListSort({ column: "job", direction: "asc" }, "contractor"),
    ).toEqual({ column: "contractor", direction: "asc" });
  });

  it("lists newest first when nobody sorted", () => {
    expect(buildPurchaseOrderListOrderBy(null)).toEqual([
      { orderDate: "desc" },
      { poNumber: "desc" },
    ]);
  });

  it("puts orders with no contractor or no job last either way round", () => {
    expect(
      buildPurchaseOrderListOrderBy({ column: "contractor", direction: "desc" })[0],
    ).toEqual({ contractorNames: { sort: "desc", nulls: "last" } });
    expect(buildPurchaseOrderListOrderBy({ column: "job", direction: "asc" })[0]).toEqual({
      jobName: { sort: "asc", nulls: "last" },
    });
  });

  it("gives every column an order", () => {
    for (const column of ["po", "vendor", "date", "createdBy", "total"] as const) {
      expect(
        buildPurchaseOrderListOrderBy({ column, direction: "asc" }).length,
      ).toBeGreaterThan(0);
    }
  });
});

describe("the job dropdown's value", () => {
  it("reads a job on file and a typed name", () => {
    expect(parsePurchaseOrderJobFilter("id:abc123")).toEqual({ id: "abc123" });
    expect(parsePurchaseOrderJobFilter("name: Main St drainage ")).toEqual({
      name: "Main St drainage",
    });
  });

  it("reads anything else as no job picked", () => {
    for (const value of ["", "id:", "name:", "name:   ", "abc123", undefined]) {
      expect(parsePurchaseOrderJobFilter(value)).toBeNull();
    }
  });

  it("writes back what it reads", () => {
    for (const token of ["id:abc123", "name:Main St drainage"]) {
      expect(purchaseOrderJobFilterToken(parsePurchaseOrderJobFilter(token)!)).toBe(token);
    }
  });
});

describe("the purchase orders list filters", () => {
  it("reads every box from the address", () => {
    expect(
      parsePurchaseOrderListFilters({
        q: "  pipe ",
        status: "ISSUED",
        vendor: "v1",
        category: "one-off",
        by: " Anna ",
        contractor: "c1",
        job: "id:j1",
      }),
    ).toEqual({
      search: "pipe",
      status: "ISSUED",
      vendorId: "v1",
      category: "one-off",
      createdBy: "Anna",
      contractorId: "c1",
      job: { id: "j1" },
    });
  });

  it("filters nothing when the address is bare", () => {
    expect(buildPurchaseOrderListWhere(parsePurchaseOrderListFilters({}))).toEqual({});
  });

  it("filters by a contractor and by a job on file", () => {
    const where = buildPurchaseOrderListWhere(
      parsePurchaseOrderListFilters({ contractor: "c1", job: "id:j1" }),
    );
    expect(where).toEqual({
      AND: [{ contractors: { some: { customerId: "c1" } } }, { jobId: "j1" }],
    });
  });

  it("filters by a typed job name whatever its capitals, never a job on file", () => {
    expect(
      buildPurchaseOrderListWhere(parsePurchaseOrderListFilters({ job: "name:Yard stock" })),
    ).toEqual({
      AND: [{ jobId: null, jobName: { equals: "Yard stock", mode: "insensitive" } }],
    });
  });

  it("searches contractors, jobs and internal notes too", () => {
    const where = buildPurchaseOrderListWhere(parsePurchaseOrderListFilters({ q: "smith" }));
    const fields = JSON.stringify(where);
    for (const field of ["poNumber", "internalNotes", "contractorNames", "jobName", "jobNumber", "projectName"]) {
      expect(fields).toContain(field);
    }
  });
});

describe("the jobs offered in the job dropdown", () => {
  it("lists each job once, by what is shown", () => {
    const job = { id: "j1", jobNumber: "26-014", projectName: "Main St" };
    expect(
      purchaseOrderJobFilterOptions([
        { jobName: "yard stock", job: null },
        { jobName: "26-014 old label", job },
        { jobName: "Yard Stock", job: null },
        { jobName: null, job },
        { jobName: "  ", job: null },
        { jobName: "Bridge job", job: null },
      ]),
    ).toEqual([
      { value: "id:j1", label: purchaseOrderJobLabel(job) },
      { value: "name:Bridge job", label: "Bridge job" },
      { value: "name:yard stock", label: "yard stock" },
    ]);
  });
});

describe("a job's label on a purchase order", () => {
  it("is the job number and the project", () => {
    expect(purchaseOrderJobLabel({ jobNumber: "26-014", projectName: "Main St" })).toContain(
      "26-014",
    );
    expect(purchaseOrderJobLabel({ jobNumber: "26-014", projectName: "Main St" })).toContain(
      "Main St",
    );
    expect(purchaseOrderJobLabel({ jobNumber: "26-014", projectName: "  " })).toBe("26-014");
  });
});
