import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type AuditLogInput = {
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  summary?: string | null;
  metadata?: Prisma.InputJsonValue;
};

export async function writeAuditLog(input: AuditLogInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      summary: input.summary ?? null,
      metadata: input.metadata,
    },
  });
}

/** Audit retention window. The table grows without bound otherwise; two years
 * keeps a full prior fiscal year reviewable. Override with the
 * AUDIT_LOG_RETENTION_DAYS env var; 0 or a negative value disables pruning. */
const DEFAULT_AUDIT_LOG_RETENTION_DAYS = 730;

function auditLogRetentionDays(): number {
  const raw = process.env.AUDIT_LOG_RETENTION_DAYS?.trim();
  if (!raw) {
    return DEFAULT_AUDIT_LOG_RETENTION_DAYS;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : DEFAULT_AUDIT_LOG_RETENTION_DAYS;
}

/** Delete audit rows older than the retention window (uses the createdAt
 * index). Called opportunistically on sign-in. */
export async function pruneOldAuditLogs(): Promise<void> {
  const days = auditLogRetentionDays();
  if (days <= 0) {
    return;
  }
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
}
