import { Prisma } from "@/app/generated/prisma/browser";

/** Browser-safe Decimal for money math (shared by client previews and server persistence). */
export const Decimal = Prisma.Decimal;

export type DecimalInstance = InstanceType<typeof Decimal>;

export type DecimalLike = DecimalInstance | number | string;

export function toDecimal(value: DecimalLike | null | undefined): DecimalInstance {
  if (value === null || value === undefined || value === "") {
    return new Decimal(0);
  }
  return value instanceof Decimal ? value : new Decimal(value);
}
