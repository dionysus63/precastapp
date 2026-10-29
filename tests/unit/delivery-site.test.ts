import { describe, expect, it } from "vitest";

import {
  hasSiteContact,
  resolveJobDeliveryAddressLines,
  resolveTicketDeliveryAddressLines,
  resolveTicketSiteContact,
} from "@/lib/delivery-site";

const job = {
  deliveryAddress: null,
  projectAddress: "20 Job Road",
  city: "Job Town",
  state: "NY",
  zip: "11701",
  siteContactName: null,
  siteContactPhone: null,
  siteContactEmail: null,
};

describe("delivery site resolution", () => {
  it("uses the ticket's own address first", () => {
    expect(
      resolveTicketDeliveryAddressLines({
        deliveryAddress: "1 Ticket St\nTicket Town, NY 11700",
        job: { ...job, deliveryAddress: "9 Job Delivery Rd" },
      }),
    ).toEqual(["1 Ticket St", "Ticket Town, NY 11700"]);
  });

  it("falls through ticket → job delivery address → project address → quote", () => {
    expect(
      resolveTicketDeliveryAddressLines({
        deliveryAddress: "  ",
        job: { ...job, deliveryAddress: "9 Job Delivery Rd\n\nGate 2\n" },
      }),
    ).toEqual(["9 Job Delivery Rd", "Gate 2"]);

    expect(
      resolveTicketDeliveryAddressLines({ deliveryAddress: null, job }),
    ).toEqual(["20 Job Road", "Job Town, NY 11701"]);

    expect(
      resolveTicketDeliveryAddressLines({
        deliveryAddress: null,
        job: { ...job, projectAddress: null, city: null, state: null, zip: null },
        quote: { projectAddress: "30 Quote St\nQuote Town, NY 11702" },
      }),
    ).toEqual(["30 Quote St", "Quote Town, NY 11702"]);

    expect(
      resolveTicketDeliveryAddressLines({ deliveryAddress: null, job: null, quote: null }),
    ).toEqual([]);
  });

  it("lets the job's site contact win over the ticket's auto-filled one", () => {
    expect(
      resolveTicketSiteContact({
        siteContactName: "Primary Contact",
        siteContactPhone: "631-555-0100",
        job: {
          siteContactName: "Super Sam",
          siteContactPhone: " 631-555-0199 ",
          siteContactEmail: "",
        },
      }),
    ).toEqual({ name: "Super Sam", phone: "631-555-0199", email: null });
  });

  it("keeps the ticket's site contact when the job has none", () => {
    expect(
      resolveTicketSiteContact({
        siteContactName: "Primary Contact",
        siteContactPhone: "631-555-0100",
        siteContactEmail: "primary@example.com",
        job,
      }),
    ).toEqual({
      name: "Primary Contact",
      phone: "631-555-0100",
      email: "primary@example.com",
    });
    expect(
      resolveTicketSiteContact({ siteContactName: null, siteContactPhone: null }),
    ).toEqual({ name: null, phone: null, email: null });
  });

  it("treats whitespace-only contact fields as unset", () => {
    expect(hasSiteContact({ siteContactName: " ", siteContactPhone: "" })).toBe(false);
    expect(hasSiteContact({ siteContactEmail: "x@y.z" })).toBe(true);
    expect(hasSiteContact(null)).toBe(false);
  });

  it("resolves the job's own delivery address for the schedule", () => {
    expect(resolveJobDeliveryAddressLines(job)).toEqual([
      "20 Job Road",
      "Job Town, NY 11701",
    ]);
    expect(
      resolveJobDeliveryAddressLines({ ...job, deliveryAddress: "9 Job Delivery Rd" }),
    ).toEqual(["9 Job Delivery Rd"]);
  });
});
