import type { PipeOpeningSizeEntry } from "@/lib/drill-sheet";

export function uniquePipeMaterials(
  pipeOpeningSizes: PipeOpeningSizeEntry[],
): string[] {
  return [...new Set(pipeOpeningSizes.map((entry) => entry.pipeMaterial))].sort();
}

export function pipeSizesForMaterial(
  pipeOpeningSizes: PipeOpeningSizeEntry[],
  material: string,
): number[] {
  return [
    ...new Set(
      pipeOpeningSizes
        .filter((entry) => entry.pipeMaterial === material)
        .map((entry) => entry.pipeSizeInches),
    ),
  ].sort((left, right) => left - right);
}
