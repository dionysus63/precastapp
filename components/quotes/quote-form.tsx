"use client";

import { localTodayInput } from "@/lib/date-only";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  createQuote,
  getCustomerForQuoteForm,
  searchProductsForQuoteForm,
  reloadQuoteFormPriceOptions,
  updateQuote,
  type CreateQuoteInput,
  type QuoteSaveDestination,
} from "@/app/quotes/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { useUnsavedChangesWarning } from "@/lib/hooks/use-unsaved-changes-warning";
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
  pickDefaultCustomerContact,
  type QuoteFormCustomerContactOption,
  quoteEstimatorFormOptions,
  quoteLineItemTypeLabels,
  quoteLineItemTypeOptions,
  quoteTermsFormOptions,
} from "@/components/quotes/quote-utils";
import { BackButton } from "@/components/dashboard/back-button";
import type { StagedStockProduct } from "@/components/quotes/stock-product-picker";
import type { ProductTaxonomyCategory } from "@/lib/product-taxonomy";
import type { RingBuilderConfig } from "@/lib/ring-builder-settings";
import {
  clearWorkbookApplyPayload,
  mergeWorkbookLineItems,
  readWorkbookApplyPayload,
  readWorkbookSession,
  writeWorkbookSession,
  type QuoteFormWorkbookSnapshot,
} from "@/lib/quotes/structure-workbook";
import { clearRectWorkbookSession } from "@/lib/quotes/rect-structure-workbook";
import type { QuotePipeProductOption } from "@/lib/quotes/types";
import type {
  PipeQuoteProductType,
  PipeUnitPriceEntry,
} from "@/lib/pipe-quote-utils";
import {
  applyPipeUnitPrices,
  createBlankLine,
  moveLineByStep,
  moveLineToIndex,
  stagedStockProductsToLineItems,
} from "@/components/quotes/quote-form/line-item-ops";
import {
  buildQuoteLineItemsInput,
  buildWorkbookReturnPath,
  createDefaultCustomStructureRow,
  createLineId,
  productMeasureInputValue,
  renumberLineItems,
  validateQuoteForm,
  type AddLineModalType,
  type FlashMessage,
} from "@/components/quotes/quote-form/quote-form-utils";
import { useQuoteDeliveryPricing } from "@/components/quotes/quote-form/use-quote-delivery-pricing";
import { useCustomStructureBuilder } from "@/components/quotes/quote-form/use-custom-structure-builder";
import { useCustomStructureLineEditor } from "@/components/quotes/quote-form/use-custom-structure-line-editor";
import { QuoteFormLeaveDialog } from "@/components/quotes/quote-form/quote-form-leave-dialog";
import { QuoteFormStickyHeader } from "@/components/quotes/quote-form/quote-form-sticky-header";
import { QuoteLineItemsSection } from "@/components/quotes/quote-form/quote-line-items-section";
import {
  QuoteJobContactFields,
  QuoteMetaFields,
  QuotePricingFields,
} from "@/components/quotes/quote-form/quote-details-fields";
import {
  QuoteDeliveryPricingPanel,
  QuoteNotesTermsSection,
} from "@/components/quotes/quote-form/quote-notes-terms-section";
import { CustomStructureImportDialog } from "@/components/quotes/quote-form/custom-structure-import-dialog";
import { AddCustomStructurePanel } from "@/components/quotes/quote-form/add-custom-structure-panel";
import {
  AddConfigurableStructurePanel,
  AddServicePanel,
  AddStockProductPanel,
} from "@/components/quotes/quote-form/add-line-panels";
import { EditCustomStructureDialog } from "@/components/quotes/quote-form/edit-custom-structure-dialog";

// Client-only and rarely opened, so keep the ring builder out of the main
// quote-form chunk and load it on first use.
const RingBuilderModal = dynamic(
  () =>
    import("@/components/quotes/ring-builder-modal").then(
      (mod) => mod.RingBuilderModal,
    ),
  { ssr: false },
);

const PipeModal = dynamic(
  () => import("@/components/quotes/pipe-modal").then((mod) => mod.PipeModal),
  { ssr: false },
);

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
  pipeProducts?: QuotePipeProductOption[];
  taxonomy?: ProductTaxonomyCategory[];
  quoteId?: string;
  initialValues?: QuoteFormInitialValues;
  /** ISO updatedAt of the quote when the edit page loaded it — rejects
   * stale saves (optimistic concurrency). */
  expectedUpdatedAt?: string;
  quoteDefaults?: {
    defaultTaxRate: number;
    defaultLeadTime: string | null;
    defaultExpirationDate: string;
    estimators: string[];
    paymentTerms: string[];
    defaultEstimator?: string | null;
  };
  /** Renders the page's back pill inside the form so leaving with unsaved
   * changes asks to save first (plain Links can't be intercepted). */
  backHref?: string;
  backLabel?: string;
};

export function QuoteForm({
  initialCustomer = null,
  initialJob = null,
  initialCustomerId,
  initialJobBidderId,
  serviceOptions,
  priceLists = [],
  ringBuilderConfig = [],
  ringSlabProducts = [],
  pipeProducts = [],
  taxonomy = [],
  quoteId,
  initialValues,
  expectedUpdatedAt,
  quoteDefaults,
  backHref,
  backLabel,
}: QuoteFormProps) {
  const router = useRouter();
  const isEditing = Boolean(quoteId && initialValues);
  const initialSelectedContact = initialCustomer
    ? pickDefaultCustomerContact(
        initialCustomer.contacts,
        initialCustomer.estimatingContactId,
      )
    : null;
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
  const [isDirty, setIsDirty] = useState(false);
  useUnsavedChangesWarning(isDirty);
  // Back-pill guard: client-side navigation skips beforeunload, so the pill
  // opens this dialog instead when there are unsaved changes.
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [lineItems, setLineItems] = useState<EditableQuoteLineItem[]>(
    initialValues?.lineItems ?? [],
  );
  const [planSheetId, setPlanSheetId] = useState<string | null>(null);
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
  // Sequence number of the latest job-customer lookup (see handleJobSelect).
  const jobCustomerLookupRef = useRef(0);
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

  // Restore state the structure workbook handed back through sessionStorage.
  // This has to run after hydration: reading sessionStorage inside useState
  // initializers would make the client's first render differ from the
  // server-rendered HTML (hydration mismatch), and the payload must be
  // cleared exactly once after a successful merge.
  /* eslint-disable react-hooks/set-state-in-effect -- one-shot post-hydration restore from sessionStorage; see comment above */
  useEffect(() => {
    const payload = readWorkbookApplyPayload(quoteId);
    if (!payload?.lineItems?.length) {
      if (payload?.planSheetId) {
        setPlanSheetId(payload.planSheetId);
        clearWorkbookApplyPayload(quoteId);
      }
      return;
    }
    setLineItems((current) =>
      mergeWorkbookLineItems(current, payload.lineItems),
    );
    if (payload.planSheetId) {
      setPlanSheetId(payload.planSheetId);
    }
    clearWorkbookApplyPayload(quoteId);
  }, [quoteId]);

  useEffect(() => {
    const snapshot = readWorkbookSession(quoteId)?.pendingFormState;
    if (!snapshot) {
      return;
    }

    setCustomerId(snapshot.customerId);
    setCustomerName(snapshot.customerName);
    setCustomerLocked(snapshot.customerLocked);
    setJobId(snapshot.jobId);
    setJobBidderId(snapshot.jobBidderId);
    setSelectedJobLabel(snapshot.selectedJobLabel);
    setJobNumber(snapshot.jobNumber);
    setProjectName(snapshot.projectName);
    setScopeLabel(snapshot.scopeLabel);
    setProjectAddress(snapshot.projectAddress);
    setContactId(snapshot.contactId);
    setContactName(snapshot.contactName);
    setContactEmail(snapshot.contactEmail);
    setContactPhone(snapshot.contactPhone);
    setContactTitle(snapshot.contactTitle);

    if (snapshot.customerId) {
      void getCustomerForQuoteForm(snapshot.customerId).then((customer) => {
        if (customer) {
          setSelectedCustomer(customer);
        }
      });
    }
  }, [quoteId]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
  // New quotes default to today (local time, not UTC — an evening quote
  // shouldn't be dated tomorrow); editing keeps the stored date.
  const [quoteDate, setQuoteDate] = useState(
    initialValues?.quoteDate ?? localTodayInput(),
  );
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
  const [termsAndConditions, setTermsAndConditions] = useState(
    initialValues?.termsAndConditions || initialTerms,
  );
  const fobDefaultForPriceList = (listId: string) =>
    priceLists.find((list) => list.id === listId)?.fobDefault?.trim() ||
    "Factory";
  const [priceListId, setPriceListId] = useState(
    () =>
      initialValues?.priceListId ||
      priceLists.find((list) => list.isDefault)?.id ||
      priceLists[0]?.id ||
      "",
  );
  // F.O.B. seeds from the price list's default; switching lists re-seeds it
  // unless the estimator typed something else.
  const [fob, setFob] = useState(
    () => initialValues?.fob || fobDefaultForPriceList(priceListId),
  );

  function handlePriceListChange(nextPriceListId: string) {
    const previousDefault = fobDefaultForPriceList(priceListId);
    setPriceListId(nextPriceListId);
    if (!fob.trim() || fob === previousDefault) {
      setFob(fobDefaultForPriceList(nextPriceListId));
    }
  }
  const [serviceOptionsState, setServiceOptionsState] = useState(serviceOptions);
  const [ringSlabProductsState, setRingSlabProductsState] =
    useState(ringSlabProducts);
  const [pipeProductsState, setPipeProductsState] = useState(pipeProducts);
  const [taxRate, setTaxRate] = useState(
    initialValues?.taxRate ?? String(initialTaxRate),
  );
  const [flashMessage, setFlashMessage] = useState<FlashMessage | null>(null);
  const [activeLineType, setActiveLineType] =
    useState<QuoteLineItemType>("STOCK_PRODUCT");
  const [addModalType, setAddModalType] = useState<AddLineModalType | null>(
    null,
  );

  const [selectedConfigurableProduct, setSelectedConfigurableProduct] =
    useState<QuoteFormProductOption | null>(null);
  const [structureNumber, setStructureNumber] = useState("MH-1");
  const [structureDescription, setStructureDescription] = useState("");
  const [structureQty, setStructureQty] = useState("1");
  const [structureUnitPrice, setStructureUnitPrice] = useState("");
  const [structureWeight, setStructureWeight] = useState("");
  const [structureYards, setStructureYards] = useState("");

  const {
    editingCustomStructureDraft,
    updateEditingCustomStructureDraft,
    updateEditingCustomStructureCostItems,
    openEditCustomStructureLine,
    closeEditCustomStructureLine,
    handleSaveEditedCustomStructure,
  } = useCustomStructureLineEditor({ setLineItems });

  const [ringBuilderModalOpen, setRingBuilderModalOpen] = useState(false);
  const [pipeModalType, setPipeModalType] = useState<PipeQuoteProductType | null>(
    null,
  );

  const [selectedServiceItem, setSelectedServiceItem] = useState(
    serviceOptionsState[0]?.item ?? "Delivery",
  );
  const [serviceDescription, setServiceDescription] = useState(
    serviceOptionsState[0]?.description ?? "",
  );
  const [serviceQty, setServiceQty] = useState("1");
  const [serviceUnit, setServiceUnit] = useState(
    serviceOptionsState[0]?.unit ?? "EA",
  );
  const [serviceUnitPrice, setServiceUnitPrice] = useState(
    String(serviceOptionsState[0]?.defaultUnitPrice ?? 0),
  );
  const [serviceTaxable, setServiceTaxable] = useState(
    serviceOptionsState[0]?.taxable ?? false,
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
  const searchConfigurableProducts = useCallback(
    (query: string) =>
      searchProductsForQuoteForm(query, "CONFIGURABLE", priceListId || null),
    [priceListId],
  );

  useEffect(() => {
    let cancelled = false;

    reloadQuoteFormPriceOptions(priceListId || null)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setServiceOptionsState(result.serviceOptions);
        setRingSlabProductsState(result.ringSlabProducts);
        setPipeProductsState(result.pipeProducts);
      })
      .catch(() => {
        // Keep the last loaded options if the refresh fails.
      });

    return () => {
      cancelled = true;
    };
  }, [priceListId]);

  const {
    deliveryNotes,
    setDeliveryNotes,
    shippingHint,
    shippingStatus,
    deliveryLoadsInput,
    setDeliveryLoadsInput,
    maxLoadLbsInput,
    handleMaxLoadLbsInputChange,
    pricePerLoadInput,
    setPricePerLoadInput,
    deliveryLineId,
    autoDeliveryLoads,
    deliveryTotal,
    runShippingLookup,
    handleAddressSuggestionSelect,
    applyDeliveryLineItem,
  } = useQuoteDeliveryPricing({
    initialDeliveryNotes: initialValues?.deliveryNotes ?? "",
    totalWeight: totals.totalWeight,
    serviceOptions: serviceOptionsState,
    setLineItems,
    setProjectAddress,
  });

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
      fob: fob.trim() || null,
      leadTime: leadTime.trim() || null,
      deliveryNotes: deliveryNotes.trim() || null,
      expectedUpdatedAt,
      planSheetId,
      lineItems: buildQuoteLineItemsInput(lineItems),
      totals,
    };
  }

  function handleSaveDraft(afterSave: QuoteSaveDestination = "detail") {
    const validationError = validateQuoteForm({
      customerId,
      customerName,
      jobId,
      projectName,
      lineItems,
      taxRatePercent,
    });
    if (validationError) {
      showFlash("error", validationError);
      return;
    }

    startTransition(async () => {
      const input = buildCreateQuoteInput();
      const result = quoteId
        ? await updateQuote(quoteId, input, afterSave)
        : await createQuote(input, afterSave);
      if (result?.error) {
        showFlash("error", result.error);
      }
    });
  }

  function handleSaveAndPreview() {
    handleSaveDraft("preview");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleSaveDraft();
  }

  function handleCustomerSelect(customer: QuoteFormCustomerOption | null) {
    // A manual pick wins over any job-customer lookup still in flight.
    jobCustomerLookupRef.current += 1;
    setCustomerId(customer?.id ?? "");
    setSelectedCustomer(customer);
    setCustomerLocked(true);
    setJobBidderId("");

    if (!customer) {
      return;
    }

    setCustomerName(customer.name);
    const defaultContact = pickDefaultCustomerContact(
      customer.contacts,
      customer.estimatingContactId,
    );
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
    // Any newer job pick supersedes an in-flight customer lookup.
    const lookupId = ++jobCustomerLookupRef.current;
    setJobId(job?.id ?? "");

    if (!job) {
      setJobNumber("");
      return;
    }

    setJobNumber(job.jobNumber);
    setProjectName(job.projectName);
    setProjectAddress(job.projectAddress);
    runShippingLookup(job.projectAddress ?? "");

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
        // Only the response for the most recent pick may apply, so a slow
        // lookup for an earlier job can't overwrite this job's customer.
        void getCustomerForQuoteForm(job.customerId).then(
          (customer) => {
            if (lookupId === jobCustomerLookupRef.current) {
              setSelectedCustomer(customer);
            }
          },
          () => {
            // Failed lookup: keep the current customer/contacts as they are.
            if (lookupId === jobCustomerLookupRef.current) {
              showFlash(
                "error",
                "Couldn't load the job customer's contacts. Try selecting the job again.",
              );
            }
          },
        );
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

  function closeAddModal() {
    setAddModalType(null);
  }

  function addLineItems(items: EditableQuoteLineItem[]) {
    setLineItems((current) =>
      renumberLineItems([...current, ...items]),
    );
    closeAddModal();
  }

  const {
    customStructureRows,
    setCustomStructureRows,
    customImport,
    setCustomImport,
    customPasteOpen,
    setCustomPasteOpen,
    customPasteText,
    setCustomPasteText,
    customPasteError,
    setCustomPasteError,
    updateCustomStructureRow,
    updateCustomStructureRowCostItems,
    duplicateCustomStructureRow,
    customStructureNumbersInUse,
    openCustomStructureImport,
    importCustomStructureCandidates,
    handleCustomStructurePaste,
    handleAddCustomStructure,
  } = useCustomStructureBuilder({ lineItems, jobId, showFlash, addLineItems });

  function openAddModal(type: AddLineModalType) {
    setActiveLineType(type);
    setAddModalType(type);

    if (type === "CONFIGURABLE_STRUCTURE") {
      const product = selectedConfigurableProduct;
      setStructureDescription(
        product ? `${product.description} ${structureNumber}`.trim() : "",
      );
      setStructureUnitPrice(product ? String(product.unitPrice) : "");
      setStructureWeight(product ? productMeasureInputValue(product.weightLb) : "");
      setStructureYards(product ? productMeasureInputValue(product.yards) : "");
    }

    if (type === "CUSTOM_STRUCTURE") {
      setCustomStructureRows([createDefaultCustomStructureRow([])]);
      setCustomPasteOpen(false);
      setCustomPasteText("");
      setCustomPasteError(null);
    }

    if (type === "SERVICE") {
      const service =
        serviceOptionsState.find((entry) => entry.item === selectedServiceItem) ??
        serviceOptionsState[0];
      if (service) {
        setServiceDescription(service.description);
        setServiceUnitPrice(String(service.defaultUnitPrice));
        setServiceTaxable(service.taxable);
        setServiceUnit(service.unit);
      }
    }
  }

  function handleAddRingBuilderItems(items: EditableQuoteLineItem[]) {
    addLineItems(items);
    setRingBuilderModalOpen(false);
  }

  function handleAddPipeItems(items: EditableQuoteLineItem[]) {
    addLineItems(items);
    setPipeModalType(null);
  }

  function handleAddPipeUnitPrices(entries: PipeUnitPriceEntry[]) {
    setLineItems((current) => applyPipeUnitPrices(current, entries));
    setPipeModalType(null);
  }

  function buildWorkbookFormSnapshot(): QuoteFormWorkbookSnapshot {
    return {
      customerId,
      customerName,
      customerLocked,
      jobId,
      jobBidderId,
      selectedJobLabel,
      jobNumber,
      projectName,
      scopeLabel,
      projectAddress,
      contactId,
      contactName,
      contactEmail,
      contactPhone,
      contactTitle,
    };
  }

  function openStructureWorkbook() {
    const returnPath = buildWorkbookReturnPath({
      quoteId,
      jobId,
      customerId,
      jobBidderId,
    });
    const workbookPath = quoteId
      ? `/quotes/${quoteId}/edit/structures`
      : "/quotes/new/structures";

    writeWorkbookSession(quoteId, {
      rows: [],
      returnPath,
      pendingLineItems: lineItems,
      pendingFormState: buildWorkbookFormSnapshot(),
    });

    router.push(workbookPath);
  }

  function openRectStructureWorkbook() {
    const returnPath = buildWorkbookReturnPath({
      quoteId,
      jobId,
      customerId,
      jobBidderId,
    });
    const workbookPath = quoteId
      ? `/quotes/${quoteId}/edit/rect-structures`
      : "/quotes/new/rect-structures";

    // Shared stash: the rect workbook reads pendingLineItems/returnPath from
    // here and keeps its own rows under a separate key, reseeded per visit.
    writeWorkbookSession(quoteId, {
      rows: [],
      returnPath,
      pendingLineItems: lineItems,
      pendingFormState: buildWorkbookFormSnapshot(),
    });
    clearRectWorkbookSession(quoteId);

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
        createBlankLine("CATEGORY", current.length + 1),
      ]),
    );
  }

  function addNoteLine() {
    setLineItems((current) =>
      renumberLineItems([
        ...current,
        createBlankLine("NOTE", current.length + 1),
      ]),
    );
  }

  function addPageBreakLine() {
    setLineItems((current) =>
      renumberLineItems([
        ...current,
        createBlankLine("PAGE_BREAK", current.length + 1),
      ]),
    );
  }

  function handleAddStockProducts(items: StagedStockProduct[]) {
    if (items.length === 0) {
      return;
    }

    addLineItems(stagedStockProductsToLineItems(items));
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

  function handleAddService() {
    const service = serviceOptionsState.find(
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
    setLineItems((current) => moveLineByStep(current, id, direction));
  }, []);

  /** Drag-drop / jump-to-position: place the line at an exact index. */
  const moveLineItemToIndex = useCallback((id: string, targetIndex: number) => {
    setLineItems((current) => moveLineToIndex(current, id, targetIndex));
  }, []);

  function handleServiceOptionChange(item: string) {
    setSelectedServiceItem(item);
    const service = serviceOptionsState.find((entry) => entry.item === item);
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
      setStructureWeight(productMeasureInputValue(product.weightLb));
      setStructureYards(productMeasureInputValue(product.yards));
    }
  }

  return (
    <>
    {backHref ? (
      <BackButton
        href={backHref}
        label={backLabel ?? "Back"}
        onClick={(event) => {
          if (isDirty) {
            event.preventDefault();
            setShowLeaveConfirm(true);
          }
        }}
      />
    ) : null}

    {showLeaveConfirm && backHref ? (
      <QuoteFormLeaveDialog
        isPending={isPending}
        onKeepEditing={() => setShowLeaveConfirm(false)}
        onDiscard={() => {
          setShowLeaveConfirm(false);
          setIsDirty(false);
          router.push(backHref);
        }}
        onSave={() => {
          setShowLeaveConfirm(false);
          handleSaveDraft();
        }}
      />
    ) : null}

    <form
      onSubmit={handleSubmit}
      onChange={() => setIsDirty(true)}
      className={backHref ? "mt-4" : undefined}
    >
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

      <QuoteFormStickyHeader
        customerId={customerId}
        customerName={customerName}
        selectedCustomer={selectedCustomer}
        onCustomerSelect={handleCustomerSelect}
        onCustomerNameChange={setCustomerName}
        projectName={projectName}
        onProjectNameChange={setProjectName}
        scopeLabel={scopeLabel}
        onScopeLabelChange={setScopeLabel}
        jobNumber={jobNumber}
        onJobNumberChange={setJobNumber}
        totals={totals}
        isPending={isPending}
        isEditing={isEditing}
        quoteId={quoteId}
        onSaveDraft={handleSaveDraft}
        onSaveAndPreview={handleSaveAndPreview}
      />

      <div className="space-y-4">
          <QuoteLineItemsSection
            activeLineType={activeLineType}
            activeHint={activeHint}
            onOpenAddModal={openAddModal}
            onOpenRingBuilder={() => setRingBuilderModalOpen(true)}
            onOpenPipeModal={setPipeModalType}
            onOpenStructureWorkbook={openStructureWorkbook}
            onOpenRectStructureWorkbook={openRectStructureWorkbook}
            onAddCategoryLine={addCategoryLine}
            onAddNoteLine={addNoteLine}
            onAddPageBreakLine={addPageBreakLine}
            lineItems={lineItems}
            onUpdateLine={updateLineItem}
            onRemoveLine={removeLineItem}
            onMoveLine={moveLineItem}
            onMoveLineTo={moveLineItemToIndex}
            onEditCustomStructure={openEditCustomStructureLine}
          />

        <div className="grid items-start gap-4 xl:grid-cols-2">
          <SectionCard title="Quote Details">
            <div className="space-y-3">
              <QuoteMetaFields
                isEditing={isEditing}
                status={status}
                onStatusChange={setStatus}
                quoteType={quoteType}
                onQuoteTypeChange={setQuoteType}
                estimator={estimator}
                onEstimatorChange={setEstimator}
                estimatorOptions={estimatorOptions}
                bidDueDate={bidDueDate}
                onBidDueDateChange={setBidDueDate}
                quoteDate={quoteDate}
                onQuoteDateChange={setQuoteDate}
                expirationDate={expirationDate}
                onExpirationDateChange={setExpirationDate}
              />

              <QuoteJobContactFields
                jobId={jobId}
                selectedJobLabel={selectedJobLabel}
                jobNumber={jobNumber}
                projectName={projectName}
                initialJob={initialJob}
                onJobSelect={(job) => {
                  setSelectedJobLabel(job?.label ?? "");
                  handleJobSelect(job);
                }}
                projectAddress={projectAddress}
                onProjectAddressChange={setProjectAddress}
                onAddressSuggestionSelect={handleAddressSuggestionSelect}
                onAddressSettled={() => runShippingLookup(projectAddress)}
                shippingStatus={shippingStatus}
                shippingHint={shippingHint}
                customerId={customerId}
                selectedCustomer={selectedCustomer}
                contactId={contactId}
                onContactPickerChange={handleContactPickerChange}
                clearContactLinkIfCustomized={clearContactLinkIfCustomized}
                contactName={contactName}
                onContactNameChange={setContactName}
                contactEmail={contactEmail}
                onContactEmailChange={setContactEmail}
                contactPhone={contactPhone}
                onContactPhoneChange={setContactPhone}
                contactTitle={contactTitle}
                onContactTitleChange={setContactTitle}
              />

              <QuotePricingFields
                priceLists={priceLists}
                priceListId={priceListId}
                onPriceListChange={handlePriceListChange}
                taxRate={taxRate}
                onTaxRateChange={setTaxRate}
                customerPo={customerPo}
                onCustomerPoChange={setCustomerPo}
              />
            </div>
          </SectionCard>

          <QuoteNotesTermsSection
            internalNotes={internalNotes}
            onInternalNotesChange={setInternalNotes}
            customerNotes={customerNotes}
            onCustomerNotesChange={setCustomerNotes}
            deliveryPricing={
              <QuoteDeliveryPricingPanel
                shippingHint={shippingHint}
                deliveryLoadsInput={deliveryLoadsInput}
                onDeliveryLoadsInputChange={setDeliveryLoadsInput}
                autoDeliveryLoads={autoDeliveryLoads}
                maxLoadLbsInput={maxLoadLbsInput}
                onMaxLoadLbsInputChange={handleMaxLoadLbsInputChange}
                pricePerLoadInput={pricePerLoadInput}
                onPricePerLoadInputChange={setPricePerLoadInput}
                deliveryTotal={deliveryTotal}
                hasDeliveryLine={lineItems.some(
                  (entry) => entry.id === deliveryLineId,
                )}
                onApplyDeliveryLine={applyDeliveryLineItem}
              />
            }
            fob={fob}
            onFobChange={setFob}
            termsAndConditions={termsAndConditions}
            onTermsAndConditionsChange={setTermsAndConditions}
            paymentTermOptions={paymentTermOptions}
            leadTime={leadTime}
            onLeadTimeChange={setLeadTime}
            deliveryNotes={deliveryNotes}
            onDeliveryNotesChange={setDeliveryNotes}
          />
        </div>
      </div>

      {customImport ? (
        <CustomStructureImportDialog
          customImport={customImport}
          setCustomImport={setCustomImport}
          customStructureNumbersInUse={customStructureNumbersInUse}
          onImport={importCustomStructureCandidates}
        />
      ) : null}

      {addModalType ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div
            className={`w-full rounded-xl border border-slate-200 bg-white shadow-lg ${
              addModalType === "CUSTOM_STRUCTURE"
                ? "flex max-h-[90vh] max-w-5xl flex-col"
                : addModalType === "STOCK_PRODUCT"
                  ? "flex max-h-[90vh] max-w-3xl flex-col"
                  : "max-w-lg p-4"
            }`}
          >
            {addModalType === "CUSTOM_STRUCTURE" ? (
              <AddCustomStructurePanel
                jobId={jobId}
                customStructureRows={customStructureRows}
                setCustomStructureRows={setCustomStructureRows}
                onOpenImport={openCustomStructureImport}
                customPasteOpen={customPasteOpen}
                setCustomPasteOpen={setCustomPasteOpen}
                customPasteText={customPasteText}
                setCustomPasteText={setCustomPasteText}
                customPasteError={customPasteError}
                setCustomPasteError={setCustomPasteError}
                onPaste={handleCustomStructurePaste}
                updateCustomStructureRow={updateCustomStructureRow}
                updateCustomStructureRowCostItems={
                  updateCustomStructureRowCostItems
                }
                duplicateCustomStructureRow={duplicateCustomStructureRow}
                onCancel={closeAddModal}
                onAdd={handleAddCustomStructure}
              />
            ) : null}

            {addModalType === "STOCK_PRODUCT" ? (
              <AddStockProductPanel
                taxonomy={taxonomy}
                priceListId={priceListId || null}
                onAdd={handleAddStockProducts}
                onCancel={closeAddModal}
              />
            ) : null}

            {addModalType === "CONFIGURABLE_STRUCTURE" ? (
              <AddConfigurableStructurePanel
                selectedConfigurableProduct={selectedConfigurableProduct}
                searchConfigurableProducts={searchConfigurableProducts}
                onProductChange={handleConfigurableProductChange}
                structureNumber={structureNumber}
                onStructureNumberChange={setStructureNumber}
                structureQty={structureQty}
                onStructureQtyChange={setStructureQty}
                structureDescription={structureDescription}
                onStructureDescriptionChange={setStructureDescription}
                structureUnitPrice={structureUnitPrice}
                onStructureUnitPriceChange={setStructureUnitPrice}
                structureWeight={structureWeight}
                onStructureWeightChange={setStructureWeight}
                structureYards={structureYards}
                onStructureYardsChange={setStructureYards}
                onCancel={closeAddModal}
                onAdd={handleAddConfigurableStructure}
              />
            ) : null}

            {addModalType === "SERVICE" ? (
              <AddServicePanel
                serviceOptions={serviceOptionsState}
                selectedServiceItem={selectedServiceItem}
                onServiceOptionChange={handleServiceOptionChange}
                serviceDescription={serviceDescription}
                onServiceDescriptionChange={setServiceDescription}
                serviceQty={serviceQty}
                onServiceQtyChange={setServiceQty}
                serviceUnit={serviceUnit}
                onServiceUnitChange={setServiceUnit}
                serviceUnitPrice={serviceUnitPrice}
                onServiceUnitPriceChange={setServiceUnitPrice}
                serviceTaxable={serviceTaxable}
                onServiceTaxableChange={setServiceTaxable}
                onCancel={closeAddModal}
                onAdd={handleAddService}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {editingCustomStructureDraft ? (
        <EditCustomStructureDialog
          draft={editingCustomStructureDraft}
          onFieldChange={updateEditingCustomStructureDraft}
          onCostItemsChange={updateEditingCustomStructureCostItems}
          onCancel={closeEditCustomStructureLine}
          onSave={handleSaveEditedCustomStructure}
        />
      ) : null}

      {ringBuilderModalOpen ? (
        <RingBuilderModal
          open={ringBuilderModalOpen}
          onClose={() => setRingBuilderModalOpen(false)}
          ringBuilderConfig={ringBuilderConfig}
          ringSlabProducts={ringSlabProductsState}
          priceListId={priceListId || null}
          lineCount={lineItems.length}
          onAddItems={handleAddRingBuilderItems}
          onError={(message) => showFlash("error", message)}
        />
      ) : null}

      {pipeModalType ? (
        <PipeModal
          open={Boolean(pipeModalType)}
          onClose={() => setPipeModalType(null)}
          pipeType={pipeModalType}
          pipeProducts={pipeProductsState}
          lineCount={lineItems.length}
          onAddItems={handleAddPipeItems}
          onAddUnitPrices={handleAddPipeUnitPrices}
          onError={(message) => showFlash("error", message)}
        />
      ) : null}
    </form>
    </>
  );
}
