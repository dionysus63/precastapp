import { redirect } from "next/navigation";

/** Old URL: Sheet PDFs (once "Rect PDF Sets") live at /structures/sheet-pdfs. */
export default function RectPdfSetsRedirect() {
  redirect("/structures/sheet-pdfs");
}
