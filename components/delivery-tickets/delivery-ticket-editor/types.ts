import type {
  DeliveryTicketJobSearchOption,
  SaveDeliveryTicketInput,
} from "@/app/delivery-tickets/actions";

export type JobOption = DeliveryTicketJobSearchOption;

export type ProductOption = {
  id: string;
  productCode: string;
  name: string;
  unit: string;
  weight: number | null;
  unitPrice?: number | null;
  /** FOB-yard price; null = pickup bills the delivered unitPrice. */
  pickupPrice?: number | null;
  /** Group memberships with in-group order (walk-in picker filters). */
  groupMemberships?: { groupId: string; sortOrder: number }[];
  currentStock?: number | null;
  trackInventory?: boolean;
  categoryId: string;
  categoryName: string;
  categorySortOrder: number;
  subcategoryId: string | null;
  subcategoryName: string | null;
  subcategorySortOrder: number | null;
};

export type EditorLine = {
  key: string;
  quoteLineItemId: string | null;
  productId: string | null;
  jobStructureId: string | null;
  jobStructurePieceId?: string | null;
  lineType: SaveDeliveryTicketInput["lines"][number]["lineType"];
  itemCode: string;
  description: string;
  quantity: string;
  unit: string;
  weightEach: string;
  /** JOB-ticket extras only: the price agreed when the item was added. */
  unitPrice?: string;
  yardLocation: string;
};

export type ProductGroupOption = {
  id: string;
  name: string;
  parentId: string | null;
};

export type PaymentMethodValue = "PAY_NOW" | "ON_ACCOUNT" | "";

export type SplitDraftPiece = { name: string; weight: string };

export type OverQuoteEntry = {
  label: string;
  unit: string;
  onLoad: number;
  available: number;
};
