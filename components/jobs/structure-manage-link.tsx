import Link from "next/link";

type StructureManageLinkProps = {
  jobId: string | null | undefined;
  structureId: string;
  children: React.ReactNode;
  hash?: "submittals";
  className?: string;
};

export function StructureManageLink({
  jobId,
  structureId,
  children,
  hash,
  className = "font-medium text-slate-900 hover:underline",
}: StructureManageLinkProps) {
  if (!jobId) {
    return <span className={className}>{children}</span>;
  }

  const href = `/jobs/${jobId}/structures/${structureId}${
    hash ? `#${hash}` : ""
  }`;

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
