import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  deleteAllScanUploads,
  getSignedTicketsRoot,
  getTicketScansRoot,
  readSignedTicket,
  resolveSignedTicketPath,
  retryWhileFileBusy,
  setAsideAllSignedTickets,
  setAsideSignedTicket,
  signedTicketFileStem,
  signedTicketJobCopyName,
  signedTicketRelativePath,
  writeScanSource,
  writeSignedTicket,
} from "@/lib/ticket-scan/storage";

/** Where Scan In keeps its files, against a scratch folder. */

let storageDir: string;
const bytes = (text: string) => new TextEncoder().encode(text);

beforeAll(async () => {
  storageDir = await mkdtemp(path.join(os.tmpdir(), "scan-storage-"));
  process.env.PRECASTAPP_STORAGE_DIR = storageDir;
});

beforeEach(async () => {
  await rm(path.join(storageDir, "signed-tickets"), { recursive: true, force: true });
  await rm(path.join(storageDir, "ticket-scans"), { recursive: true, force: true });
});

afterAll(async () => {
  delete process.env.PRECASTAPP_STORAGE_DIR;
  await rm(storageDir, { recursive: true, force: true });
});

describe("signed ticket file names", () => {
  it("files a ticket under its year and number", () => {
    expect(signedTicketRelativePath(2026, "T10189")).toBe("2026/T10189.pdf");
    expect(signedTicketRelativePath(2026, " t10189 ")).toBe("2026/T10189.pdf");
    expect(signedTicketJobCopyName("T10189")).toBe("T10189 - Signed.pdf");
  });

  it("keeps a ticket number from reaching outside its folder", () => {
    expect(signedTicketFileStem("../../etc/passwd")).toBe("ETC_PASSWD");
    expect(signedTicketFileStem("W-1042")).toBe("W-1042");
    expect(() => signedTicketFileStem("  ")).toThrow(/no number/i);
    expect(() => signedTicketRelativePath(26, "T1")).toThrow(/year/i);
    expect(() => resolveSignedTicketPath("../outside.pdf")).toThrow(/outside/i);
    expect(() => resolveSignedTicketPath("")).toThrow(/outside/i);
  });
});

describe("replacing a signed ticket", () => {
  it("keeps each earlier copy under the next free name", async () => {
    await writeSignedTicket("2026/T10189.pdf", bytes("first scan"));
    expect(await setAsideSignedTicket("2026/T10189.pdf")).toBe(
      "2026/T10189 (earlier version 1).pdf",
    );
    await writeSignedTicket("2026/T10189.pdf", bytes("second scan"));
    expect(await setAsideSignedTicket("2026/T10189.pdf")).toBe(
      "2026/T10189 (earlier version 2).pdf",
    );
    // Nothing there to move: nothing happens.
    expect(await setAsideSignedTicket("2026/T10189.pdf")).toBeNull();

    expect(
      (await readSignedTicket("2026/T10189 (earlier version 1).pdf")).toString(),
    ).toBe("first scan");
    expect(
      (await readSignedTicket("2026/T10189 (earlier version 2).pdf")).toString(),
    ).toBe("second scan");
    await expect(readSignedTicket("2026/T10189.pdf")).rejects.toThrow(/missing/i);
  });
});

describe("clearing all tickets (Settings > Data Reset)", () => {
  it("moves every signed ticket into one cleared folder and keeps the files", async () => {
    await writeSignedTicket("2026/T10001.pdf", bytes("a"));
    await writeSignedTicket("2026/T10002 (earlier version 1).pdf", bytes("b"));
    await writeSignedTicket("2027/T10003.pdf", bytes("c"));

    const folder = await setAsideAllSignedTickets(new Date(2026, 10, 13, 14, 5, 9));
    expect(folder).toBe("cleared-2026-11-13-140509");

    const root = getSignedTicketsRoot();
    expect(await readdir(root)).toEqual([folder]);
    expect((await readdir(path.join(root, folder!))).sort()).toEqual([
      "2026",
      "2027",
    ]);
    expect(
      (await readFile(path.join(root, folder!, "2026", "T10001.pdf"))).toString(),
    ).toBe("a");
    expect(
      (await readFile(path.join(root, folder!, "2027", "T10003.pdf"))).toString(),
    ).toBe("c");

    // The numbering starts over: the next T10001 has a clean place to land.
    expect(await setAsideSignedTicket("2026/T10001.pdf")).toBeNull();
  });

  it("leaves earlier cleared folders alone and never reuses a name", async () => {
    const when = new Date(2026, 10, 13, 14, 5, 9);
    await writeSignedTicket("2026/T10001.pdf", bytes("first reset"));
    const first = await setAsideAllSignedTickets(when);

    // Nothing new since: nothing to do.
    expect(await setAsideAllSignedTickets(when)).toBeNull();

    await writeSignedTicket("2026/T10001.pdf", bytes("second reset"));
    const second = await setAsideAllSignedTickets(when);
    expect(second).toBe("cleared-2026-11-13-140509-2");

    const root = getSignedTicketsRoot();
    expect((await readdir(root)).sort()).toEqual([first, second].sort());
    expect(
      (await readFile(path.join(root, first!, "2026", "T10001.pdf"))).toString(),
    ).toBe("first reset");
    expect(
      (await readFile(path.join(root, second!, "2026", "T10001.pdf"))).toString(),
    ).toBe("second reset");
  });

  it("does nothing when no ticket was ever signed", async () => {
    expect(await setAsideAllSignedTickets()).toBeNull();
    await mkdir(getSignedTicketsRoot(), { recursive: true });
    expect(await setAsideAllSignedTickets()).toBeNull();
  });

  it("removes every uploaded scan", async () => {
    await writeScanSource("scan-1", "file-1", bytes("upload"));
    await writeFile(path.join(getTicketScansRoot(), "stray.txt"), "x");
    await deleteAllScanUploads();
    await expect(readdir(getTicketScansRoot())).rejects.toMatchObject({
      code: "ENOENT",
    });
    // Safe to call with nothing there.
    await deleteAllScanUploads();
  });
});

describe("a file Windows is holding for a moment", () => {
  const busy = (code: string) =>
    Object.assign(new Error(`${code}: operation not permitted, rename`), { code });

  it("tries again until the file is let go", async () => {
    let calls = 0;
    const result = await retryWhileFileBusy(async () => {
      calls += 1;
      if (calls === 1) {
        throw busy("EPERM");
      }
      if (calls === 2) {
        throw busy("EBUSY");
      }
      return "renamed";
    }, [1, 1, 1]);
    expect(result).toBe("renamed");
    expect(calls).toBe(3);
  });

  it("gives up after the last wait and passes the failure on", async () => {
    let calls = 0;
    await expect(
      retryWhileFileBusy(async () => {
        calls += 1;
        throw busy("EACCES");
      }, [1, 1]),
    ).rejects.toMatchObject({ code: "EACCES" });
    expect(calls).toBe(3);
  });

  it("does not wait on any other failure", async () => {
    let calls = 0;
    await expect(
      retryWhileFileBusy(async () => {
        calls += 1;
        throw busy("ENOENT");
      }, [1, 1, 1]),
    ).rejects.toMatchObject({ code: "ENOENT" });
    expect(calls).toBe(1);

    await expect(
      retryWhileFileBusy(async () => {
        throw new Error("not a file system error");
      }, [1]),
    ).rejects.toThrow("not a file system error");
  });
});
