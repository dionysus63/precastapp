import { sanitizeRichText } from "@/lib/rich-text";

type RichTextContentProps = {
  value: string;
  className?: string;
  emptyClassName?: string;
};

export function RichTextContent({
  value,
  className = "text-slate-700",
  emptyClassName = "text-slate-400",
}: RichTextContentProps) {
  const sanitized = sanitizeRichText(value);
  if (!sanitized) {
    return <span className={emptyClassName}>—</span>;
  }

  return (
    <div
      className={`rich-text-content whitespace-pre-wrap break-words ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
