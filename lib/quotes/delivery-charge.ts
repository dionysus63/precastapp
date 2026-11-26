/**
 * The company does not charge a delivery fee: the delivered price already
 * covers the truck. While this is false the quote form offers no delivery
 * pricing and no shipping zone price, and screens leave out a Delivery amount
 * of zero.
 *
 * The zone tables, the Shipping Zones settings page and the per-load math all
 * stay as they are, so setting this to true brings the delivery charge back.
 */
export const DELIVERY_CHARGE_ENABLED: boolean = false;

/**
 * Whether a Delivery amount earns its row on a screen: always while delivery
 * is charged, otherwise only when the quote or invoice really carries one (an
 * older quote with a delivery line, or one typed in by hand).
 */
export function showsDeliveryAmount(
  amount: number | string | { toString(): string } | null | undefined,
  chargeEnabled: boolean = DELIVERY_CHARGE_ENABLED,
): boolean {
  if (chargeEnabled) {
    return true;
  }
  if (amount == null) {
    return false;
  }
  // Amounts reach the screens as numbers, Decimals or formatted "$1,300.00".
  const value = Number(String(amount).replace(/[$,\s]/g, ""));
  return Number.isFinite(value) ? value !== 0 : true;
}
