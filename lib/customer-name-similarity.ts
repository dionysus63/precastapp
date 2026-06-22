const LEGAL_SUFFIX_PATTERN =
  /\b(incorporated|inc|llc|l\.l\.c|ltd|limited|corp|corporation|company|co)\b\.?/gi;

export type CustomerNameCandidate = {
  id: string;
  name: string;
};

export type SimilarCustomerMatch = {
  id: string;
  name: string;
  score: number;
};

const SIMILARITY_THRESHOLD = 0.85;

export function normalizeCustomerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'"]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^\w\s]/g, " ")
    .replace(LEGAL_SUFFIX_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactCustomerName(name: string): string {
  return normalizeCustomerName(name).replace(/\s+/g, "");
}

function compactSimilarity(a: string, b: string): number {
  const compactA = compactCustomerName(a);
  const compactB = compactCustomerName(b);

  if (!compactA || !compactB) {
    return 0;
  }

  if (compactA === compactB) {
    return 1;
  }

  const shorterLength = Math.min(compactA.length, compactB.length);
  if (
    shorterLength >= 3 &&
    (compactA.includes(compactB) || compactB.includes(compactA))
  ) {
    return 0.95;
  }

  const distance = levenshteinDistance(compactA, compactB);
  const maxLength = Math.max(compactA.length, compactB.length);
  return maxLength === 0 ? 1 : 1 - distance / maxLength;
}

function tokenize(name: string): string[] {
  const normalized = normalizeCustomerName(name);
  if (!normalized) {
    return [];
  }

  return normalized.split(" ").filter(Boolean);
}

function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(tokenize(a));
  const tokensB = new Set(tokenize(b));

  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection += 1;
    }
  }

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  if (a.length === 0) {
    return b.length;
  }

  if (b.length === 0) {
    return a.length;
  }

  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }

    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j] ?? 0;
    }
  }

  return previous[b.length] ?? 0;
}

function levenshteinRatio(a: string, b: string): number {
  const normalizedA = normalizeCustomerName(a);
  const normalizedB = normalizeCustomerName(b);

  if (!normalizedA || !normalizedB) {
    return 0;
  }

  if (normalizedA === normalizedB) {
    return 1;
  }

  const distance = levenshteinDistance(normalizedA, normalizedB);
  const maxLength = Math.max(normalizedA.length, normalizedB.length);
  return maxLength === 0 ? 1 : 1 - distance / maxLength;
}

function normalizedContainsSimilarity(a: string, b: string): number {
  const normalizedA = normalizeCustomerName(a);
  const normalizedB = normalizeCustomerName(b);

  if (!normalizedA || !normalizedB) {
    return 0;
  }

  if (normalizedA === normalizedB) {
    return 1;
  }

  const shorterLength = Math.min(normalizedA.length, normalizedB.length);
  if (
    shorterLength >= 6 &&
    (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA))
  ) {
    return 0.95;
  }

  return 0;
}

export function getCustomerNameSimilarity(a: string, b: string): number {
  const normalizedA = normalizeCustomerName(a);
  const normalizedB = normalizeCustomerName(b);

  if (!normalizedA || !normalizedB) {
    return 0;
  }

  return Math.max(
    normalizedContainsSimilarity(a, b),
    compactSimilarity(a, b),
    jaccardSimilarity(a, b),
    levenshteinRatio(a, b),
  );
}

export function findSimilarCustomers(
  name: string,
  candidates: CustomerNameCandidate[],
  options?: { limit?: number; excludeId?: string },
): SimilarCustomerMatch[] {
  const trimmed = name.trim();
  if (trimmed.length < 3) {
    return [];
  }

  const limit = options?.limit ?? 5;
  const excludeId = options?.excludeId;

  const matches = candidates
    .filter((candidate) => candidate.id !== excludeId)
    .map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      score: getCustomerNameSimilarity(trimmed, candidate.name),
    }))
    .filter((match) => match.score >= SIMILARITY_THRESHOLD)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  return matches;
}
