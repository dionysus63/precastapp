# Graph Report - .  (2026-06-21)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1218 nodes · 2694 edges · 69 communities (60 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 44 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b90ce091`
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
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
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
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]

## God Nodes (most connected - your core abstractions)
1. `withDatabaseRetry()` - 115 edges
2. `SectionCard()` - 48 edges
3. `DashboardShell()` - 43 edges
4. `getAppSettings()` - 39 edges
5. `StatusBadge()` - 23 edges
6. `compilerOptions` - 16 edges
7. `launchWindowsFolder()` - 15 edges
8. `mapQuoteToDetailView()` - 14 edges
9. `generateSubmittalPackageForQuote()` - 13 edges
10. `getCompanyLogoUpdatedAt()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `EditCustomerPage()` --calls--> `withDatabaseRetry()`  [INFERRED]
  app/customers/[id]/edit/page.tsx → lib/prisma.ts
- `InventoryProductionPage()` --calls--> `withDatabaseRetry()`  [INFERRED]
  app/inventory/production/page.tsx → lib/prisma.ts
- `NewJobStructurePage()` --calls--> `withDatabaseRetry()`  [INFERRED]
  app/jobs/[id]/structures/new/page.tsx → lib/prisma.ts
- `ProductionPage()` --calls--> `withDatabaseRetry()`  [INFERRED]
  app/production/page.tsx → lib/prisma.ts
- `ProductDetailPage()` --calls--> `mapProductToDetail()`  [INFERRED]
  app/products/[id]/page.tsx → lib/product-mapper.ts

## Import Cycles
- None detected.

## Communities (69 total, 9 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (57): QuoteDetailPage(), QuoteDetailPageProps, getQuotePdfJobSubfolder(), getSubmittalsJobSubfolder(), formatDrainRingPoolDescription(), buildSubmittalPackageBaseName(), isSubmittalDocumentType(), deriveOriginalQuoteNumber() (+49 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (48): createCustomer(), CUSTOMER_STATUSES, CUSTOMER_TYPES, deleteCustomer(), parseCustomerFormData(), updateCustomer(), CustomerDetailContent(), CustomerDetailContentProps (+40 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (53): InventorySubmittalsCell(), InventorySubmittalsCellProps, InventoryPage(), getStockSubmittalsRoot(), assertSanitaryDrainRingAllowed(), diameterSupportsSanitaryDrainRing(), DRAIN_RING_SANITARY_DIAMETERS, isRecognizedBulkRingStyle() (+45 more)

### Community 3 - "Community 3"
Cohesion: 0.05
Nodes (60): bug:C1, bug:C2, bug:H1, bug:H2, bug:H3, bug:L1, bug:L2, bug:L3 (+52 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (42): EditProductPage(), EditProductPageProps, drainRingStyleFormOptions, categoryVariant(), formatCurrency(), formatDecimal(), formatYesNo(), mapProductToDetail() (+34 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (34): BillingSettingsPage(), BillingSettingsPageProps, saveBillingSettings(), CompanySettingsPageProps, removeCompanyLogo(), saveCompanySettings(), uploadCompanyLogo(), FileSettingsPage() (+26 more)

### Community 6 - "Community 6"
Cohesion: 0.09
Nodes (43): ExplorerOpenResult, listJobsMissingFolders(), listRecentFiles(), revalidateFilesPaths(), syncAllFiles(), syncJobFilesAction(), uploadJobFileAction(), FilesHub() (+35 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (38): buildLineCreates(), createDeliveryTicket(), DeliveryTicketLineInput, parseDate(), SaveDeliveryTicketInput, STATUS_FLOW, ticketData(), updateDeliveryTicket() (+30 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (30): openJobFolderCategory(), assertPathUnderJobFolder(), assertPathUnderJobsRoot(), assertPathUnderRoot(), normalizePath(), pathsEqual(), pathStartsWith(), assertDirectoryExists() (+22 more)

### Community 9 - "Community 9"
Cohesion: 0.07
Nodes (28): Bug Report — precastapp, C1. Command injection risk in folder-opening shell call, C2. Job-number race condition is not actually fixed by the "fix_job_sequence" migration, Critical, H1. Bulk product import silently drops duplicate product codes within a batch, and crashes ugly on DB-level duplicates, H2. No authentication or authorization anywhere in the app, H3. `createJob` leaves an orphaned, unrecoverable DB row if folder creation fails, High (+20 more)

### Community 10 - "Community 10"
Cohesion: 0.12
Nodes (17): SectionCard(), SectionCardProps, BadgeVariant, StatusBadge(), StatusBadgeProps, variantStyles, PriceListDetailPage(), PriceListDetailPageProps (+9 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (22): DeliveryTicketActivityItem, deliveryTicketCustomerOptions, DeliveryTicketDetailLineItem, deliveryTicketDriverOptions, DeliveryTicketFormLineItem, deliveryTicketJobOptions, DeliveryTicketLineItemType, deliveryTicketStatusFilterOptions (+14 more)

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (22): formatRingQuoteItemCode(), AddLineModalType, FlashMessage, QuoteForm(), calculateQuoteTotals(), drainRingDiameterFeetOptions, EditableQuoteLineItem, formatQuoteCurrency() (+14 more)

### Community 13 - "Community 13"
Cohesion: 0.08
Nodes (23): MockConfigurableProduct, mockConfigurableProducts, MockQuoteCustomer, mockQuoteCustomers, MockQuoteJob, mockQuoteJobs, MockServiceOption, MockStockProduct (+15 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (18): getJobFilesForBrowser(), JobFilesBrowser(), mapFilesForBrowser(), JobDetailPage(), JobDetailPageProps, resolveTab(), VALID_TABS, JobFilesPage() (+10 more)

### Community 15 - "Community 15"
Cohesion: 0.16
Nodes (10): DashboardShell(), DashboardShellProps, Header(), HeaderProps, EditDeliveryTicketPage(), EditDeliveryTicketPageProps, getAppSettings(), NewDeliveryTicketPage() (+2 more)

### Community 16 - "Community 16"
Cohesion: 0.14
Nodes (18): buildJobCustomerFilterOptions(), buildJobYearFilterOptions(), JobRelatedDelivery, JobRelatedInvoice, JobRelatedQuote, JobRelatedStructure, JobRow, jobStatusFilterOptions (+10 more)

### Community 17 - "Community 17"
Cohesion: 0.10
Nodes (19): Prisma / Database Rules, Project context, Security posture: internal, trusted-network tool only, This is NOT the Next.js you know, App (Next.js), Browse data, Daily workflow, Git / GitHub (optional) (+11 more)

### Community 18 - "Community 18"
Cohesion: 0.21
Nodes (18): DEFAULT_APP_SETTINGS_DATA, getJobsRoot(), convertPdfToPng(), getCompanyLogoPath(), hasCompanyLogo(), IMAGE_MIME_TYPES, pathExists(), pathToLocalFileUrl() (+10 more)

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (15): JobStructureForm(), JobStructureFormProps, NewJobStructurePage(), NewJobStructurePageProps, StructureForm(), CastingRow, createCastingRow(), createOpeningRow() (+7 more)

### Community 20 - "Community 20"
Cohesion: 0.18
Nodes (19): JobInvoiceableDelivery, DecimalLike, deliveryStatusVariant(), formatCurrency(), formatDate(), formatProjectAddress(), formatQuantity(), invoiceStatusVariant() (+11 more)

### Community 21 - "Community 21"
Cohesion: 0.16
Nodes (19): withDatabaseRetry(), approveStructureForProduction(), confirmDeliveryDayReconciliation(), convertTicketToInvoice(), deliverTicket(), getQuoteFulfillmentForTicket(), linkStructuresForWonQuote(), listInventoryProducts() (+11 more)

### Community 22 - "Community 22"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 23 - "Community 23"
Cohesion: 0.15
Nodes (12): openJobFile(), JobFileBrowserItem, JobFilesBrowserProps, JobFilesPreviewProps, OpenFileButton(), OpenFileButtonProps, createJobFolder(), openJobFolder() (+4 more)

### Community 24 - "Community 24"
Cohesion: 0.15
Nodes (13): listDeliveryTicketsForPage(), deliveryDateFilterOptions, deliveryDriverFilterOptions, deliveryJobFilterOptions, DeliveryTicketRow, deliveryTicketStatusLabels, deliveryTruckFilterOptions, placeholderDeliveryTickets (+5 more)

### Community 25 - "Community 25"
Cohesion: 0.18
Nodes (16): allocateJobNumber(), createJob(), createJobStructure(), formatJobNumber(), JOB_STATUSES, JobStatus, parseJobFormData(), parseJobUpdateFormData() (+8 more)

### Community 26 - "Community 26"
Cohesion: 0.16
Nodes (14): AppSettingsView, DEFAULT_DRIVERS, DEFAULT_ESTIMATORS, DEFAULT_PAYMENT_TERMS, DEFAULT_TRAILERS, DEFAULT_TRUCKS, defaultInvoiceDueDate(), getDefaultTaxRate() (+6 more)

### Community 27 - "Community 27"
Cohesion: 0.14
Nodes (15): DrainRingStyle, createQuote(), CreateQuoteInput, CreateQuoteLineItemInput, generateQuoteNumber(), parseOptionalDate(), QUOTE_LINE_TYPES, QUOTE_STATUS_VALUES (+7 more)

### Community 28 - "Community 28"
Cohesion: 0.19
Nodes (11): DeliveryTicketPreviewContent(), DeliveryTicketPreviewContentProps, DeliveryTicketDetailView, generateDeliveryTicketPdf(), GenerateDeliveryTicketPdfResult, CompanyProfile, getJobSubfolders(), getQuotePdfFallbackDir() (+3 more)

### Community 29 - "Community 29"
Cohesion: 0.14
Nodes (13): QuotesPage(), quoteDueDateFilterOptions, quoteEstimatorFilterOptions, QuoteRow, quoteStatusFilterOptions, quoteSummaryCards, quoteTypeFilterOptions, quoteYearFilterOptions (+5 more)

### Community 30 - "Community 30"
Cohesion: 0.22
Nodes (12): DeliveryTicketDetailContent(), getDeliveryTicketDetailById(), DeliveryTicketDetailPage(), DeliveryTicketDetailPageProps, DbDeliveryTicket, formatDate(), formatDateIsoLocal(), formatWeight() (+4 more)

### Community 31 - "Community 31"
Cohesion: 0.25
Nodes (11): geistMono, geistSans, generateMetadata(), CompanySettingsPage(), getCompanyProfile(), companyLogoApiUrl(), getCompanyLogoUpdatedAt(), DeliveryTicketPreviewPage() (+3 more)

### Community 32 - "Community 32"
Cohesion: 0.17
Nodes (9): accentStyles, SummaryCard(), SummaryCardProps, updateQuoteStatus(), GenerateSubmittalPackageButton(), LinkStructuresButton(), MarkWonButton(), generateSubmittalPackage() (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.16
Nodes (9): updateDeliveryTicketStatus(), DeliveryTicketDetailContentProps, DeliveryTicketStatus, TicketOperationsPanel(), TicketOperationsPanelProps, TicketPdfButton(), TicketPdfButtonProps, TicketStatusActions() (+1 more)

### Community 34 - "Community 34"
Cohesion: 0.26
Nodes (9): InvoiceDetailPage(), InvoiceDetailPageProps, InvoiceDetailContent(), InvoiceDetailContentProps, formatDate(), formatMoney(), InvoiceDetailView, mapDbInvoiceToDetailView() (+1 more)

### Community 35 - "Community 35"
Cohesion: 0.19
Nodes (9): EditJobPage(), EditJobPageProps, JobFilesPreview(), JobCustomerOption, JobForm(), JobFormProps, JobFormValues, formatJobDateInput() (+1 more)

### Community 36 - "Community 36"
Cohesion: 0.24
Nodes (10): DispatcherWeekCalendar(), DispatcherWeekCalendarProps, DISPATCH_STATUSES, formatDateIso(), getCurrentWeekWeekdays(), getTodaysScheduledLoads(), groupTicketsByDeliveryDate(), isDispatchTicket() (+2 more)

### Community 37 - "Community 37"
Cohesion: 0.18
Nodes (11): AGENTS.md, AuthLayer, CLAUDE.md, Customers, Jobs, Products, Quotes, ServerActions (+3 more)

### Community 38 - "Community 38"
Cohesion: 0.27
Nodes (10): clientHasAppSettingsFields(), createPool(), createPrismaClient(), getPrismaClient(), globalForPrisma, isConnectionError(), isPrismaClientStale(), isSchemaValidationError() (+2 more)

### Community 39 - "Community 39"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx, @types/node, @types/pg (+3 more)

### Community 40 - "Community 40"
Cohesion: 0.27
Nodes (8): ReconcileDay(), ReconcileDayProps, ReconcileTicket, TicketVerificationForm(), listTicketsForReconciliation(), updateTicketPaperVerification(), DeliveryTicketsReconcilePage(), PageProps

### Community 41 - "Community 41"
Cohesion: 0.36
Nodes (8): JOB_SUBFOLDERS, buildJobFolderBaseName(), createJobFoldersForJob(), createJobFolderStructure(), isFolderPathTakenByAnotherJob(), pathExists(), resolveJobFolderPath(), sanitizeFolderName()

### Community 42 - "Community 42"
Cohesion: 0.20
Nodes (10): scripts, build, db:seed, db:sync-files, dev, lint, postinstall, predev (+2 more)

### Community 43 - "Community 43"
Cohesion: 0.28
Nodes (6): InventoryAdjustPage(), saveInventoryAdjustment(), AdjustForm(), AdjustFormProps, ProductOption, adjustInventory()

### Community 44 - "Community 44"
Cohesion: 0.25
Nodes (7): defaultQuoteExpirationDate(), mapProductToQuoteFormOption(), NewQuotePage(), NewQuotePageProps, listPriceListsForForm(), mockServiceOptions, QuoteFormServiceOption

### Community 45 - "Community 45"
Cohesion: 0.36
Nodes (8): approveJobStructureForProduction(), linkJobStructuresFromQuote(), mapLineTypeToStructureType(), markJobStructureMade(), markJobStructureShipped(), setJobStructureStatus(), startJobStructureProduction(), STRUCTURE_LINE_TYPES

### Community 46 - "Community 46"
Cohesion: 0.29
Nodes (8): DATABASE_URL, LAN/VPN, PostgreSQL 18, Prisma, prisma, postgresql-x64-18, precastapp, precastapp_db

### Community 47 - "Community 47"
Cohesion: 0.32
Nodes (6): createRow(), ProductionEntryForm(), ProductionEntryFormProps, ProductionLineRow, ProductOption, InventoryProductionPage()

### Community 48 - "Community 48"
Cohesion: 0.36
Nodes (5): ProductionPage(), ApproveStructuresPanel(), ProductionQueue(), ProductionQueueItem, ProductionQueueProps

### Community 49 - "Community 49"
Cohesion: 0.25
Nodes (8): dependencies, next, pdf-lib, pg, @prisma/adapter-pg, @prisma/client, react, react-dom

### Community 50 - "Community 50"
Cohesion: 0.29
Nodes (7): BraveBrowser, COMMANDS.md, GoogleChrome, Puppeteer, npx prisma migrate status, npx prisma studio, puppeteer

### Community 51 - "Community 51"
Cohesion: 0.33
Nodes (5): formatCurrency(), Home(), jobStatusLabels, QuoteStatus, quoteStatusLabels

### Community 52 - "Community 52"
Cohesion: 0.33
Nodes (6): Next.js, PrismaClient, PrismaSchema, README.md, npm run dev, npx prisma generate

### Community 53 - "Community 53"
Cohesion: 0.33
Nodes (5): Dates, Delivery eligibility, Job Structure Production Workflow, Quote → JobStructure linking, Server actions

### Community 54 - "Community 54"
Cohesion: 0.50
Nodes (3): NavItem, navItems, Sidebar()

### Community 55 - "Community 55"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 56 - "Community 56"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 68 - "Community 68"
Cohesion: 0.23
Nodes (8): getDocumentNumberingPreview(), getSettingsHubStatus(), settingSections, SettingsPage(), SystemMaintenancePanel(), SettingsShell(), SettingsShellProps, SystemSettingsPage()

## Knowledge Gaps
- **302 isolated node(s):** `This is NOT the Next.js you know`, `Security posture: internal, trusted-network tool only`, `Prisma / Database Rules`, `C1. Command injection risk in folder-opening shell call`, `C2. Job-number race condition is not actually fixed by the "fix_job_sequence" migration` (+297 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `withDatabaseRetry()` connect `Community 21` to `Community 0`, `Community 1`, `Community 2`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 10`, `Community 14`, `Community 15`, `Community 16`, `Community 18`, `Community 19`, `Community 23`, `Community 24`, `Community 26`, `Community 27`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 33`, `Community 34`, `Community 35`, `Community 38`, `Community 40`, `Community 43`, `Community 44`, `Community 47`, `Community 48`, `Community 51`, `Community 68`?**
  _High betweenness centrality (0.145) - this node is a cross-community bridge._
- **Why does `SectionCard()` connect `Community 10` to `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 11`, `Community 12`, `Community 14`, `Community 16`, `Community 19`, `Community 23`, `Community 24`, `Community 29`, `Community 32`, `Community 33`, `Community 34`, `Community 35`, `Community 36`, `Community 40`, `Community 43`, `Community 47`, `Community 48`, `Community 51`, `Community 68`?**
  _High betweenness centrality (0.069) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 49` to `Community 50`, `Community 46`, `Community 55`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `withDatabaseRetry()` (e.g. with `EditCustomerPage()` and `EditDeliveryTicketPage()`) actually correct?**
  _`withDatabaseRetry()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `getAppSettings()` (e.g. with `EditDeliveryTicketPage()` and `FileSettingsPage()`) actually correct?**
  _`getAppSettings()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `This is NOT the Next.js you know`, `Security posture: internal, trusted-network tool only`, `Prisma / Database Rules` to the rest of the system?**
  _302 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.056314699792960665 - nodes in this community are weakly interconnected._