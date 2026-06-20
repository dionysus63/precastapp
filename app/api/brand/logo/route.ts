import { readFile, stat } from "fs/promises";
import { NextResponse } from "next/server";
import { getCompanyLogoPath } from "@/lib/company-logo";

export async function GET() {
  const logoPath = await getCompanyLogoPath();
  if (!logoPath) {
    return new NextResponse("Logo not found", { status: 404 });
  }

  try {
    const [bytes, fileStat] = await Promise.all([
      readFile(logoPath),
      stat(logoPath),
    ]);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
        ETag: `"${Math.floor(fileStat.mtimeMs)}"`,
      },
    });
  } catch {
    return new NextResponse("Logo not found", { status: 404 });
  }
}
