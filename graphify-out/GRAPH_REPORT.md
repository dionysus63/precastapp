# Graph Report - precastapp  (2026-06-20)

## Corpus Check
- 167 files · ~69,926 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1006 nodes · 2275 edges · 41 communities (38 shown, 3 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 31 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9a25c565`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]

## God Nodes (most connected - your core abstractions)
1. `withDatabaseRetry()` - 109 edges
2. `SectionCard()` - 44 edges
3. `DashboardShell()` - 40 edges
4. `getAppSettings()` - 39 edges
5. `StatusBadge()` - 21 edges
6. `compilerOptions` - 16 edges
7. `prisma` - 15 edges
8. `launchWindowsFolder()` - 15 edges
9. `mapQuoteToDetailView()` - 14 edges
10. `generateSubmittalPackageForQuote()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `EditCustomerPage()` --calls--> `withDatabaseRetry()`  [INFERRED]
  app/customers/[id]/edit/page.tsx → lib/prisma.ts
- `InventoryProductionPage()` --calls--> `withDatabaseRetry()`  [INFERRED]
  app/inventory/production/page.tsx → lib/prisma.ts
- `ProductionPage()` --calls--> `withDatabaseRetry()`  [INFERRED]
  app/production/page.tsx → lib/prisma.ts
- `PriceListDetailPage()` --calls--> `withDatabaseRetry()`  [INFERRED]
  app/settings/price-lists/[id]/page.tsx → lib/prisma.ts
- `CustomerDetailPage()` --calls--> `withDatabaseRetry()`  [INFERRED]
  app/customers/[id]/page.tsx → lib/prisma.ts

## Import Cycles
- None detected.

## Communities (41 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (48): createCustomer(), CUSTOMER_STATUSES, CUSTOMER_TYPES, deleteCustomer(), parseCustomerFormData(), updateCustomer(), CustomerDetailContent(), CustomerDetailContentProps (+40 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (46): EditProductPage(), EditProductPageProps, ProductDetailPage(), ProductDetailPageProps, categoryVariant(), formatCurrency(), formatDecimal(), formatYesNo() (+38 more)

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (16): deriveOriginalQuoteNumber(), formatCurrency(), formatQuoteDate(), formatQuoteDateLong(), formatWeight(), formatYards(), mapQuoteToDetailView(), mapQuoteToRow() (+8 more)

### Community 3 - "Community 3"
Cohesion: 0.07
Nodes (51): EditJobPage(), EditJobPageProps, allocateJobNumber(), createJob(), formatJobNumber(), JOB_STATUSES, JobStatus, openJobFolder() (+43 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (34): dependencies, next, pdf-lib, pg, prisma, @prisma/adapter-pg, @prisma/client, puppeteer (+26 more)

### Community 5 - "Community 5"
Cohesion: 0.07
Nodes (28): Bug Report — precastapp, C1. Command injection risk in folder-opening shell call, C2. Job-number race condition is not actually fixed by the "fix_job_sequence" migration, Critical, H1. Bulk product import silently drops duplicate product codes within a batch, and crashes ugly on DB-level duplicates, H2. No authentication or authorization anywhere in the app, H3. `createJob` leaves an orphaned, unrecoverable DB row if folder creation fails, High (+20 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (54): DeliveryTicketDetailView, generateDeliveryTicketPdf(), GenerateDeliveryTicketPdfResult, AppSettingsView, CompanyProfile, DEFAULT_DRIVERS, DEFAULT_ESTIMATORS, DEFAULT_PAYMENT_TERMS (+46 more)

### Community 7 - "Community 7"
Cohesion: 0.06
Nodes (41): AddLineModalType, FlashMessage, QuoteForm(), calculateQuoteTotals(), EditableQuoteLineItem, formatQuoteCurrency(), formatQuoteWeight(), formatQuoteYards() (+33 more)

### Community 8 - "Community 8"
Cohesion: 0.24
Nodes (7): formatCurrency(), Home(), accentStyles, SummaryCard(), SummaryCardProps, QuoteStatus, quoteStatusLabels

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (19): Prisma / Database Rules, Project context, Security posture: internal, trusted-network tool only, This is NOT the Next.js you know, App (Next.js), Browse data, Daily workflow, Git / GitHub (optional) (+11 more)

### Community 10 - "Community 10"
Cohesion: 0.08
Nodes (42): InventorySubmittalsCell(), InventorySubmittalsCellProps, InventoryPage(), getStockSubmittalsRoot(), assertPathUnderStockSubmittalsRoot(), assertProductExists(), deleteProductDocument(), getProductDocumentForOpen() (+34 more)

### Community 11 - "Community 11"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (60): ExplorerOpenResult, getJobFilesForBrowser(), listJobsMissingFolders(), listRecentFiles(), openJobFile(), openJobFolderCategory(), revalidateFilesPaths(), syncAllFiles() (+52 more)

### Community 13 - "Community 13"
Cohesion: 0.07
Nodes (56): BillingSettingsPage(), BillingSettingsPageProps, saveBillingSettings(), CompanySettingsPageProps, removeCompanyLogo(), saveCompanySettings(), uploadCompanyLogo(), SectionCard() (+48 more)

### Community 14 - "Community 14"
Cohesion: 0.22
Nodes (11): StructureForm(), CastingRow, createCastingRow(), createOpeningRow(), OpeningRow, placeholderCastings, placeholderOpenings, StructureStatus (+3 more)

### Community 15 - "Community 15"
Cohesion: 0.15
Nodes (15): createQuote(), CreateQuoteInput, CreateQuoteLineItemInput, generateQuoteNumber(), parseOptionalDate(), QUOTE_LINE_TYPES, QUOTE_STATUS_VALUES, QUOTE_STATUSES (+7 more)

### Community 16 - "Community 16"
Cohesion: 0.14
Nodes (13): QuotesPage(), quoteDueDateFilterOptions, quoteEstimatorFilterOptions, QuoteRow, quoteStatusFilterOptions, quoteSummaryCards, quoteTypeFilterOptions, quoteYearFilterOptions (+5 more)

### Community 17 - "Community 17"
Cohesion: 0.29
Nodes (6): defaultQuoteExpirationDate(), mapProductToQuoteFormOption(), NewQuotePage(), listPriceListsForForm(), mockServiceOptions, QuoteFormServiceOption

### Community 18 - "Community 18"
Cohesion: 0.15
Nodes (24): geistMono, geistSans, generateMetadata(), CompanySettingsPage(), companyLogoApiUrl(), convertPdfToPng(), getCompanyLogoPath(), getCompanyLogoUpdatedAt() (+16 more)

### Community 19 - "Community 19"
Cohesion: 0.05
Nodes (54): listDeliveryTicketsForPage(), updateDeliveryTicketStatus(), DeliveryTicketDetailContent(), DeliveryTicketDetailContentProps, deliveryDateFilterOptions, deliveryDriverFilterOptions, deliveryJobFilterOptions, DeliveryTicketActivityItem (+46 more)

### Community 20 - "Community 20"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 26 - "Community 26"
Cohesion: 0.07
Nodes (31): buildLineCreates(), createDeliveryTicket(), DeliveryTicketLineInput, parseDate(), SaveDeliveryTicketInput, STATUS_FLOW, ticketData(), updateDeliveryTicket() (+23 more)

### Community 27 - "Community 27"
Cohesion: 0.13
Nodes (20): DEFAULT_APP_SETTINGS_DATA, decodeApiKey(), PrismaDevPayload, resolveDatabaseUrl(), resolvePrismaDevPayload(), resolveShadowDatabaseUrl(), clientHasAppSettingsFields(), createPool() (+12 more)

### Community 28 - "Community 28"
Cohesion: 0.20
Nodes (17): EditDeliveryTicketPage(), EditDeliveryTicketPageProps, withDatabaseRetry(), NewDeliveryTicketPage(), approveStructureForProduction(), confirmDeliveryDayReconciliation(), convertTicketToInvoice(), deliverTicket() (+9 more)

### Community 29 - "Community 29"
Cohesion: 0.21
Nodes (13): buildJobCustomerFilterOptions(), buildJobYearFilterOptions(), JobRow, jobStatusFilterOptions, jobStatusLabels, JobsList(), JobsListProps, JobsPage() (+5 more)

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (7): InventoryAdjustPage(), DashboardShell(), DashboardShellProps, Header(), HeaderProps, AdjustForm(), InventoryProductionPage()

### Community 31 - "Community 31"
Cohesion: 0.17
Nodes (9): QuoteDetailPage(), QuoteDetailPageProps, updateQuoteStatus(), GenerateSubmittalPackageButton(), LinkStructuresButton(), MarkWonButton(), generateSubmittalPackage(), QuoteDetailContent() (+1 more)

### Community 32 - "Community 32"
Cohesion: 0.26
Nodes (9): InvoiceDetailPage(), InvoiceDetailPageProps, InvoiceDetailContent(), InvoiceDetailContentProps, formatDate(), formatMoney(), InvoiceDetailView, mapDbInvoiceToDetailView() (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.24
Nodes (7): BadgeVariant, StatusBadge(), StatusBadgeProps, variantStyles, InvoicesPage(), ProductInventoryPage(), ProductInventoryPageProps

### Community 34 - "Community 34"
Cohesion: 0.27
Nodes (8): ReconcileDay(), ReconcileDayProps, ReconcileTicket, TicketVerificationForm(), listTicketsForReconciliation(), updateTicketPaperVerification(), DeliveryTicketsReconcilePage(), PageProps

### Community 35 - "Community 35"
Cohesion: 0.36
Nodes (8): approveJobStructureForProduction(), linkJobStructuresFromQuote(), mapLineTypeToStructureType(), markJobStructureMade(), markJobStructureShipped(), setJobStructureStatus(), startJobStructureProduction(), STRUCTURE_LINE_TYPES

### Community 36 - "Community 36"
Cohesion: 0.36
Nodes (5): ProductionPage(), ApproveStructuresPanel(), ProductionQueue(), ProductionQueueItem, ProductionQueueProps

### Community 37 - "Community 37"
Cohesion: 0.33
Nodes (5): Dates, Delivery eligibility, Job Structure Production Workflow, Quote → JobStructure linking, Server actions

### Community 38 - "Community 38"
Cohesion: 0.40
Nodes (5): createRow(), ProductionEntryForm(), ProductionEntryFormProps, ProductionLineRow, ProductOption

### Community 39 - "Community 39"
Cohesion: 0.60
Nodes (5): defaultInvoiceDueDate(), convertDeliveryTicketToInvoice(), mapDeliveryLineTypeToInvoiceLineType(), nextInvoiceNumber(), resolveUnitPrice()

### Community 40 - "Community 40"
Cohesion: 0.50
Nodes (3): NavItem, navItems, Sidebar()

## Knowledge Gaps
- **271 isolated node(s):** `EditCustomerPageProps`, `CustomerDetailPageProps`, `CUSTOMER_TYPES`, `CUSTOMER_STATUSES`, `EditDeliveryTicketPageProps` (+266 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `withDatabaseRetry()` connect `Community 28` to `Community 0`, `Community 2`, `Community 3`, `Community 6`, `Community 8`, `Community 10`, `Community 12`, `Community 13`, `Community 15`, `Community 16`, `Community 17`, `Community 18`, `Community 19`, `Community 26`, `Community 27`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 33`, `Community 34`, `Community 36`?**
  _High betweenness centrality (0.166) - this node is a cross-community bridge._
- **Why does `SectionCard()` connect `Community 13` to `Community 0`, `Community 1`, `Community 34`, `Community 3`, `Community 32`, `Community 33`, `Community 38`, `Community 36`, `Community 8`, `Community 7`, `Community 10`, `Community 12`, `Community 14`, `Community 16`, `Community 19`, `Community 26`, `Community 29`, `Community 31`?**
  _High betweenness centrality (0.070) - this node is a cross-community bridge._
- **Why does `getAppSettings()` connect `Community 13` to `Community 3`, `Community 6`, `Community 39`, `Community 10`, `Community 17`, `Community 18`, `Community 28`, `Community 30`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `withDatabaseRetry()` (e.g. with `EditCustomerPage()` and `EditDeliveryTicketPage()`) actually correct?**
  _`withDatabaseRetry()` has 12 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `getAppSettings()` (e.g. with `EditDeliveryTicketPage()` and `FileSettingsPage()`) actually correct?**
  _`getAppSettings()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `EditCustomerPageProps`, `CustomerDetailPageProps`, `CUSTOMER_TYPES` to the rest of the system?**
  _271 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05406746031746032 - nodes in this community are weakly interconnected._