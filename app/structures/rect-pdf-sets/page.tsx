import { redirect } from "next/navigation";

/** Old URL — sheet PDF sets now cover both shapes at /structures/sheet-pdfs. */
export default function RectPdfSetsRedirect() {
  redirect("/structures/sheet-pdfs");
}
