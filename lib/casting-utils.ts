import type {
  CastingPieceRole,
  CastingRole,
  CastingSupplierOrigin,
} from "@/app/generated/prisma/client";

export type { CastingPieceRole, CastingRole, CastingSupplierOrigin };

export const castingAssemblyRequiredBomRoles = [
  "FRAME",
  "COVER_GRATE",
] as const satisfies readonly CastingPieceRole[];

export const castingAssemblyOptionalBomRoles = [
  "HOOD",
  "THROAT",
] as const satisfies readonly CastingPieceRole[];

export const castingAssemblyBomRoleOrder = [
  ...castingAssemblyRequiredBomRoles,
  ...castingAssemblyOptionalBomRoles,
] as const satisfies readonly CastingPieceRole[];

export const castingRoleFormOptions: { value: CastingRole; label: string }[] = [
  { value: "ASSEMBLY", label: "Assembly — full casting (quoted & drill sheet)" },
  {
    value: "COMPONENT",
    label: "Component — frame, cover/grate, hood, or throat piece",
  },
];

export const castingPieceRoleFormOptions: {
  value: CastingPieceRole;
  label: string;
}[] = [
  { value: "FRAME", label: "Frame" },
  { value: "COVER_GRATE", label: "Cover / Grate" },
  { value: "HOOD", label: "Hood" },
  { value: "THROAT", label: "Throat" },
];

export const castingSupplierOriginFormOptions: {
  value: CastingSupplierOrigin;
  label: string;
}[] = [
  { value: "DOMESTIC", label: "Domestic" },
  { value: "IMPORTED", label: "Imported" },
];

export function formatCastingRoleLabel(role: CastingRole | null | undefined): string {
  if (role === "ASSEMBLY") {
    return "Assembly";
  }
  if (role === "COMPONENT") {
    return "Component";
  }
  return "—";
}

export function formatCastingPieceRoleLabel(
  role: CastingPieceRole | null | undefined,
): string {
  if (role === "FRAME") {
    return "Frame";
  }
  if (role === "COVER_GRATE") {
    return "Cover / Grate";
  }
  if (role === "HOOD") {
    return "Hood";
  }
  if (role === "THROAT") {
    return "Throat";
  }
  return "—";
}

export function formatCastingSupplierOriginLabel(
  origin: CastingSupplierOrigin | null | undefined,
): string {
  if (origin === "DOMESTIC") {
    return "Domestic";
  }
  if (origin === "IMPORTED") {
    return "Imported";
  }
  return "—";
}

export function parseCastingRole(value: string): CastingRole | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "ASSEMBLY") {
    return "ASSEMBLY";
  }
  if (normalized === "COMPONENT") {
    return "COMPONENT";
  }
  return null;
}

export function parseCastingPieceRole(value: string): CastingPieceRole | null {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_");
  if (normalized === "FRAME") {
    return "FRAME";
  }
  if (
    normalized === "COVER_GRATE" ||
    normalized === "COVER/GRATE" ||
    normalized === "COVERGRATE" ||
    normalized === "COVER" ||
    normalized === "GRATE"
  ) {
    return "COVER_GRATE";
  }
  if (normalized === "HOOD") {
    return "HOOD";
  }
  if (normalized === "THROAT") {
    return "THROAT";
  }
  return null;
}

export function parseCastingSupplierOrigin(
  value: string,
): CastingSupplierOrigin | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "DOMESTIC") {
    return "DOMESTIC";
  }
  if (normalized === "IMPORTED") {
    return "IMPORTED";
  }
  return null;
}

export type CastingBomRowInput = {
  pieceRole: CastingPieceRole;
  componentId: string;
  quantity: number;
};

export type CastingAssemblyBomImportRow = {
  lineNumber: number;
  frameProductCode: string;
  coverGrateProductCode: string;
  hoodProductCode: string;
  throatProductCode: string;
};

export type CastingComponentLookup = {
  id: string;
  productCode: string;
  castingRole: CastingRole | null;
  castingPieceRole: CastingPieceRole | null;
};

export function buildCastingBomFromProductCodes(
  row: CastingAssemblyBomImportRow,
  componentsByCode: Map<string, CastingComponentLookup>,
  context = "Casting assembly",
): CastingBomRowInput[] {
  const bomRows: CastingBomRowInput[] = [];
  const roleCodes: Array<{ role: CastingPieceRole; code: string }> = [
    { role: "FRAME", code: row.frameProductCode.trim() },
    { role: "COVER_GRATE", code: row.coverGrateProductCode.trim() },
    { role: "HOOD", code: row.hoodProductCode.trim() },
    { role: "THROAT", code: row.throatProductCode.trim() },
  ];

  for (const { role, code } of roleCodes) {
    if (!code) {
      continue;
    }
    const component = componentsByCode.get(code);
    if (!component) {
      throw new Error(
        `${context}: component product code "${code}" was not found.`,
      );
    }
    if (component.castingRole !== "COMPONENT") {
      throw new Error(
        `${context}: "${code}" is not a casting component product.`,
      );
    }
    if (component.castingPieceRole !== role) {
      throw new Error(
        `${context}: "${code}" is a ${formatCastingPieceRoleLabel(component.castingPieceRole)}, not ${formatCastingPieceRoleLabel(role)}.`,
      );
    }
    bomRows.push({
      pieceRole: role,
      componentId: component.id,
      quantity: 1,
    });
  }

  validateCastingBom(bomRows, context);
  return bomRows;
}

export function validateCastingAssemblyImportCodes(
  rows: CastingAssemblyBomImportRow[],
  components: CastingComponentLookup[],
): Map<number, string[]> {
  const componentsByCode = new Map(
    components.map((component) => [component.productCode, component]),
  );
  const issuesByLine = new Map<number, string[]>();

  for (const row of rows) {
    const lineIssues: string[] = [];
    const roleCodes: Array<{ role: CastingPieceRole; code: string; label: string }> = [
      { role: "FRAME", code: row.frameProductCode.trim(), label: "Frame code" },
      {
        role: "COVER_GRATE",
        code: row.coverGrateProductCode.trim(),
        label: "Cover/Grate code",
      },
      { role: "HOOD", code: row.hoodProductCode.trim(), label: "Hood code" },
      { role: "THROAT", code: row.throatProductCode.trim(), label: "Throat code" },
    ];

    for (const { role, code, label } of roleCodes) {
      if (!code) {
        continue;
      }
      const component = componentsByCode.get(code);
      if (!component) {
        lineIssues.push(`${label} "${code}" was not found.`);
        continue;
      }
      if (component.castingRole !== "COMPONENT") {
        lineIssues.push(`"${code}" is not a casting component product.`);
        continue;
      }
      if (component.castingPieceRole !== role) {
        lineIssues.push(
          `"${code}" is a ${formatCastingPieceRoleLabel(component.castingPieceRole)}, not ${formatCastingPieceRoleLabel(role)}.`,
        );
      }
    }

    if (lineIssues.length === 0) {
      try {
        buildCastingBomFromProductCodes(
          row,
          componentsByCode,
          `Line ${row.lineNumber}`,
        );
      } catch (error) {
        lineIssues.push(
          error instanceof Error ? error.message : "Invalid BOM configuration.",
        );
      }
    }

    if (lineIssues.length > 0) {
      issuesByLine.set(row.lineNumber, lineIssues);
    }
  }

  return issuesByLine;
}

export function validateCastingBom(
  rows: CastingBomRowInput[],
  context = "Casting assembly",
): void {
  if (rows.length < 2) {
    throw new Error(`${context} requires at least a frame and cover/grate.`);
  }
  if (rows.length > castingAssemblyBomRoleOrder.length) {
    throw new Error(`${context} supports at most four pieces.`);
  }

  const roles = new Set<CastingPieceRole>();
  for (const row of rows) {
    if (!row.componentId.trim()) {
      throw new Error(`${context}: each BOM row needs a component product.`);
    }
    if (roles.has(row.pieceRole)) {
      throw new Error(
        `${context}: duplicate piece role ${formatCastingPieceRoleLabel(row.pieceRole)}.`,
      );
    }
    roles.add(row.pieceRole);
    if (!Number.isFinite(row.quantity) || row.quantity < 1) {
      throw new Error(
        `${context}: quantity for ${formatCastingPieceRoleLabel(row.pieceRole)} must be at least 1.`,
      );
    }
  }

  if (!roles.has("FRAME") || !roles.has("COVER_GRATE")) {
    throw new Error(`${context} must include both a frame and a cover/grate.`);
  }
}

export type CastingComponentOption = {
  productId: string;
  productCode: string;
  name: string;
  pieceRole: CastingPieceRole;
  quantity: number;
  weightEach: number | null;
  currentStock: number | null;
  trackInventory: boolean;
};

export function castingAssemblyEditorKey(
  quoteLineItemId: string,
  pieceRole: CastingPieceRole,
): string {
  return `${quoteLineItemId}::${pieceRole}`;
}

export function parseCastingAssemblyEditorKey(key: string): {
  quoteLineItemId: string;
  pieceRole: CastingPieceRole;
} | null {
  const parts = key.split("::");
  if (parts.length !== 2) {
    return null;
  }
  const pieceRole = parseCastingPieceRole(parts[1]);
  if (!pieceRole) {
    return null;
  }
  return { quoteLineItemId: parts[0], pieceRole };
}

export function isCastingAssemblyEditorKey(key: string): boolean {
  return parseCastingAssemblyEditorKey(key) !== null;
}
