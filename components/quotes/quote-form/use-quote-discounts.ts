"use client";

import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  type EditableQuoteLineItem,
  getLineDiscountPercent,
  isNonBillableLineItem,
} from "@/components/quotes/quote-utils";
import {
  createDiscountRuleLookup,
  emptyQuoteDiscountPricing,
  type QuoteDiscountBasis,
  type QuoteDiscountPricing,
} from "@/lib/pricing/line-discount";

/**
 * One filled-in copy per stored line and standard discount, handed out again
 * while the line itself is unchanged, so the memoized table rows of untouched
 * lines do not re-render. Entries go away with their line.
 */
const filledLines = new WeakMap<
  EditableQuoteLineItem,
  { percent: string; line: EditableQuoteLineItem }
>();

/** The line with the standard discount of its group written onto it. */
function withStandardDiscount(
  line: EditableQuoteLineItem,
  percent: string,
): EditableQuoteLineItem {
  const cached = filledLines.get(line);
  if (cached && cached.percent === percent) {
    return cached.line;
  }
  const filled = { ...line, discountPercent: percent, discountTyped: false };
  filledLines.set(line, { percent, line: filled });
  return filled;
}

/**
 * The discount side of the quote form: whether the quote is priced delivered
 * or picked up, whether the printed quote shows the discount, and the
 * standard discount of every line that has none of its own.
 *
 * Lines are stored as the estimator left them. A line whose `discountPercent`
 * is undefined follows the standard discount of its product group; this hook
 * hands back the same lines with that discount filled in, so the table, the
 * totals and the save all read one number per line.
 */
export function useQuoteDiscounts({
  storedLineItems,
  setLineItems,
  pricing,
  initialBasis,
  initialShowDiscount,
}: {
  storedLineItems: EditableQuoteLineItem[];
  setLineItems: Dispatch<SetStateAction<EditableQuoteLineItem[]>>;
  pricing: QuoteDiscountPricing | undefined;
  initialBasis: QuoteDiscountBasis | undefined;
  initialShowDiscount: boolean | undefined;
}) {
  const [discountBasis, setDiscountBasis] = useState<QuoteDiscountBasis>(
    initialBasis ?? "DELIVERED",
  );
  const [showDiscount, setShowDiscount] = useState(initialShowDiscount ?? true);

  const ruleFor = useMemo(
    () => createDiscountRuleLookup(pricing ?? emptyQuoteDiscountPricing()),
    [pricing],
  );

  const lineItems = useMemo(
    () =>
      storedLineItems.map((line) => {
        if (line.discountPercent !== undefined || isNonBillableLineItem(line.type)) {
          return line;
        }
        const rule = ruleFor(line, discountBasis);
        return withStandardDiscount(line, rule > 0 ? String(rule) : "");
      }),
    [storedLineItems, ruleFor, discountBasis],
  );

  /**
   * Delivered or picked up. Every line that was not typed over goes back to
   * following the standard discount, which is now the other one.
   */
  const changeDiscountBasis = useCallback(
    (next: QuoteDiscountBasis) => {
      setDiscountBasis(next);
      setLineItems((current) =>
        current.map((line) =>
          line.discountTyped || line.discountPercent === undefined
            ? line
            : { ...line, discountPercent: undefined },
        ),
      );
    },
    [setLineItems],
  );

  const hasDiscountedLine = useMemo(
    () => lineItems.some((line) => getLineDiscountPercent(line) > 0),
    [lineItems],
  );

  return {
    lineItems,
    discountBasis,
    changeDiscountBasis,
    showDiscount,
    setShowDiscount,
    hasDiscountedLine,
  };
}
