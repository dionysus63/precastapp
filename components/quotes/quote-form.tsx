"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  createQuote,
  getCustomerForQuoteForm,
  searchCustomersForQuoteForm,
  searchJobsForQuoteForm,
  searchProductsForQuoteForm,
  updateQuote,
  type CreateQuoteInput,
} from "@/app/quotes/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  type EditableQuoteLineItem,
  type QuoteFormCustomerOption,
  type QuoteFormInitialValues,
  type QuoteFormJobOption,
  type QuoteFormPriceListOption,
  type QuoteFormProductOption,
  type QuoteFormServiceOption,
  type QuoteLineItemType,
  type QuoteStatus,
  type QuoteType,
  DEFAULT_QUOTE_TAX_RATE,
  DEFAULT_QUOTE_CUSTOMER_NAME,
  calculateQuoteTotals,
  formatQuoteCurrency,
  formatQuoteWeight,
  formatQuoteYards,
  getLineItemTotal,
  isCategoryLineItem,
  parseQuoteNumber,
  pickDefaultCustomerContact,
  type QuoteFormCustomerContactOption,
  quoteCompactInputClassName,
  quoteEstimatorFormOptions,
  quoteInputClassName,
  quoteLineItemTypeLabels,
  quoteLineItemTypeOptions,
  quoteStatusFormOptions,
  quoteTermsFormOptions,
  quoteTypeFormOptions,
} from "@/components/quotes/quote-utils";
import { QuoteFormTypeahead } from "@/components/quotes/quote-form-typeahead";
import { QuoteLineItemsTable } from "@/components/quotes/quote-line-items-table";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import type { RingBuilderConfig } from "@/lib/ring-builder-settings";
import { richTextHasContent, sanitizeRichText } from "@/lib/rich-text";
import {
  clearWorkbookApplyPayload,
  mergeWorkbookLineItems,
  readWorkbookApplyPayload,
  writeWorkbookSession,
} from "@/lib/quotes/structure-workbook";

const quoteTableInputClassName =
  "w-full min-w-[4rem] rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm";

// Client-only and rarely opened, so keep the ring builder out of the main
// quote-form chunk and load it on first use.
const RingBuilderModal = dynamic(
  () =>
    import("@/components/quotes/ring-builder-modal").then(
      (mod) => mod.RingBuilderModal,
    ),
  { ssr: false },
);

type AddLineModalType = Exclude<QuoteLineItemType, "MISC" | "CATEGORY">;

type QuoteFormProps = {
  /**
   * Pre-resolved selections so the form renders without catalog queries:
   * the quote's customer/job in edit mode, or the entities referenced by
   * ?jobId / ?customerId on the new-quote page. Everything else is fetched
   * on demand through the typeahead server actions.
   */
  initialCustomer?: QuoteFormCustomerOption | null;
  initialJob?: QuoteFormJobOption | null;
  /**
   * Raw ?customerId query param. Distinguishes an explicitly requested
   * customer (locked against job-driven changes) from one derived from the
   * selected job.
   */
  initialCustomerId?: string;
  initialJobBidderId?: string;
  serviceOptions: QuoteFormServiceOption[];
  priceLists?: QuoteFormPriceListOption[];
  ringBuilderConfig?: RingBuilderConfig;
  ringSlabProducts?: QuoteFormProductOption[];
  quoteId?: string;
  initialValues?: QuoteFormInitialValues;
  quoteDefaults?: {
    defaultTaxRate: number;
    defaultLeadTime: string | null;
    defaultExpirationDate: string;
    estimators: string[];
    paymentTerms: string[];
    defaultEstimator?: string | null;
  };
};

type CustomStructureRow = {
  id: string;
  structureNumber: string;
  description: string;
  qty: string;
  unitPrice: string;
  weight: string;
  yards: string;
};

type FlashMessage = {
  type: "success" | "info" | "error";
  text: string;
};

function createLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultCustomStructureRow(
  existingRows: CustomStructureRow[],
): CustomStructureRow {
  return {
    id: createLineId(),
    structureNumber: `CS-${existingRows.length + 1}`,
    description: "",
    qty: "1",
    unitPrice: "",
    weight: "",
    yards: "",
  };
}

function renumberLineItems(items: EditableQuoteLineItem[]) {
  return items.map((item, index) => ({
    ...item,
    lineNumber: index + 1,
  }));
}

export function QuoteForm({
  initialCustomer = null,
  initialJob = null,
  initialCustomerId,
  initialJobBidderId,
  serviceOptions,
  priceLists = [],
  ringBuilderConfig = [],
  ringSlabProducts = [],
  quoteId,
  initialValues,
  quoteDefaults,
}: QuoteFormProps) {
  const router = useRouter();
  const isEditing = Boolean(quoteId && initialValues);
  const initialSelectedContact =
    initialCustomer ? pickDefaultCustomerContact(initialCustomer.contacts) : null;
  const baseEstimatorOptions =
    quoteDefaults?.estimators?.length
      ? quoteDefaults.estimators
      : quoteEstimatorFormOptions;
  const defaultEstimator = quoteDefaults?.defaultEstimator?.trim() ?? "";
  const matchedEstimator = defaultEstimator
    ? baseEstimatorOptions.find(
        (option) => option.toLowerCase() === defaultEstimator.toLowerCase(),
      )
    : undefined;
  const estimatorOptions =
    defaultEstimator && !matchedEstimator
      ? [defaultEstimator, ...baseEstimatorOptions]
      : baseEstimatorOptions;
  const paymentTermOptions =
    quoteDefaults?.paymentTerms?.length
      ? quoteDefaults.paymentTerms
      : quoteTermsFormOptions;
  const initialTaxRate = quoteDefaults?.defaultTaxRate ?? DEFAULT_QUOTE_TAX_RATE;
  const initialEstimator =
    matchedEstimator ??
    (defaultEstimator || (estimatorOptions[0] ?? "Nick"));
  const initialLeadTime = quoteDefaults?.defaultLeadTime ?? "";
  const initialExpirationDate = quoteDefaults?.defaultExpirationDate ?? "";
  const initialTerms = paymentTermOptions[0] ?? "";

  const [isPending, startTransition] = useTransition();
  const [lineItems, setLineItems] = useState<EditableQuoteLineItem[]>(
    initialValues?.lineItems ?? [],
  );

  useEffect(() => {
    const payload = readWorkbookApplyPayload(quoteId);
    if (!payload?.lineItems?.length) {
      return;
    }
    setLineItems((current) =>
      mergeWorkbookLineItems(current, payload.lineItems),
    );
    clearWorkbookApplyPayload(quoteId);
  }, [quoteId]);
  const [customerLocked, setCustomerLocked] = useState(
    Boolean(initialValues?.customerId || initialCustomerId || initialJobBidderId),
  );
  const [jobBidderId, setJobBidderId] = useState(
    initialValues?.jobBidderId ?? initialJobBidderId ?? "",
  );
  const [customerId, setCustomerId] = useState(
    initialValues?.customerId ??
      initialCustomer?.id ??
      initialJob?.customerId ??
      "",
  );
  // Contact options for the picker. Seeded from the server-resolved initial
  // customer and refreshed whenever the user selects a different customer.
  const [selectedCustomer, setSelectedCustomer] =
    useState<QuoteFormCustomerOption | null>(initialCustomer);
  const [customerName, setCustomerName] = useState(
    initialValues?.customerName ??
      initialCustomer?.name ??
      initialJob?.customerName ??
      DEFAULT_QUOTE_CUSTOMER_NAME,
  );
  const [jobId, setJobId] = useState(initialValues?.jobId ?? initialJob?.id ?? "");
  const [selectedJobLabel, setSelectedJobLabel] = useState(
    initialJob?.label ?? "",
  );
  const [jobNumber, setJobNumber] = useState(
    initialValues?.jobNumber ?? initialJob?.jobNumber ?? "",
  );
  const [projectName, setProjectName] = useState(
    initialValues?.projectName ?? initialJob?.projectName ?? "",
  );
  const [scopeLabel, setScopeLabel] = useState(
    initialValues?.scopeLabel ?? "",
  );
  const [projectAddress, setProjectAddress] = useState(
    initialValues?.projectAddress ?? initialJob?.projectAddress ?? "",
  );
  const [contactId, setContactId] = useState(
    initialValues?.contactId ?? initialSelectedContact?.id ?? "",
  );
  const [contactTitle, setContactTitle] = useState(
    initialValues?.contactTitle ?? initialSelectedContact?.title ?? "",
  );
  const [contactName, setContactName] = useState(
    initialValues?.contactName ??
      initialSelectedContact?.name ??
      initialCustomer?.contactName ??
      initialJob?.contactName ??
      "",
  );
  const [contactEmail, setContactEmail] = useState(
    initialValues?.contactEmail ??
      initialSelectedContact?.email ??
      initialCustomer?.contactEmail ??
      initialJob?.contactEmail ??
      "",
  );
  const [contactPhone, setContactPhone] = useState(
    initialValues?.contactPhone ??
      initialSelectedContact?.phone ??
      initialCustomer?.contactPhone ??
      initialJob?.contactPhone ??
      "",
  );
  const [status, setStatus] = useState<QuoteStatus>(
    initialValues?.status ?? "DRAFT",
  );
  const [quoteType, setQuoteType] = useState<QuoteType>(
    initialValues?.quoteType ?? "MIXED",
  );
  const [estimator, setEstimator] = useState(
    initialValues?.estimator || initialEstimator,
  );
  const [bidDueDate, setBidDueDate] = useState(initialValues?.bidDueDate ?? "");
  const [quoteDate, setQuoteDate] = useState(initialValues?.quoteDate ?? "");
  const [expirationDate, setExpirationDate] = useState(
    initialValues?.expirationDate || initialExpirationDate,
  );
  const [customerPo, setCustomerPo] = useState(initialValues?.customerPo ?? "");
  const [internalNotes, setInternalNotes] = useState(
    initialValues?.internalNotes ?? "",
  );
  const [customerNotes, setCustomerNotes] = useState(
    initialValues?.customerNotes ?? "",
  );
  const [leadTime, setLeadTime] = useState(
    initialValues?.leadTime || initialLeadTime,
  );
  const [deliveryNotes, setDeliveryNotes] = useState(
    initialValues?.deliveryNotes ?? "",
  );
  const [termsAndConditions, setTermsAndConditions] = useState(
    initialValues?.termsAndConditions || initialTerms,
  );
  const [priceListId, setPriceListId] = useState(
    () =>
      initialValues?.priceListId ||
      priceLists.find((list) => list.isDefault)?.id ||
      "",
  );
  const [taxRate, setTaxRate] = useState(
    initialValues?.taxRate ?? String(initialTaxRate),
  );
  const [flashMessage, setFlashMessage] = useState<FlashMessage | null>(null);
  const [activeLineType, setActiveLineType] =
    useState<QuoteLineItemType>("STOCK_PRODUCT");
  const [addModalType, setAddModalType] = useState<AddLineModalType | null>(
    null,
  );

  const [selectedStockProduct, setSelectedStockProduct] =
    useState<QuoteFormProductOption | null>(null);
  const [selectedConfigurableProduct, setSelectedConfigurableProduct] =
    useState<QuoteFormProductOption | null>(null);
  const [structureNumber, setStructureNumber] = useState("MH-1");
  const [structureDescription, setStructureDescription] = useState("");
  const [structureQty, setStructureQty] = useState("1");
  const [structureUnitPrice, setStructureUnitPrice] = useState("");
  const [structureWeight, setStructureWeight] = useState("");
  const [structureYards, setStructureYards] = useState("");

  const [customStructureRows, setCustomStructureRows] = useState<
    CustomStructureRow[]
  >(() => [createDefaultCustomStructureRow([])]);

  const [editingCustomStructureLineId, setEditingCustomStructureLineId] =
    useState<string | null>(null);
  const [editingCustomStructureDraft, setEditingCustomStructureDraft] =
    useState<CustomStructureRow | null>(null);

  const [ringBuilderModalOpen, setRingBuilderModalOpen] = useState(false);

  const [selectedServiceItem, setSelectedServiceItem] = useState(
    serviceOptions[0]?.item ?? "Delivery",
  );
  const [serviceDescription, setServiceDescription] = useState(
    serviceOptions[0]?.description ?? "",
  );
  const [serviceQty, setServiceQty] = useState("1");
  const [serviceUnit, setServiceUnit] = useState(
    serviceOptions[0]?.unit ?? "EA",
  );
  const [serviceUnitPrice, setServiceUnitPrice] = useState(
    String(serviceOptions[0]?.defaultUnitPrice ?? 0),
  );
  const [serviceTaxable, setServiceTaxable] = useState(
    serviceOptions[0]?.taxable ?? false,
  );

  const activeHint =
    quoteLineItemTypeOptions.find((option) => option.value === activeLineType)
      ?.hint ?? "";

  const taxRatePercent = useMemo(() => {
    const parsed = Number.parseFloat(taxRate.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : DEFAULT_QUOTE_TAX_RATE;
  }, [taxRate]);

  const totals = useMemo(
    () => calculateQuoteTotals(lineItems, taxRatePercent),
    [lineItems, taxRatePercent],
  );

  // Stable wrappers so the typeahead effects don't refire on every render.
  const searchStockProducts = useCallback(
    (query: string) => searchProductsForQuoteForm(query, "STOCK"),
    [],
  );
  const searchConfigurableProducts = useCallback(
    (query: string) => searchProductsForQuoteForm(query, "CONFIGURABLE"),
    [],
  );

  function applyContactSelection(contact: QuoteFormCustomerContactOption | null) {
    if (!contact) {
      setContactId("");
      setContactTitle("");
      return;
    }

    setContactId(contact.id);
    setContactTitle(contact.title);
    setContactName(contact.name);
    setContactEmail(contact.email);
    setContactPhone(contact.phone);
  }

  function clearContactLinkIfCustomized(
    next: {
      name?: string;
      email?: string;
      phone?: string;
      title?: string;
    },
    linkedContactId: string,
  ) {
    if (!linkedContactId || !selectedCustomer) {
      return;
    }

    const linked = selectedCustomer.contacts.find(
      (contact) => contact.id === linkedContactId,
    );
    if (!linked) {
      setContactId("");
      return;
    }

    const name = next.name ?? contactName;
    const email = next.email ?? contactEmail;
    const phone = next.phone ?? contactPhone;
    const title = next.title ?? contactTitle;

    if (
      name !== linked.name ||
      email !== linked.email ||
      phone !== linked.phone ||
      title !== linked.title
    ) {
      setContactId("");
    }
  }

  function showFlash(type: FlashMessage["type"], text: string) {
    setFlashMessage({ type, text });
  }

  function validateQuote(): string | null {
    if (!customerId && !customerName.trim()) {
      return "Customer is required. Select a customer or enter a customer name.";
    }

    if (!jobId && !projectName.trim()) {
      return "Project name or job is required.";
    }

    if (lineItems.length === 0) {
      return "Add at least one line item.";
    }

    const billableLines = lineItems.filter(
      (line) => !isCategoryLineItem(line.type),
    );
    if (billableLines.length === 0) {
      return "Add at least one billable line item (not only categories).";
    }

    if (taxRatePercent < 0) {
      return "Tax rate cannot be negative.";
    }

    for (const line of lineItems) {
      if (isCategoryLineItem(line.type)) {
        if (!line.description.trim()) {
          return `Line ${line.lineNumber}: category name is required.`;
        }
        continue;
      }

      const qty = parseQuoteNumber(line.qty);
      const unitPrice = parseQuoteNumber(line.unitPrice);

      if (qty <= 0) {
        return `Line ${line.lineNumber}: quantity must be greater than 0.`;
      }

      if (unitPrice < 0) {
        return `Line ${line.lineNumber}: unit price cannot be negative.`;
      }
    }

    return null;
  }

  function buildCreateQuoteInput(): CreateQuoteInput {
    return {
      customerId: customerId || null,
      customerName: customerName.trim(),
      jobId: jobId || null,
      jobBidderId: jobBidderId || null,
      jobNumber: jobNumber || null,
      projectName: projectName.trim(),
      scopeLabel: scopeLabel.trim() || null,
      projectAddress: projectAddress.trim() || null,
      contactName: contactName.trim() || null,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
      contactId: contactId || null,
      contactTitle: contactTitle.trim() || null,
      status,
      quoteType,
      estimator: estimator || null,
      quoteDate: quoteDate || null,
      bidDueDate: bidDueDate || null,
      expirationDate: expirationDate || null,
      priceListId: priceListId || null,
      customerPO: customerPo.trim() || null,
      taxRate: taxRatePercent,
      internalNotes: internalNotes.trim() || null,
      customerNotes: customerNotes.trim() || null,
      termsAndConditions: termsAndConditions.trim() || null,
      leadTime: leadTime.trim() || null,
      deliveryNotes: deliveryNotes.trim() || null,
      lineItems: lineItems.map((line) => ({
        lineNumber: line.lineNumber,
        lineType: line.type,
        productId: line.productId ?? null,
        itemCode: line.item,
        description: line.description,
        quantity: parseQuoteNumber(line.qty),
        unit: line.unit,
        unitPrice: parseQuoteNumber(line.unitPrice),
        weight: line.weight.trim()
          ? parseQuoteNumber(line.weight)
          : null,
        yards: line.yards.trim() ? parseQuoteNumber(line.yards) : null,
        taxable: line.taxable,
        total: isCategoryLineItem(line.type) ? 0 : getLineItemTotal(line),
        statusNote: line.statusNote ?? null,
        notes: null,
        isDrainRing: line.isDrainRing ?? false,
        ringDiameterFeet: line.ringDiameterFeet ?? null,
        poolHeightFeet: line.poolHeightFeet ?? null,
        drainRingStyle: line.drainRingStyle ?? "DRAIN",
        structureConfigJson: line.structureConfig ?? null,
      })),
      totals,
    };
  }

  function handleSaveDraft(previewAfterSave = false) {
    const validationError = validateQuote();
    if (validationError) {
      showFlash("error", validationError);
      return;
    }

    startTransition(async () => {
      const input = buildCreateQuoteInput();
      const result = quoteId
        ? await updateQuote(quoteId, input, previewAfterSave)
        : await createQuote(input, previewAfterSave);
      if (result?.error) {
        showFlash("error", result.error);
      }
    });
  }

  function handleSaveAndPreview() {
    handleSaveDraft(true);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleSaveDraft();
  }

  function handleCustomerSelect(customer: QuoteFormCustomerOption | null) {
    setCustomerId(customer?.id ?? "");
    setSelectedCustomer(customer);
    setCustomerLocked(true);
    setJobBidderId("");

    if (!customer) {
      return;
    }

    setCustomerName(customer.name);
    const defaultContact = pickDefaultCustomerContact(customer.contacts);
    if (defaultContact) {
      applyContactSelection(defaultContact);
    } else {
      setContactId("");
      setContactTitle("");
      setContactName(customer.contactName);
      setContactEmail(customer.contactEmail);
      setContactPhone(customer.contactPhone);
    }
  }

  function handleContactPickerChange(value: string) {
    if (!value) {
      setContactId("");
      setContactTitle("");
      return;
    }

    const contact = selectedCustomer?.contacts.find(
      (entry) => entry.id === value,
    );
    if (contact) {
      applyContactSelection(contact);
    }
  }

  function handleJobSelect(job: QuoteFormJobOption | null) {
    setJobId(job?.id ?? "");

    if (!job) {
      setJobNumber("");
      return;
    }

    setJobNumber(job.jobNumber);
    setProjectName(job.projectName);
    setProjectAddress(job.projectAddress);

    if (!customerLocked) {
      if (job.customerName) {
        setCustomerName(job.customerName);
      }

      if (job.customerId) {
        setCustomerId(job.customerId);
        // Load the job's customer (with contacts) so the contact picker
        // offers that customer's contacts, matching the old preloaded lookup.
        // Not routed through the save transition: it must not flip the Save
        // button into its pending state.
        void getCustomerForQuoteForm(job.customerId).then((customer) => {
          setSelectedCustomer(customer);
        });
      }

      if (job.contactName) {
        setContactName(job.contactName);
      }

      if (job.contactEmail) {
        setContactEmail(job.contactEmail);
      }

      if (job.contactPhone) {
        setContactPhone(job.contactPhone);
      }
    }
  }

  function openAddModal(type: AddLineModalType) {
    setActiveLineType(type);
    setAddModalType(type);

    if (type === "CONFIGURABLE_STRUCTURE") {
      const product = selectedConfigurableProduct;
      setStructureDescription(
        product ? `${product.description} ${structureNumber}`.trim() : "",
      );
      setStructureUnitPrice(product ? String(product.unitPrice) : "");
      setStructureWeight(product ? String(product.weightLb) : "");
      setStructureYards(product ? String(product.yards) : "");
    }

    if (type === "CUSTOM_STRUCTURE") {
      setCustomStructureRows([createDefaultCustomStructureRow([])]);
    }

    if (type === "SERVICE") {
      const service =
        serviceOptions.find((entry) => entry.item === selectedServiceItem) ??
        serviceOptions[0];
      if (service) {
        setServiceDescription(service.description);
        setServiceUnitPrice(String(service.defaultUnitPrice));
        setServiceTaxable(service.taxable);
        setServiceUnit(service.unit);
      }
    }
  }

  function closeAddModal() {
    setAddModalType(null);
  }

  function addLineItems(items: EditableQuoteLineItem[]) {
    setLineItems((current) =>
      renumberLineItems([...current, ...items]),
    );
    closeAddModal();
  }

  function handleAddRingBuilderItems(items: EditableQuoteLineItem[]) {
    addLineItems(items);
    setRingBuilderModalOpen(false);
  }

  function openStructureWorkbook() {
    const returnPath = quoteId ? `/quotes/${quoteId}/edit` : "/quotes/new";
    const workbookPath = quoteId
      ? `/quotes/${quoteId}/edit/structures`
      : "/quotes/new/structures";

    writeWorkbookSession(quoteId, {
      rows: [],
      returnPath,
      pendingLineItems: lineItems,
    });

    router.push(workbookPath);
  }

  function addLineItem(line: EditableQuoteLineItem) {
    setLineItems((current) =>
      renumberLineItems([...current, { ...line, lineNumber: current.length + 1 }]),
    );
    closeAddModal();
  }

  function addCategoryLine() {
    setLineItems((current) =>
      renumberLineItems([
        ...current,
        {
          id: createLineId(),
          lineNumber: current.length + 1,
          type: "CATEGORY",
          typeLabel: quoteLineItemTypeLabels.CATEGORY,
          item: "",
          description: "",
          qty: "0",
          unit: "",
          unitPrice: "0",
          weight: "",
          yards: "",
          taxable: false,
        },
      ]),
    );
  }

  function handleAddStockProduct() {
    const product = selectedStockProduct;
    if (!product) {
      return;
    }

    addLineItem({
      id: createLineId(),
      lineNumber: lineItems.length + 1,
      type: "STOCK_PRODUCT",
      typeLabel: quoteLineItemTypeLabels.STOCK_PRODUCT,
      item: product.code,
      description: product.description,
      qty: "1",
      unit: product.unit,
      unitPrice: String(product.unitPrice),
      weight: product.weightLb > 0 ? String(product.weightLb) : "",
      yards: product.yards > 0 ? String(product.yards) : "",
      taxable: product.taxable,
      productId: product.id,
    });
  }

  function handleAddConfigurableStructure() {
    const product = selectedConfigurableProduct;
    if (!product) {
      return;
    }

    addLineItem({
      id: createLineId(),
      lineNumber: lineItems.length + 1,
      type: "CONFIGURABLE_STRUCTURE",
      typeLabel: quoteLineItemTypeLabels.CONFIGURABLE_STRUCTURE,
      item: product.code,
      description:
        structureDescription.trim() ||
        `${product.description} ${structureNumber}`.trim(),
      qty: structureQty || "1",
      unit: "EA",
      unitPrice: structureUnitPrice || String(product.unitPrice),
      weight: structureWeight || (product.weightLb > 0 ? String(product.weightLb) : ""),
      yards: structureYards || (product.yards > 0 ? String(product.yards) : ""),
      taxable: true,
      productId: product.id,
      statusNote: "Cut sheet required after award.",
    });
  }

  function updateCustomStructureRow(
    id: string,
    field: keyof Omit<CustomStructureRow, "id">,
    value: string,
  ) {
    setCustomStructureRows((current) =>
      current.map((row) =>
        row.id === id ? { ...row, [field]: value } : row,
      ),
    );
  }

  function updateEditingCustomStructureDraft(
    field: keyof Omit<CustomStructureRow, "id">,
    value: string,
  ) {
    setEditingCustomStructureDraft((current) =>
      current ? { ...current, [field]: value } : current,
    );
  }

  const openEditCustomStructureLine = useCallback(
    (line: EditableQuoteLineItem) => {
      setEditingCustomStructureLineId(line.id);
      setEditingCustomStructureDraft({
        id: line.id,
        structureNumber: line.item,
        description: line.description,
        qty: line.qty,
        unitPrice: line.unitPrice,
        weight: line.weight,
        yards: line.yards,
      });
    },
    [],
  );

  function closeEditCustomStructureLine() {
    setEditingCustomStructureLineId(null);
    setEditingCustomStructureDraft(null);
  }

  function handleSaveEditedCustomStructure() {
    if (!editingCustomStructureDraft || !editingCustomStructureLineId) {
      return;
    }

    const draft = editingCustomStructureDraft;
    setLineItems((current) =>
      current.map((line) =>
        line.id === editingCustomStructureLineId
          ? {
              ...line,
              item: draft.structureNumber.trim() || line.item,
              description: sanitizeRichText(draft.description),
              qty: draft.qty || "1",
              unitPrice: draft.unitPrice || "0",
              weight: draft.weight,
              yards: draft.yards,
            }
          : line,
      ),
    );
    closeEditCustomStructureLine();
  }

  function handleAddCustomStructure() {
    const items: EditableQuoteLineItem[] = [];

    for (const row of customStructureRows) {
      const hasContent =
        richTextHasContent(row.description) ||
        row.structureNumber.trim() ||
        row.unitPrice.trim() ||
        row.weight.trim() ||
        row.yards.trim();

      if (!hasContent) {
        continue;
      }

      items.push({
        id: createLineId(),
        lineNumber: 0,
        type: "CUSTOM_STRUCTURE",
        typeLabel: quoteLineItemTypeLabels.CUSTOM_STRUCTURE,
        item: row.structureNumber.trim() || "Custom Structure",
        description: sanitizeRichText(row.description),
        qty: row.qty || "1",
        unit: "EA",
        unitPrice: row.unitPrice || "0",
        weight: row.weight,
        yards: row.yards,
        taxable: true,
      });
    }

    if (items.length === 0) {
      showFlash(
        "error",
        "Enter at least one custom structure with a structure number, description, or pricing details.",
      );
      return;
    }

    addLineItems(items);
  }

  function handleAddService() {
    const service = serviceOptions.find(
      (entry) => entry.item === selectedServiceItem,
    );

    addLineItem({
      id: createLineId(),
      lineNumber: lineItems.length + 1,
      type: service?.lineType ?? "SERVICE",
      typeLabel:
        service?.lineType === "MISC"
          ? quoteLineItemTypeLabels.MISC
          : quoteLineItemTypeLabels.SERVICE,
      item: selectedServiceItem,
      description: serviceDescription,
      qty: serviceQty || "1",
      unit: serviceUnit || "EA",
      unitPrice: serviceUnitPrice || "0",
      weight: "",
      yards: "",
      taxable: serviceTaxable,
      productId: service?.id ?? null,
    });
  }

  // Stable callbacks so the memoized line-items table and its rows skip
  // re-renders while header fields change.
  const updateLineItem = useCallback(
    (id: string, field: keyof EditableQuoteLineItem, value: string | boolean) => {
      setLineItems((current) =>
        current.map((line) =>
          line.id === id ? { ...line, [field]: value } : line,
        ),
      );
    },
    [],
  );

  const removeLineItem = useCallback((id: string) => {
    setLineItems((current) => renumberLineItems(current.filter((line) => line.id !== id)));
  }, []);

  const moveLineItem = useCallback((id: string, direction: "up" | "down") => {
    setLineItems((current) => {
      const index = current.findIndex((line) => line.id === id);
      if (index < 0) {
        return current;
      }

      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return renumberLineItems(next);
    });
  }, []);

  function handleServiceOptionChange(item: string) {
    setSelectedServiceItem(item);
    const service = serviceOptions.find((entry) => entry.item === item);
    if (!service) {
      return;
    }

    setServiceDescription(service.description);
    setServiceUnitPrice(String(service.defaultUnitPrice));
    setServiceTaxable(service.taxable);
    setServiceUnit(service.unit);
  }

  function handleConfigurableProductChange(
    product: QuoteFormProductOption | null,
  ) {
    setSelectedConfigurableProduct(product);
    if (product) {
      setStructureDescription(
        `${product.description} ${structureNumber}`.trim(),
      );
      setStructureUnitPrice(String(product.unitPrice));
      setStructureWeight(product.weightLb > 0 ? String(product.weightLb) : "");
      setStructureYards(product.yards > 0 ? String(product.yards) : "");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {flashMessage ? (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-xs ${
            flashMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : flashMessage.type === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-sky-200 bg-sky-50 text-sky-800"
          }`}
        >
          {flashMessage.text}
        </div>
      ) : null}

      <div className="sticky top-[4.5rem] z-[9] -mx-5 mb-4 border-b border-slate-200/80 bg-white/95 px-5 py-2 shadow-sm backdrop-blur">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_7rem]">
          <div>
            <label
              htmlFor="sticky-customer"
              className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
            >
              Customer
            </label>
            <div className="space-y-1">
              <QuoteFormTypeahead
                inputId="sticky-customer"
                selectedLabel={customerId ? customerName : ""}
                placeholder="Search customers"
                initialItems={selectedCustomer ? [selectedCustomer] : []}
                searchItems={searchCustomersForQuoteForm}
                itemKey={(customer) => customer.id}
                itemLabel={(customer) => customer.name}
                onSelect={handleCustomerSelect}
                clearLabel="No linked customer"
                emptyLabel="No customers match."
                inputClassName={quoteCompactInputClassName}
              />
              {!customerId ? (
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Or type customer name"
                  className={quoteCompactInputClassName}
                />
              ) : null}
            </div>
          </div>
          <div>
            <label
              htmlFor="sticky-projectName"
              className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
            >
              Project Name
            </label>
            <input
              id="sticky-projectName"
              name="projectName"
              type="text"
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="Main Street Drainage"
              className={quoteCompactInputClassName}
            />
          </div>
          <div>
            <label
              htmlFor="sticky-scopeLabel"
              className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
            >
              Scope / Area
            </label>
            <input
              id="sticky-scopeLabel"
              name="scopeLabel"
              type="text"
              value={scopeLabel}
              onChange={(event) => setScopeLabel(event.target.value)}
              placeholder="Area A — Structural"
              className={quoteCompactInputClassName}
            />
          </div>
          <div>
            <label
              htmlFor="sticky-jobNumber"
              className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
            >
              Job Number
            </label>
            <input
              id="sticky-jobNumber"
              name="jobNumber"
              type="text"
              value={jobNumber}
              onChange={(event) => setJobNumber(event.target.value)}
              placeholder="26-001"
              className={quoteCompactInputClassName}
            />
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-100 pt-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="text-slate-500">
              Subtotal{" "}
              <span className="font-medium text-slate-700">
                {formatQuoteCurrency(totals.subtotal)}
              </span>
            </span>
            <span className="text-slate-500">
              Tax{" "}
              <span className="font-medium text-slate-700">
                {formatQuoteCurrency(totals.salesTax)}
              </span>
            </span>
            <span className="text-slate-700">
              Total{" "}
              <span className="text-sm font-semibold text-slate-900">
                {formatQuoteCurrency(totals.total)}
              </span>
            </span>
            <span className="text-slate-500">
              Weight{" "}
              <span className="font-medium text-slate-700">
                {formatQuoteWeight(totals.totalWeight)}
              </span>
            </span>
            <span className="text-slate-500">
              Yards{" "}
              <span className="font-medium text-slate-700">
                {formatQuoteYards(totals.totalYards)}
              </span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleSaveDraft()}
              disabled={isPending}
              className="rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending
                ? "Saving..."
                : isEditing
                  ? "Save Changes"
                  : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={handleSaveAndPreview}
              disabled={isPending}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Preview PDF"}
            </button>
            <button
              type="button"
              onClick={() =>
                showFlash("info", "Sending quotes will be added later.")
              }
              className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Send Quote
            </button>
            <Link
              href={isEditing ? `/quotes/${quoteId}` : "/quotes"}
              className="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>

      <div className="space-y-4">
          <SectionCard title="Quote Details">
            <div className="space-y-3">
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Quote
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      Quote Number
                    </label>
                    <input
                      readOnly
                      value="Auto assigned after saving"
                      className="block w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 shadow-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                      Revision
                    </label>
                    <input
                      readOnly
                      value="R0"
                      className="block w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 shadow-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="status"
                      className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
                    >
                      Quote Status
                    </label>
                    <select
                      id="status"
                      name="status"
                      value={status}
                      onChange={(event) =>
                        setStatus(event.target.value as QuoteStatus)
                      }
                      className={quoteCompactInputClassName}
                    >
                      {quoteStatusFormOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="quoteType"
                      className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
                    >
                      Quote Type
                    </label>
                    <select
                      id="quoteType"
                      name="quoteType"
                      value={quoteType}
                      onChange={(event) =>
                        setQuoteType(event.target.value as QuoteType)
                      }
                      className={quoteCompactInputClassName}
                    >
                      {quoteTypeFormOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="estimator"
                      className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
                    >
                      Estimator
                    </label>
                    <select
                      id="estimator"
                      name="estimator"
                      value={estimator}
                      onChange={(event) => setEstimator(event.target.value)}
                      className={quoteCompactInputClassName}
                    >
                      {estimatorOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="bidDueDate"
                      className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
                    >
                      Bid Due Date
                    </label>
                    <input
                      id="bidDueDate"
                      name="bidDueDate"
                      type="date"
                      value={bidDueDate}
                      onChange={(event) => setBidDueDate(event.target.value)}
                      className={quoteCompactInputClassName}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="quoteDate"
                      className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
                    >
                      Quote Date
                    </label>
                    <input
                      id="quoteDate"
                      name="quoteDate"
                      type="date"
                      value={quoteDate}
                      onChange={(event) => setQuoteDate(event.target.value)}
                      className={quoteCompactInputClassName}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="expirationDate"
                      className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
                    >
                      Expiration Date
                    </label>
                    <input
                      id="expirationDate"
                      name="expirationDate"
                      type="date"
                      value={expirationDate}
                      onChange={(event) =>
                        setExpirationDate(event.target.value)
                      }
                      className={quoteCompactInputClassName}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Job &amp; Contact
                </p>
                <div className="space-y-2">
                  <div className="grid gap-2 lg:grid-cols-2">
                    <div>
                      <div className="mb-0.5 flex items-center justify-between gap-2">
                        <label
                          htmlFor="job"
                          className="text-[10px] font-medium uppercase tracking-wide text-slate-500"
                        >
                          Job
                        </label>
                        <Link
                          href="/jobs/new"
                          className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 hover:underline"
                        >
                          Create New Job
                        </Link>
                      </div>
                      <QuoteFormTypeahead
                        inputId="job"
                        selectedLabel={
                          jobId
                            ? selectedJobLabel ||
                              [jobNumber, projectName]
                                .filter(Boolean)
                                .join(" - ")
                            : ""
                        }
                        placeholder="Search by job number, project, or customer"
                        initialItems={initialJob ? [initialJob] : []}
                        searchItems={searchJobsForQuoteForm}
                        itemKey={(job) => job.id}
                        itemLabel={(job) => job.label}
                        onSelect={(job) => {
                          setSelectedJobLabel(job?.label ?? "");
                          handleJobSelect(job);
                        }}
                        clearLabel="No linked job"
                        emptyLabel="No jobs match."
                        inputClassName={quoteCompactInputClassName}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="projectAddress"
                        className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
                      >
                        Project Address
                      </label>
                      <input
                        id="projectAddress"
                        name="projectAddress"
                        type="text"
                        value={projectAddress}
                        onChange={(event) =>
                          setProjectAddress(event.target.value)
                        }
                        placeholder="120 Main Street, Riverhead, NY"
                        className={quoteCompactInputClassName}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="quoteContactPicker"
                      className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
                    >
                      Contact
                    </label>
                    <select
                      id="quoteContactPicker"
                      value={contactId}
                      onChange={(event) =>
                        handleContactPickerChange(event.target.value)
                      }
                      disabled={!customerId}
                      className={quoteCompactInputClassName}
                    >
                      <option value="">
                        {customerId
                          ? "Custom / enter manually"
                          : "Select a customer first"}
                      </option>
                      {selectedCustomer?.contacts.map((contact) => (
                        <option key={contact.id} value={contact.id}>
                          {contact.name}
                          {contact.title ? ` — ${contact.title}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <label
                        htmlFor="contactName"
                        className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
                      >
                        Contact Name
                      </label>
                      <input
                        id="contactName"
                        name="contactName"
                        type="text"
                        value={contactName}
                        onChange={(event) => {
                          const value = event.target.value;
                          clearContactLinkIfCustomized({ name: value }, contactId);
                          setContactName(value);
                        }}
                        className={quoteCompactInputClassName}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="contactEmail"
                        className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
                      >
                        Contact Email
                      </label>
                      <input
                        id="contactEmail"
                        name="contactEmail"
                        type="email"
                        value={contactEmail}
                        onChange={(event) => {
                          const value = event.target.value;
                          clearContactLinkIfCustomized(
                            { email: value },
                            contactId,
                          );
                          setContactEmail(value);
                        }}
                        className={quoteCompactInputClassName}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="contactPhone"
                        className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
                      >
                        Contact Phone
                      </label>
                      <input
                        id="contactPhone"
                        name="contactPhone"
                        type="tel"
                        value={contactPhone}
                        onChange={(event) => {
                          const value = event.target.value;
                          clearContactLinkIfCustomized(
                            { phone: value },
                            contactId,
                          );
                          setContactPhone(value);
                        }}
                        className={quoteCompactInputClassName}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="contactTitle"
                        className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
                      >
                        Contact Role
                      </label>
                      <input
                        id="contactTitle"
                        name="contactTitle"
                        type="text"
                        value={contactTitle}
                        onChange={(event) => {
                          const value = event.target.value;
                          clearContactLinkIfCustomized(
                            { title: value },
                            contactId,
                          );
                          setContactTitle(value);
                        }}
                        placeholder="Estimator, PM, etc."
                        className={quoteCompactInputClassName}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  Pricing
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div>
                    <label
                      htmlFor="priceList"
                      className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
                    >
                      Price List
                    </label>
                    <select
                      id="priceList"
                      name="priceList"
                      value={priceListId}
                      onChange={(event) => setPriceListId(event.target.value)}
                      className={quoteCompactInputClassName}
                    >
                      <option value="">No price list</option>
                      {priceLists.map((priceList) => (
                        <option key={priceList.id} value={priceList.id}>
                          {priceList.name}
                          {priceList.isDefault ? " (default)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="taxRate"
                      className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
                    >
                      Tax Rate
                    </label>
                    <input
                      id="taxRate"
                      name="taxRate"
                      type="text"
                      value={taxRate}
                      onChange={(event) => setTaxRate(event.target.value)}
                      className={quoteCompactInputClassName}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="customerPo"
                      className="block text-[10px] font-medium uppercase tracking-wide text-slate-500"
                    >
                      Customer PO
                    </label>
                    <input
                      id="customerPo"
                      name="customerPo"
                      type="text"
                      value={customerPo}
                      onChange={(event) => setCustomerPo(event.target.value)}
                      placeholder="Optional"
                      className={quoteCompactInputClassName}
                    />
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Quote Line Items"
            description="Add stock products, structures, and services to the quote."
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {quoteLineItemTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => openAddModal(option.value as AddLineModalType)}
                    className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                      activeLineType === option.value
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setRingBuilderModalOpen(true)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Add Rings
                </button>
                <button
                  type="button"
                  onClick={openStructureWorkbook}
                  className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-semibold text-sky-800 transition-colors hover:bg-sky-100"
                >
                  Circular Structure Workbook
                </button>
                <button
                  type="button"
                  onClick={addCategoryLine}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Add Category
                </button>
              </div>

              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {activeHint}
              </p>

              <QuoteLineItemsTable
                lineItems={lineItems}
                onUpdateLine={updateLineItem}
                onRemoveLine={removeLineItem}
                onMoveLine={moveLineItem}
                onEditCustomStructure={openEditCustomStructureLine}
              />
            </div>
          </SectionCard>

          <SectionCard title="Notes and Terms">
            <div className="grid gap-5">
              <div>
                <label
                  htmlFor="internalNotes"
                  className="block text-xs font-medium text-slate-700"
                >
                  Internal Notes
                </label>
                <textarea
                  id="internalNotes"
                  name="internalNotes"
                  rows={3}
                  value={internalNotes}
                  onChange={(event) => setInternalNotes(event.target.value)}
                  className={quoteInputClassName}
                />
              </div>
              <div>
                <label
                  htmlFor="customerNotes"
                  className="block text-xs font-medium text-slate-700"
                >
                  Customer-Facing Notes
                </label>
                <textarea
                  id="customerNotes"
                  name="customerNotes"
                  rows={3}
                  value={customerNotes}
                  onChange={(event) => setCustomerNotes(event.target.value)}
                  className={quoteInputClassName}
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="terms"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Terms and Conditions
                  </label>
                  <select
                    id="terms"
                    name="terms"
                    value={termsAndConditions}
                    onChange={(event) =>
                      setTermsAndConditions(event.target.value)
                    }
                    className={quoteInputClassName}
                  >
                    <option value="">Select terms…</option>
                    {paymentTermOptions.map((terms) => (
                      <option key={terms} value={terms}>
                        {terms}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="leadTime"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Lead Time
                  </label>
                  <input
                    id="leadTime"
                    name="leadTime"
                    type="text"
                    value={leadTime}
                    onChange={(event) => setLeadTime(event.target.value)}
                    placeholder="4–6 weeks ARO"
                    className={quoteInputClassName}
                  />
                </div>
                <div>
                  <label
                    htmlFor="deliveryNotes"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Delivery Notes
                  </label>
                  <input
                    id="deliveryNotes"
                    name="deliveryNotes"
                    type="text"
                    value={deliveryNotes}
                    onChange={(event) => setDeliveryNotes(event.target.value)}
                    placeholder="Site delivery, crane required"
                    className={quoteInputClassName}
                  />
                </div>
              </div>
            </div>
          </SectionCard>
      </div>

      {addModalType ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            className={`w-full rounded-xl border border-slate-200 bg-white p-4 shadow-lg ${
              addModalType === "CUSTOM_STRUCTURE" ? "max-w-4xl" : "max-w-lg"
            }`}
          >
            {addModalType === "STOCK_PRODUCT" ? (
              <>
                <h3 className="text-sm font-semibold text-slate-900">
                  Add Stock Product
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Select a stock product from the catalog. Casting assemblies
                  are labeled and listed first.
                </p>
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Product
                    </label>
                    <QuoteFormTypeahead
                      selectedLabel={
                        selectedStockProduct
                          ? `${selectedStockProduct.code} — ${selectedStockProduct.description} — ${formatQuoteCurrency(selectedStockProduct.unitPrice)}`
                          : ""
                      }
                      placeholder="Search by product code or name"
                      searchItems={searchStockProducts}
                      itemKey={(product) => product.id}
                      itemLabel={(product) =>
                        `${product.code} — ${product.description} — ${formatQuoteCurrency(product.unitPrice)}`
                      }
                      onSelect={setSelectedStockProduct}
                      emptyLabel="No active stock products match. Add products in the Products module first."
                      inputClassName={quoteInputClassName}
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeAddModal}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddStockProduct}
                    disabled={!selectedStockProduct}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Add to Quote
                  </button>
                </div>
              </>
            ) : null}

            {addModalType === "CONFIGURABLE_STRUCTURE" ? (
              <>
                <h3 className="text-sm font-semibold text-slate-900">
                  Add Configurable Structure
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Based on a product template with job-specific details.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Product Template
                    </label>
                    <QuoteFormTypeahead
                      selectedLabel={
                        selectedConfigurableProduct
                          ? `${selectedConfigurableProduct.code} — ${selectedConfigurableProduct.description}`
                          : ""
                      }
                      placeholder="Search by product code or name"
                      searchItems={searchConfigurableProducts}
                      itemKey={(product) => product.id}
                      itemLabel={(product) =>
                        `${product.code} — ${product.description}`
                      }
                      onSelect={handleConfigurableProductChange}
                      emptyLabel="No active configurable products match. Add products in the Products module first."
                      inputClassName={quoteInputClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Structure Number
                    </label>
                    <input
                      type="text"
                      value={structureNumber}
                      onChange={(event) => {
                        setStructureNumber(event.target.value);
                        if (selectedConfigurableProduct) {
                          setStructureDescription(
                            `${selectedConfigurableProduct.description} ${event.target.value}`.trim(),
                          );
                        }
                      }}
                      className={quoteInputClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Quantity
                    </label>
                    <input
                      type="text"
                      value={structureQty}
                      onChange={(event) => setStructureQty(event.target.value)}
                      className={quoteInputClassName}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Description
                    </label>
                    <input
                      type="text"
                      value={structureDescription}
                      onChange={(event) =>
                        setStructureDescription(event.target.value)
                      }
                      className={quoteInputClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Unit Price
                    </label>
                    <input
                      type="text"
                      value={structureUnitPrice}
                      onChange={(event) =>
                        setStructureUnitPrice(event.target.value)
                      }
                      placeholder="14250"
                      className={quoteInputClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Weight (lb)
                    </label>
                    <input
                      type="text"
                      value={structureWeight}
                      onChange={(event) => setStructureWeight(event.target.value)}
                      placeholder="18200"
                      className={quoteInputClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Yards
                    </label>
                    <input
                      type="text"
                      value={structureYards}
                      onChange={(event) => setStructureYards(event.target.value)}
                      placeholder="5.8"
                      className={quoteInputClassName}
                    />
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeAddModal}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddConfigurableStructure}
                    disabled={!selectedConfigurableProduct}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Add to Quote
                  </button>
                </div>
              </>
            ) : null}

            {addModalType === "CUSTOM_STRUCTURE" ? (
              <>
                <h3 className="text-sm font-semibold text-slate-900">
                  Add Custom Structure
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Job-specific custom structure line items. Use Enter for new
                  description lines and the formatting buttons for emphasis.
                </p>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-semibold text-slate-900">
                      Structures
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setCustomStructureRows((current) => [
                          ...current,
                          createDefaultCustomStructureRow(current),
                        ])
                      }
                      className="rounded-lg border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Add row
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="min-w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2 font-semibold">
                            Structure #
                          </th>
                          <th className="min-w-[16rem] px-3 py-2 font-semibold">
                            Description
                          </th>
                          <th className="w-16 px-3 py-2 font-semibold">Qty</th>
                          <th className="px-3 py-2 font-semibold">
                            Unit Price
                          </th>
                          <th className="px-3 py-2 font-semibold">
                            Weight (lb)
                          </th>
                          <th className="px-3 py-2 font-semibold">Yards</th>
                          <th className="px-3 py-2 font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {customStructureRows.map((row) => (
                          <tr key={row.id} className="align-top">
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={row.structureNumber}
                                onChange={(event) =>
                                  updateCustomStructureRow(
                                    row.id,
                                    "structureNumber",
                                    event.target.value,
                                  )
                                }
                                className={quoteTableInputClassName}
                              />
                            </td>
                            <td className="min-w-[16rem] px-3 py-2">
                              <RichTextEditor
                                value={row.description}
                                onChange={(value) =>
                                  updateCustomStructureRow(
                                    row.id,
                                    "description",
                                    value,
                                  )
                                }
                                placeholder="Custom 8'x12' valve vault with aluminum hatch"
                                minHeightClassName="min-h-[5.5rem]"
                              />
                            </td>
                            <td className="w-16 px-3 py-2">
                              <input
                                type="text"
                                value={row.qty}
                                onChange={(event) =>
                                  updateCustomStructureRow(
                                    row.id,
                                    "qty",
                                    event.target.value,
                                  )
                                }
                                className={`${quoteTableInputClassName} min-w-0 max-w-[4rem]`}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={row.unitPrice}
                                onChange={(event) =>
                                  updateCustomStructureRow(
                                    row.id,
                                    "unitPrice",
                                    event.target.value,
                                  )
                                }
                                placeholder="32500"
                                className={quoteTableInputClassName}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={row.weight}
                                onChange={(event) =>
                                  updateCustomStructureRow(
                                    row.id,
                                    "weight",
                                    event.target.value,
                                  )
                                }
                                placeholder="28500"
                                className={quoteTableInputClassName}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={row.yards}
                                onChange={(event) =>
                                  updateCustomStructureRow(
                                    row.id,
                                    "yards",
                                    event.target.value,
                                  )
                                }
                                placeholder="9.2"
                                className={quoteTableInputClassName}
                              />
                            </td>
                            <td className="px-3 py-2">
                              {customStructureRows.length > 1 ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCustomStructureRows((current) =>
                                      current.filter(
                                        (entry) => entry.id !== row.id,
                                      ),
                                    )
                                  }
                                  className="text-[11px] font-medium text-red-600 hover:text-red-800"
                                >
                                  Remove
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeAddModal}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustomStructure}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Add to Quote
                  </button>
                </div>
              </>
            ) : null}

            {addModalType === "SERVICE" ? (
              <>
                <h3 className="text-sm font-semibold text-slate-900">
                  Add Service / Misc Item
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Non-inventory service or miscellaneous charge.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Service
                    </label>
                    <select
                      value={selectedServiceItem}
                      onChange={(event) =>
                        handleServiceOptionChange(event.target.value)
                      }
                      className={quoteInputClassName}
                    >
                      {serviceOptions.map((service) => (
                        <option key={service.item} value={service.item}>
                          {service.item}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Description
                    </label>
                    <input
                      type="text"
                      value={serviceDescription}
                      onChange={(event) =>
                        setServiceDescription(event.target.value)
                      }
                      className={quoteInputClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Quantity
                    </label>
                    <input
                      type="text"
                      value={serviceQty}
                      onChange={(event) => setServiceQty(event.target.value)}
                      className={quoteInputClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Unit
                    </label>
                    <input
                      type="text"
                      value={serviceUnit}
                      onChange={(event) => setServiceUnit(event.target.value)}
                      className={quoteInputClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Unit Price
                    </label>
                    <input
                      type="text"
                      value={serviceUnitPrice}
                      onChange={(event) =>
                        setServiceUnitPrice(event.target.value)
                      }
                      className={quoteInputClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Taxable
                    </label>
                    <select
                      value={serviceTaxable ? "yes" : "no"}
                      onChange={(event) =>
                        setServiceTaxable(event.target.value === "yes")
                      }
                      className={quoteInputClassName}
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeAddModal}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddService}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Add to Quote
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {editingCustomStructureDraft ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <h3 className="text-sm font-semibold text-slate-900">
              Edit Custom Structure
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Update the structure details and formatted description.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Structure Number
                </label>
                <input
                  type="text"
                  value={editingCustomStructureDraft.structureNumber}
                  onChange={(event) =>
                    updateEditingCustomStructureDraft(
                      "structureNumber",
                      event.target.value,
                    )
                  }
                  className={quoteInputClassName}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Quantity
                </label>
                <input
                  type="text"
                  value={editingCustomStructureDraft.qty}
                  onChange={(event) =>
                    updateEditingCustomStructureDraft("qty", event.target.value)
                  }
                  className={quoteInputClassName}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700">
                  Description
                </label>
                <RichTextEditor
                  value={editingCustomStructureDraft.description}
                  onChange={(value) =>
                    updateEditingCustomStructureDraft("description", value)
                  }
                  minHeightClassName="min-h-[7rem]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Unit Price
                </label>
                <input
                  type="text"
                  value={editingCustomStructureDraft.unitPrice}
                  onChange={(event) =>
                    updateEditingCustomStructureDraft(
                      "unitPrice",
                      event.target.value,
                    )
                  }
                  className={quoteInputClassName}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Weight (lb)
                </label>
                <input
                  type="text"
                  value={editingCustomStructureDraft.weight}
                  onChange={(event) =>
                    updateEditingCustomStructureDraft("weight", event.target.value)
                  }
                  className={quoteInputClassName}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Yards
                </label>
                <input
                  type="text"
                  value={editingCustomStructureDraft.yards}
                  onChange={(event) =>
                    updateEditingCustomStructureDraft("yards", event.target.value)
                  }
                  className={quoteInputClassName}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditCustomStructureLine}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditedCustomStructure}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {ringBuilderModalOpen ? (
        <RingBuilderModal
          open={ringBuilderModalOpen}
          onClose={() => setRingBuilderModalOpen(false)}
          ringBuilderConfig={ringBuilderConfig}
          ringSlabProducts={ringSlabProducts}
          lineCount={lineItems.length}
          onAddItems={handleAddRingBuilderItems}
          onError={(message) => showFlash("error", message)}
        />
      ) : null}
    </form>
  );
}
