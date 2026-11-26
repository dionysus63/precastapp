import { describe, expect, it } from "vitest";
import { Decimal } from "@/lib/decimal";
import {
  DELIVERY_CHARGE_ENABLED,
  showsDeliveryAmount,
} from "@/lib/quotes/delivery-charge";

describe("delivery charge", () => {
  it("is off: the company does not charge a delivery fee", () => {
    expect(DELIVERY_CHARGE_ENABLED).toBe(false);
  });

  it("leaves a zero Delivery amount off the screen", () => {
    for (const zero of [0, "0", "0.00", "$0.00", new Decimal(0), null, undefined]) {
      expect(showsDeliveryAmount(zero, false)).toBe(false);
    }
  });

  it("still shows a delivery amount an older quote or invoice carries", () => {
    for (const amount of [650, "650.00", "$1,300.00", new Decimal("325.5")]) {
      expect(showsDeliveryAmount(amount, false)).toBe(true);
    }
  });

  it("shows what it cannot read rather than hiding money", () => {
    expect(showsDeliveryAmount("n/a", false)).toBe(true);
  });

  it("always shows the row while delivery is charged", () => {
    expect(showsDeliveryAmount(0, true)).toBe(true);
    expect(showsDeliveryAmount("$0.00", true)).toBe(true);
  });
});
