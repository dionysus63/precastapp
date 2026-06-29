import type { Prisma } from "@/app/generated/prisma/client";

type DbClient = Prisma.TransactionClient | {
  quote: {
    findUnique: (args: {
      where: { quoteNumber: string };
      select: { id: true };
    }) => Promise<{ id: string } | null>;
  };
};

export type GenerateQuoteNumberOptions = {
  jobNumber: string | null;
  scopeLabel?: string | null;
  contractorName?: string | null;
};

function splitLetterWords(value: string): string[] {
  return value.split(/[^a-zA-Z]+/).filter((word) => word.length > 0);
}

/** Contractor code from customer name: up to 3 letters from first word, extended into later words. */
export function abbreviateContractor(name: string): string {
  const words = splitLetterWords(name.trim());
  if (words.length === 0) {
    return "";
  }

  let result = "";
  let wordIndex = 0;

  while (result.length < 3 && wordIndex < words.length) {
    const letters = words[wordIndex].toUpperCase();
    const needed = 3 - result.length;
    result += letters.slice(0, needed);
    wordIndex += 1;
  }

  return result.length >= 2 ? result : "";
}

/** Scope/area code from scope label: multi-word initials (up to 3 words) or first 4 letters of one word. */
export function abbreviateScope(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) {
    return "";
  }

  const words = splitLetterWords(trimmed);
  if (words.length === 0) {
    return "";
  }

  if (words.length === 1) {
    return words[0].toUpperCase().slice(0, 4);
  }

  return words
    .slice(0, 3)
    .map((word) => word[0].toUpperCase())
    .join("");
}

/** Strip trailing revision suffix (-R0, -R1, -R0-2, etc.) from a quote number. */
export function stripRevisionSuffix(quoteNumber: string): string {
  return quoteNumber.replace(/-R\d+(-\d+)?$/, "");
}

async function quoteNumberExists(client: DbClient, quoteNumber: string) {
  const existing = await client.quote.findUnique({
    where: { quoteNumber },
    select: { id: true },
  });
  return Boolean(existing);
}

async function findAvailableQuoteNumber(
  client: DbClient,
  base: string,
): Promise<string> {
  let candidate = base;
  let suffix = 2;

  while (await quoteNumberExists(client, candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

async function findAvailableQuoteNumberWithContractor(
  client: DbClient,
  basePrefix: string,
  contractorCode: string,
): Promise<string> {
  let code = contractorCode;
  let suffix = 2;

  while (await quoteNumberExists(client, `${basePrefix}-${code}`)) {
    code = `${contractorCode}${suffix}`;
    suffix += 1;
  }

  return `${basePrefix}-${code}`;
}

function buildQuoteNumberBase(options: GenerateQuoteNumberOptions): string {
  const yearSuffix = String(new Date().getFullYear() % 100).padStart(2, "0");
  const jobSegment = options.jobNumber?.trim() || `${yearSuffix}-NEW`;
  const parts = [`Q-${jobSegment}`];

  const areaCode = abbreviateScope(options.scopeLabel?.trim() ?? "");
  if (areaCode) {
    parts.push(areaCode);
  }

  return parts.join("-");
}

export async function generateQuoteNumber(
  client: DbClient,
  options: GenerateQuoteNumberOptions,
): Promise<string> {
  const base = buildQuoteNumberBase(options);
  const contractorCode = options.contractorName
    ? abbreviateContractor(options.contractorName)
    : "";

  if (contractorCode) {
    return findAvailableQuoteNumberWithContractor(client, base, contractorCode);
  }

  return findAvailableQuoteNumber(client, base);
}

/** Generate a quote number for revision N of an existing quote family. */
export async function generateRevisionQuoteNumber(
  client: DbClient,
  sourceQuoteNumber: string,
  revisionNumber: number,
): Promise<string> {
  const base = `${stripRevisionSuffix(sourceQuoteNumber)}-R${revisionNumber}`;
  return findAvailableQuoteNumber(client, base);
}
