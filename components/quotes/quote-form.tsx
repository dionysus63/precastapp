"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { createQuote, type CreateQuoteInput } from "@/app/quotes/actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";
import {
  type EditableQuoteLineItem,
  type QuoteFormProps,
  type QuoteLineItemType,
  type QuoteStatus,
  type QuoteType,
  DEFAULT_QUOTE_TAX_RATE,
  calculateQuoteTotals,
  formatQuoteCurrency,
  formatQuoteWeight,
  formatQuoteYards,
  getLineItemTotal,
  parseQuoteNumber,
  quoteEstimatorFormOptions,
  quoteInputClassName,
  quoteLineItemTypeLabels,
  quoteLineItemTypeOptions,
  quoteReadOnlyClassName,
  quoteStatusFormOptions,
  quoteTermsFormOptions,
  quoteTypeFormOptions,
  quoteWorkflowSteps,
} from "@/components/quotes/quote-utils";

const quoteTableInputClassName =
  "w-full min-w-[4rem] rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm";

type AddLineModalType = Exclude<QuoteLineItemType, "MISC">;

type FlashMessage = {
  type: "success" | "info" | "error";
  text: string;
};

function createLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function renumberLineItems(items: EditableQuoteLineItem[]) {
  return items.map((item, index) => ({
    ...item,
    lineNumber: index + 1,
  }));
}

export function QuoteForm({
  customers,
  jobs,
  stockProducts,
  configurableProducts,
  serviceOptions,
  priceLists = [],
  quoteDefaults,
}: QuoteFormProps) {
  const estimatorOptions =
    quoteDefaults?.estimators?.length
      ? quoteDefaults.estimators
      : quoteEstimatorFormOptions;
  const paymentTermOptions =
    quoteDefaults?.paymentTerms?.length
      ? quoteDefaults.paymentTerms
      : quoteTermsFormOptions;
  const initialTaxRate = quoteDefaults?.defaultTaxRate ?? DEFAULT_QUOTE_TAX_RATE;
  const initialEstimator = estimatorOptions[0] ?? "Nick";
  const initialLeadTime = quoteDefaults?.defaultLeadTime ?? "";
  const initialExpirationDate = quoteDefaults?.defaultExpirationDate ?? "";
  const initialTerms = paymentTermOptions[0] ?? "";

  const [isPending, startTransition] = useTransition();
  const [lineItems, setLineItems] = useState<EditableQuoteLineItem[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [jobId, setJobId] = useState("");
  const [jobNumber, setJobNumber] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectAddress, setProjectAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [status, setStatus] = useState<QuoteStatus>("DRAFT");
  const [quoteType, setQuoteType] = useState<QuoteType>("MIXED");
  const [estimator, setEstimator] = useState(initialEstimator);
  const [bidDueDate, setBidDueDate] = useState("");
  const [quoteDate, setQuoteDate] = useState("");
  const [expirationDate, setExpirationDate] = useState(initialExpirationDate);
  const [customerPo, setCustomerPo] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [leadTime, setLeadTime] = useState(initialLeadTime);
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [termsAndConditions, setTermsAndConditions] = useState(initialTerms);
  const [priceListId, setPriceListId] = useState(
    () => priceLists.find((list) => list.isDefault)?.id ?? "",
  );
  const [taxRate, setTaxRate] = useState(String(initialTaxRate));
  const [flashMessage, setFlashMessage] = useState<FlashMessage | null>(null);
  const [activeLineType, setActiveLineType] =
    useState<QuoteLineItemType>("STOCK_PRODUCT");
  const [addModalType, setAddModalType] = useState<AddLineModalType | null>(
    null,
  );

  const [selectedStockId, setSelectedStockId] = useState(
    stockProducts[0]?.id ?? "",
  );
  const [selectedConfigurableId, setSelectedConfigurableId] = useState(
    configurableProducts[0]?.id ?? "",
  );
  const [structureNumber, setStructureNumber] = useState("MH-1");
  const [structureDescription, setStructureDescription] = useState("");
  const [structureQty, setStructureQty] = useState("1");
  const [structureUnitPrice, setStructureUnitPrice] = useState("");
  const [structureWeight, setStructureWeight] = useState("");
  const [structureYards, setStructureYards] = useState("");

  const [customStructureNumber, setCustomStructureNumber] = useState("CS-1");
  const [customDescription, setCustomDescription] = useState("");
  const [customQty, setCustomQty] = useState("1");
  const [customUnitPrice, setCustomUnitPrice] = useState("");
  const [customWeight, setCustomWeight] = useState("");
  const [customYards, setCustomYards] = useState("");

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

    if (taxRatePercent < 0) {
      return "Tax rate cannot be negative.";
    }

    for (const line of lineItems) {
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
      jobNumber: jobNumber || null,
      projectName: projectName.trim(),
      projectAddress: projectAddress.trim() || null,
      contactName: contactName.trim() || null,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
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
        total: getLineItemTotal(line),
        statusNote: line.statusNote ?? null,
        notes: null,
      })),
      totals,
    };
  }

  function handleSaveDraft() {
    const validationError = validateQuote();
    if (validationError) {
      showFlash("error", validationError);
      return;
    }

    startTransition(async () => {
      const result = await createQuote(buildCreateQuoteInput());
      if (result?.error) {
        showFlash("error", result.error);
      }
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleSaveDraft();
  }

  function handleCustomerChange(value: string) {
    setCustomerId(value);

    if (!value) {
      return;
    }

    const customer = customers.find((entry) => entry.id === value);
    if (!customer) {
      return;
    }

    setCustomerName(customer.name);
    setContactName(customer.contactName);
    setContactEmail(customer.contactEmail);
    setContactPhone(customer.contactPhone);
  }

  function handleJobChange(value: string) {
    setJobId(value);

    if (!value) {
      setJobNumber("");
      return;
    }

    const job = jobs.find((entry) => entry.id === value);
    if (!job) {
      return;
    }

    setJobNumber(job.jobNumber);
    setProjectName(job.projectName);
    setProjectAddress(job.projectAddress);

    if (job.customerName) {
      setCustomerName(job.customerName);
    }

    if (job.customerId) {
      setCustomerId(job.customerId);
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

  function openAddModal(type: AddLineModalType) {
    setActiveLineType(type);
    setAddModalType(type);

    if (type === "CONFIGURABLE_STRUCTURE") {
      const product =
        configurableProducts.find(
          (entry) => entry.id === selectedConfigurableId,
        ) ?? configurableProducts[0];
      setStructureDescription(
        product ? `${product.description} ${structureNumber}`.trim() : "",
      );
      setStructureUnitPrice(product ? String(product.unitPrice) : "");
      setStructureWeight(product ? String(product.weightLb) : "");
      setStructureYards(product ? String(product.yards) : "");
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

  function addLineItem(line: EditableQuoteLineItem) {
    setLineItems((current) =>
      renumberLineItems([...current, { ...line, lineNumber: current.length + 1 }]),
    );
    closeAddModal();
  }

  function handleAddStockProduct() {
    const product = stockProducts.find((entry) => entry.id === selectedStockId);
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
    const product = configurableProducts.find(
      (entry) => entry.id === selectedConfigurableId,
    );
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

  function handleAddCustomStructure() {
    addLineItem({
      id: createLineId(),
      lineNumber: lineItems.length + 1,
      type: "CUSTOM_STRUCTURE",
      typeLabel: quoteLineItemTypeLabels.CUSTOM_STRUCTURE,
      item: customStructureNumber || "Custom Structure",
      description: customDescription,
      qty: customQty || "1",
      unit: "EA",
      unitPrice: customUnitPrice || "0",
      weight: customWeight,
      yards: customYards,
      taxable: true,
    });
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

  function updateLineItem(
    id: string,
    field: keyof EditableQuoteLineItem,
    value: string | boolean,
  ) {
    setLineItems((current) =>
      current.map((line) =>
        line.id === id ? { ...line, [field]: value } : line,
      ),
    );
  }

  function removeLineItem(id: string) {
    setLineItems((current) => renumberLineItems(current.filter((line) => line.id !== id)));
  }

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

  function handleConfigurableProductChange(productId: string) {
    setSelectedConfigurableId(productId);
    const product = configurableProducts.find((entry) => entry.id === productId);
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <SectionCard title="Quote Information">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Quote Number
                </label>
                <input
                  readOnly
                  value="Auto assigned after saving"
                  className={quoteReadOnlyClassName}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700">
                  Revision
                </label>
                <input readOnly value="R0" className={quoteReadOnlyClassName} />
              </div>
              <div>
                <label
                  htmlFor="status"
                  className="block text-xs font-medium text-slate-700"
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
                  className={quoteInputClassName}
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
                  className="block text-xs font-medium text-slate-700"
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
                  className={quoteInputClassName}
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
                  className="block text-xs font-medium text-slate-700"
                >
                  Estimator
                </label>
                <select
                  id="estimator"
                  name="estimator"
                  value={estimator}
                  onChange={(event) => setEstimator(event.target.value)}
                  className={quoteInputClassName}
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
                  className="block text-xs font-medium text-slate-700"
                >
                  Bid Due Date
                </label>
                <input
                  id="bidDueDate"
                  name="bidDueDate"
                  type="date"
                  value={bidDueDate}
                  onChange={(event) => setBidDueDate(event.target.value)}
                  className={quoteInputClassName}
                />
              </div>
              <div>
                <label
                  htmlFor="quoteDate"
                  className="block text-xs font-medium text-slate-700"
                >
                  Quote Date
                </label>
                <input
                  id="quoteDate"
                  name="quoteDate"
                  type="date"
                  value={quoteDate}
                  onChange={(event) => setQuoteDate(event.target.value)}
                  className={quoteInputClassName}
                />
              </div>
              <div>
                <label
                  htmlFor="expirationDate"
                  className="block text-xs font-medium text-slate-700"
                >
                  Expiration Date
                </label>
                <input
                  id="expirationDate"
                  name="expirationDate"
                  type="date"
                  value={expirationDate}
                  onChange={(event) => setExpirationDate(event.target.value)}
                  className={quoteInputClassName}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Customer and Job">
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="customer"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Customer
                  </label>
                  {customers.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">
                      No customers in the database yet. Enter customer details
                      below.
                    </p>
                  ) : (
                    <select
                      id="customer"
                      name="customer"
                      value={customerId}
                      onChange={(event) =>
                        handleCustomerChange(event.target.value)
                      }
                      className={quoteInputClassName}
                    >
                      <option value="">Select customer</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="job"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Job
                  </label>
                  {jobs.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500">
                      No jobs in the database yet. Enter project details below.
                    </p>
                  ) : (
                    <select
                      id="job"
                      name="job"
                      value={jobId}
                      onChange={(event) => handleJobChange(event.target.value)}
                      className={quoteInputClassName}
                    >
                      <option value="">Select job</option>
                      {jobs.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="customerName"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Customer Name
                  </label>
                  <input
                    id="customerName"
                    name="customerName"
                    type="text"
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="ABC Construction"
                    className={quoteInputClassName}
                  />
                </div>
                <div>
                  <label
                    htmlFor="jobNumber"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Job Number
                  </label>
                  <input
                    id="jobNumber"
                    name="jobNumber"
                    type="text"
                    value={jobNumber}
                    onChange={(event) => setJobNumber(event.target.value)}
                    placeholder="26-001"
                    className={quoteInputClassName}
                  />
                </div>
              </div>

              <div>
                <Link
                  href="/jobs/new"
                  className="inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Create New Job
                </Link>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="projectName"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Project Name
                  </label>
                  <input
                    id="projectName"
                    name="projectName"
                    type="text"
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    placeholder="Main Street Drainage"
                    className={quoteInputClassName}
                  />
                </div>
                <div>
                  <label
                    htmlFor="projectAddress"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Project Address
                  </label>
                  <input
                    id="projectAddress"
                    name="projectAddress"
                    type="text"
                    value={projectAddress}
                    onChange={(event) => setProjectAddress(event.target.value)}
                    placeholder="120 Main Street, Riverhead, NY"
                    className={quoteInputClassName}
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="contactName"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Contact Name
                  </label>
                  <input
                    id="contactName"
                    name="contactName"
                    type="text"
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                    className={quoteInputClassName}
                  />
                </div>
                <div>
                  <label
                    htmlFor="contactEmail"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Contact Email
                  </label>
                  <input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    value={contactEmail}
                    onChange={(event) => setContactEmail(event.target.value)}
                    className={quoteInputClassName}
                  />
                </div>
                <div>
                  <label
                    htmlFor="contactPhone"
                    className="block text-xs font-medium text-slate-700"
                  >
                    Contact Phone
                  </label>
                  <input
                    id="contactPhone"
                    name="contactPhone"
                    type="tel"
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                    className={quoteInputClassName}
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Price List">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <label
                  htmlFor="priceList"
                  className="block text-xs font-medium text-slate-700"
                >
                  Price List
                </label>
                <select
                  id="priceList"
                  name="priceList"
                  value={priceListId}
                  onChange={(event) => setPriceListId(event.target.value)}
                  className={quoteInputClassName}
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
                  htmlFor="taxable"
                  className="block text-xs font-medium text-slate-700"
                >
                  Taxable
                </label>
                <select
                  id="taxable"
                  name="taxable"
                  defaultValue="yes"
                  className={quoteInputClassName}
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="taxRate"
                  className="block text-xs font-medium text-slate-700"
                >
                  Tax Rate
                </label>
                <input
                  id="taxRate"
                  name="taxRate"
                  type="text"
                  value={taxRate}
                  onChange={(event) => setTaxRate(event.target.value)}
                  className={quoteInputClassName}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <label
                  htmlFor="customerPo"
                  className="block text-xs font-medium text-slate-700"
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
                  className={quoteInputClassName}
                />
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
              </div>

              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                {activeHint}
              </p>

              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <table className="min-w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-2.5 font-semibold">Line #</th>
                      <th className="px-3 py-2.5 font-semibold">Type</th>
                      <th className="px-3 py-2.5 font-semibold">
                        Item / Product
                      </th>
                      <th className="px-3 py-2.5 font-semibold">
                        Description
                      </th>
                      <th className="px-3 py-2.5 font-semibold">Qty</th>
                      <th className="px-3 py-2.5 font-semibold">Unit</th>
                      <th className="px-3 py-2.5 font-semibold">
                        Unit Price
                      </th>
                      <th className="px-3 py-2.5 font-semibold">Weight</th>
                      <th className="px-3 py-2.5 font-semibold">Yards</th>
                      <th className="px-3 py-2.5 font-semibold">Taxable</th>
                      <th className="px-3 py-2.5 font-semibold">Total</th>
                      <th className="px-3 py-2.5 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lineItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={12}
                          className="px-3 py-6 text-center text-slate-500"
                        >
                          No line items yet. Use the buttons above to add items.
                        </td>
                      </tr>
                    ) : (
                      lineItems.map((line) => (
                        <tr key={line.id} className="hover:bg-slate-50/60">
                          <td className="px-3 py-2.5 text-slate-700">
                            {line.lineNumber}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge
                              label={line.typeLabel}
                              variant="neutral"
                            />
                          </td>
                          <td className="px-3 py-2.5 font-medium text-slate-900">
                            {line.item}
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={line.description}
                              onChange={(event) =>
                                updateLineItem(
                                  line.id,
                                  "description",
                                  event.target.value,
                                )
                              }
                              className={quoteTableInputClassName}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={line.qty}
                              onChange={(event) =>
                                updateLineItem(line.id, "qty", event.target.value)
                              }
                              className={`${quoteTableInputClassName} min-w-[3rem]`}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={line.unit}
                              onChange={(event) =>
                                updateLineItem(line.id, "unit", event.target.value)
                              }
                              className={`${quoteTableInputClassName} min-w-[3rem]`}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={line.unitPrice}
                              onChange={(event) =>
                                updateLineItem(
                                  line.id,
                                  "unitPrice",
                                  event.target.value,
                                )
                              }
                              className={quoteTableInputClassName}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={line.weight}
                              onChange={(event) =>
                                updateLineItem(
                                  line.id,
                                  "weight",
                                  event.target.value,
                                )
                              }
                              placeholder="—"
                              className={quoteTableInputClassName}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <input
                              type="text"
                              value={line.yards}
                              onChange={(event) =>
                                updateLineItem(line.id, "yards", event.target.value)
                              }
                              placeholder="—"
                              className={quoteTableInputClassName}
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <select
                              value={line.taxable ? "yes" : "no"}
                              onChange={(event) =>
                                updateLineItem(
                                  line.id,
                                  "taxable",
                                  event.target.value === "yes",
                                )
                              }
                              className={quoteTableInputClassName}
                            >
                              <option value="yes">Yes</option>
                              <option value="no">No</option>
                            </select>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-slate-900">
                            {formatQuoteCurrency(getLineItemTotal(line))}
                          </td>
                          <td className="px-3 py-2.5">
                            <button
                              type="button"
                              onClick={() => removeLineItem(line.id)}
                              className="inline-flex rounded-md border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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

          <div className="flex flex-wrap justify-end gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-3 shadow-sm">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isPending}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={() =>
                showFlash("info", "PDF preview will be added later.")
              }
              disabled={isPending}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save and Preview PDF
            </button>
            <Link
              href="/quotes"
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </Link>
          </div>
        </div>

        <aside className="space-y-4">
          <SectionCard title="Quote Summary">
            <dl className="space-y-3 text-xs">
              {[
                ["Subtotal", formatQuoteCurrency(totals.subtotal)],
                ["Discount", formatQuoteCurrency(totals.discount)],
                ["Delivery", formatQuoteCurrency(totals.delivery)],
                ["Taxable Amount", formatQuoteCurrency(totals.taxableAmount)],
                ["Sales Tax", formatQuoteCurrency(totals.salesTax)],
                ["Total", formatQuoteCurrency(totals.total)],
                ["Total Weight", formatQuoteWeight(totals.totalWeight)],
                ["Total Yards", formatQuoteYards(totals.totalYards)],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0"
                >
                  <dt className="text-slate-500">{label}</dt>
                  <dd
                    className={`font-medium ${
                      label === "Total" ? "text-slate-900" : "text-slate-700"
                    }`}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </SectionCard>

          <SectionCard title="Workflow">
            <ul className="space-y-2">
              {quoteWorkflowSteps.map((step) => (
                <li
                  key={step.id}
                  className="flex items-center gap-2 text-xs text-slate-700"
                >
                  <span
                    className={`inline-flex h-4 w-4 shrink-0 rounded-full border ${
                      step.complete
                        ? "border-emerald-300 bg-emerald-500"
                        : "border-slate-200 bg-white"
                    }`}
                    aria-hidden="true"
                  />
                  {step.label}
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Quick Actions">
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isPending}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Saving..." : "Save Draft"}
              </button>
              <button
                type="button"
                onClick={() =>
                  showFlash("info", "PDF preview will be added later.")
                }
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Preview PDF
              </button>
              <button
                type="button"
                onClick={() =>
                  showFlash("info", "Sending quotes will be added later.")
                }
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Send Quote
              </button>
              <button
                type="button"
                disabled
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-400"
              >
                Duplicate
              </button>
              <Link
                href="/quotes"
                className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Link>
            </div>
          </SectionCard>
        </aside>
      </div>

      {addModalType ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            {addModalType === "STOCK_PRODUCT" ? (
              <>
                <h3 className="text-sm font-semibold text-slate-900">
                  Add Stock Product
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Select a stock product from the catalog.
                </p>
                <div className="mt-4 space-y-3">
                  {stockProducts.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No active stock products found. Add products in the
                      Products module first.
                    </p>
                  ) : (
                    <div>
                      <label className="block text-xs font-medium text-slate-700">
                        Product
                      </label>
                      <select
                        value={selectedStockId}
                        onChange={(event) =>
                          setSelectedStockId(event.target.value)
                        }
                        className={quoteInputClassName}
                      >
                        {stockProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.code} — {product.description} —{" "}
                            {formatQuoteCurrency(product.unitPrice)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
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
                    disabled={stockProducts.length === 0}
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
                  {configurableProducts.length === 0 ? (
                    <p className="sm:col-span-2 text-xs text-slate-500">
                      No active configurable products found. Add products in
                      the Products module first.
                    </p>
                  ) : (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700">
                        Product Template
                      </label>
                      <select
                        value={selectedConfigurableId}
                        onChange={(event) =>
                          handleConfigurableProductChange(event.target.value)
                        }
                        className={quoteInputClassName}
                      >
                        {configurableProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.code} — {product.description}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Structure Number
                    </label>
                    <input
                      type="text"
                      value={structureNumber}
                      onChange={(event) => {
                        setStructureNumber(event.target.value);
                        const product = configurableProducts.find(
                          (entry) => entry.id === selectedConfigurableId,
                        );
                        if (product) {
                          setStructureDescription(
                            `${product.description} ${event.target.value}`.trim(),
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
                    disabled={configurableProducts.length === 0}
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
                  Job-specific custom structure line item.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Structure Number
                    </label>
                    <input
                      type="text"
                      value={customStructureNumber}
                      onChange={(event) =>
                        setCustomStructureNumber(event.target.value)
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
                      value={customQty}
                      onChange={(event) => setCustomQty(event.target.value)}
                      className={quoteInputClassName}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-700">
                      Description
                    </label>
                    <input
                      type="text"
                      value={customDescription}
                      onChange={(event) => setCustomDescription(event.target.value)}
                      placeholder="Custom 8'x12' valve vault with aluminum hatch"
                      className={quoteInputClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Unit Price
                    </label>
                    <input
                      type="text"
                      value={customUnitPrice}
                      onChange={(event) => setCustomUnitPrice(event.target.value)}
                      placeholder="32500"
                      className={quoteInputClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Weight (lb)
                    </label>
                    <input
                      type="text"
                      value={customWeight}
                      onChange={(event) => setCustomWeight(event.target.value)}
                      placeholder="28500"
                      className={quoteInputClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Yards
                    </label>
                    <input
                      type="text"
                      value={customYards}
                      onChange={(event) => setCustomYards(event.target.value)}
                      placeholder="9.2"
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
    </form>
  );
}
