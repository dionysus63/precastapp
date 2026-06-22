# Graph Report - precastapp  (2026-06-22)

## Corpus Check
- 245 files · ~105,522 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1662 nodes · 3955 edges · 116 communities (92 shown, 24 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 58 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 82|Community 82]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 96|Community 96]]
- [[_COMMUNITY_Community 97|Community 97]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 106|Community 106]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]
- [[_COMMUNITY_Community 109|Community 109]]
- [[_COMMUNITY_Community 110|Community 110]]
- [[_COMMUNITY_Community 111|Community 111]]
- [[_COMMUNITY_Community 112|Community 112]]
- [[_COMMUNITY_Community 113|Community 113]]
- [[_COMMUNITY_Community 115|Community 115]]

## God Nodes (most connected - your core abstractions)
1. `withDatabaseRetry()` - 137 edges
2. `requirePermission()` - 109 edges
3. `SectionCard()` - 60 edges
4. `DashboardShell()` - 50 edges
5. `getAppSettings` - 42 edges
6. `StatusBadge()` - 27 edges
7. `prisma` - 24 edges
8. `getCurrentUser()` - 19 edges
9. `updateProductCatalogSettingsFormAction()` - 17 edges
10. `compilerOptions` - 16 edges

## Surprising Connections (you probably didn't know these)
- `EditCustomerPage()` --calls--> `withDatabaseRetry()`  [INFERRED]
  app/customers/[id]/edit/page.tsx → lib/prisma.ts
- `InventoryProductionPage()` --calls--> `withDatabaseRetry()`  [INFERRED]
  app/inventory/production/page.tsx → lib/prisma.ts
- `NewJobStructurePage()` --calls--> `withDatabaseRetry()`  [INFERRED]
  app/jobs/[id]/structures/new/page.tsx → lib/prisma.ts
- `ProductionPage()` --calls--> `withDatabaseRetry()`  [INFERRED]
  app/production/page.tsx → lib/prisma.ts
- `PriceListDetailPage()` --calls--> `withDatabaseRetry()`  [INFERRED]
  app/settings/price-lists/[id]/page.tsx → lib/prisma.ts

## Import Cycles
- None detected.

## Communities (116 total, 24 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (21): DeliveryTicketActivityItem, deliveryTicketCustomerOptions, DeliveryTicketDetailLineItem, deliveryTicketDriverOptions, DeliveryTicketFormLineItem, deliveryTicketJobOptions, DeliveryTicketLineItemType, deliveryTicketStatusFormOptions (+13 more)

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (17): CustomerContactRow, CustomerDetailView, CustomerRelatedDeliveryTicket, CustomerRelatedJob, CustomerRelatedQuote, CustomerRow, customerStatusLabels, formatCurrency() (+9 more)

### Community 2 - "Community 2"
Cohesion: 0.33
Nodes (7): addJobBidder(), awardJob(), generateQuotesFromMaster(), listCustomersForBidList(), removeJobBidder(), JobBiddingPanelProps, JobBidListCustomerOption

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (54): EditJobPage(), EditJobPageProps, ExplorerOpenResult, listJobsMissingFolders(), listRecentFiles(), SyncAllFilesResult, FilesHub(), FilesHubProps (+46 more)

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (60): bug:C1, bug:C2, bug:H1, bug:H2, bug:H3, bug:L1, bug:L2, bug:L3 (+52 more)

### Community 5 - "Community 5"
Cohesion: 0.14
Nodes (15): EditProductPage(), EditProductPageProps, ProductCatalogCategory, applyProductCatalogRenames(), getProductCatalog, getProductCatalogUsage, NewProductPage(), ProductCatalogSettingsPage() (+7 more)

### Community 6 - "Community 6"
Cohesion: 0.15
Nodes (12): DeliveryTicketEditor(), DeliveryTicketEditorProps, EditorLine, formatWeight(), fulfillmentMetaForEditorLine(), getEffectiveWeightEach(), initialFleetSelect(), isDrainRingEditorKey() (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.05
Nodes (71): openJobFolderCategory(), allocateJobNumber(), createJob(), createJobStructure(), formatJobNumber(), JOB_STATUSES, JobStatus, JobStructureExplorerOpenResult (+63 more)

### Community 8 - "Community 8"
Cohesion: 0.16
Nodes (29): "public"."AppSettings", "public"."Contact", "public"."Customer", "public"."DailyProductionEntry", "public"."DailyProductionLine", "public"."DeliveryDayReconciliation", "public"."DeliveryTicket", "public"."DeliveryTicketLineItem" (+21 more)

### Community 9 - "Community 9"
Cohesion: 0.20
Nodes (9): AppSettingsView, DEFAULT_DRIVERS, DEFAULT_ESTIMATORS, DEFAULT_PAYMENT_TERMS, DEFAULT_TRAILERS, DEFAULT_TRUCKS, getDefaultTaxRate(), mapAppSettingsRow() (+1 more)

### Community 10 - "Community 10"
Cohesion: 0.14
Nodes (16): JobStructureForm(), JobStructureFormProps, JobStructureSubmittalActionsProps, NewJobStructurePage(), NewJobStructurePageProps, StructureForm(), CastingRow, createCastingRow() (+8 more)

### Community 11 - "Community 11"
Cohesion: 0.10
Nodes (24): QuoteDetailPage(), QuoteDetailPageProps, formatDrainRingPoolDescription(), deriveOriginalQuoteNumber(), formatCurrency(), formatQuoteDate(), formatQuoteDateLong(), formatQuoteLineDescription() (+16 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (23): MockConfigurableProduct, mockConfigurableProducts, MockQuoteCustomer, mockQuoteCustomers, MockQuoteJob, mockQuoteJobs, MockServiceOption, MockStockProduct (+15 more)

### Community 13 - "Community 13"
Cohesion: 0.11
Nodes (39): requirePermission(), createDeliveryTicket(), updateDeliveryTicket(), updateDeliveryTicketStatus(), listJobFilesAction(), openJobFile(), revalidateFilesPaths(), syncAllFiles() (+31 more)

### Community 14 - "Community 14"
Cohesion: 0.11
Nodes (19): SectionCard(), SectionCardProps, BadgeVariant, StatusBadge(), StatusBadgeProps, variantStyles, EditSettingsUserPage(), EditSettingsUserPageProps (+11 more)

### Community 15 - "Community 15"
Cohesion: 0.16
Nodes (16): SettingsUsersAuditPage(), FileSettingsPage(), FileSettingsPageProps, saveFileSettings(), getAppSettings, NewSettingsUserPage(), getDocumentNumberingPreview(), testJobsRootWriteAccessAction() (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.15
Nodes (23): JobInvoiceableDelivery, JobMasterQuoteOption, JobRelatedDelivery, JobRelatedQuote, JobRelatedStructure, JobStatusVariant, buildBiddingSummary(), DecimalLike (+15 more)

### Community 17 - "Community 17"
Cohesion: 0.12
Nodes (24): getDrainRingStyleOptionsForDiameter(), buildCategoryFilterOptions(), getCategoryNames(), mergeCatalogWithInUseValues(), importProducts(), drainRingDiameterOptions, ProductForm(), ProductFormProps (+16 more)

### Community 18 - "Community 18"
Cohesion: 0.13
Nodes (24): buildSubcategoryFilterOptions(), catalogContainsPair(), conflictsNotCoveredByRenames(), countProductsForRename(), DEFAULT_PRODUCT_CATALOG, detectCatalogRenames(), findCatalogInUseConflicts(), formatCatalogRenameLabel() (+16 more)

### Community 19 - "Community 19"
Cohesion: 0.25
Nodes (7): ProductionPage(), structureInclude, ApproveStructuresPanel(), NeedsSubmittalPanel(), ProductionQueue(), ProductionQueueItem, ProductionQueueProps

### Community 20 - "Community 20"
Cohesion: 0.08
Nodes (43): generateDeliveryTicketPdf(), GenerateDeliveryTicketPdfResult, TicketPdfButtonProps, getJobSubfolders(), getQuotePdfFallbackDir(), getQuotePdfJobSubfolder(), getSubmittalsJobSubfolder(), JOB_SUBFOLDERS (+35 more)

### Community 21 - "Community 21"
Cohesion: 0.09
Nodes (40): InventorySubmittalsCell(), InventorySubmittalsCellProps, InventoryPage(), getStockSubmittalsRoot(), assertPathUnderStockSubmittalsRoot(), assertProductExists(), deleteProductDocument(), getProductDocumentForOpen() (+32 more)

### Community 22 - "Community 22"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 23 - "Community 23"
Cohesion: 0.12
Nodes (26): BillingSettingsPage(), BillingSettingsPageProps, saveBillingSettings(), DataResetSettingsPage(), formatLinesList(), parseLinesList(), OperationsSettingsPage(), OperationsSettingsPageProps (+18 more)

### Community 24 - "Community 24"
Cohesion: 0.18
Nodes (14): buildWorkflowSteps(), formatDate(), formatQuantity(), JobStructureDetailView, JobStructureDocumentRow, JobStructureWithRelations, JobStructureWorkflowStep, mapJobStructureToDetailView() (+6 more)

### Community 25 - "Community 25"
Cohesion: 0.11
Nodes (20): parseDrainRingStyle(), cloneQuoteForBidder(), toDecimal(), TransactionClient, DbClient, generateQuoteNumber(), createQuote(), CreateQuoteInput (+12 more)

### Community 26 - "Community 26"
Cohesion: 0.12
Nodes (19): BulkImportRow, createCustomer(), CUSTOMER_STATUSES, CustomerRecordInput, deleteCustomer(), findSimilarCustomers(), ImportCustomersResult, loadSimilarCustomerMatches() (+11 more)

### Community 27 - "Community 27"
Cohesion: 0.60
Nodes (3): JobsList(), JobsPage(), getFavoriteJobIdsForUser()

### Community 28 - "Community 28"
Cohesion: 0.31
Nodes (9): CompanySettingsPageProps, removeCompanyLogo(), saveCompanySettings(), uploadCompanyLogo(), removeCompanyLogoFormAction(), revalidateSettingsPaths(), updateAppSettings(), updateCompanySettingsFormAction() (+1 more)

### Community 29 - "Community 29"
Cohesion: 0.20
Nodes (7): DeliveryTicketDetailContentProps, DeliveryTicketStatus, TicketOperationsPanel(), TicketOperationsPanelProps, TicketPdfButton(), TicketStatusActions(), TicketStatusActionsProps

### Community 30 - "Community 30"
Cohesion: 0.14
Nodes (13): QuotesPage(), quoteDueDateFilterOptions, quoteEstimatorFilterOptions, QuoteRow, quoteStatusFilterOptions, quoteSummaryCards, quoteTypeFilterOptions, quoteYearFilterOptions (+5 more)

### Community 31 - "Community 31"
Cohesion: 0.32
Nodes (5): InventoryAdjustPage(), saveInventoryAdjustment(), AdjustForm(), AdjustFormProps, ProductOption

### Community 32 - "Community 32"
Cohesion: 0.17
Nodes (15): buildJobCustomerFilterOptions(), buildJobYearFilterOptions(), JobBidderRow, JobBiddingSummary, JobRelatedInvoice, JobRow, jobStatusFilterOptions, jobStatusLabels (+7 more)

### Community 33 - "Community 33"
Cohesion: 0.26
Nodes (9): InvoiceDetailPage(), InvoiceDetailPageProps, InvoiceDetailContent(), InvoiceDetailContentProps, formatDate(), formatMoney(), InvoiceDetailView, mapDbInvoiceToDetailView() (+1 more)

### Community 34 - "Community 34"
Cohesion: 0.13
Nodes (12): toggleJobFavorite(), JobBiddingPanel(), JobDetailContentProps, JobDetailFiles, TAB_LABELS, TAB_ORDER, tabHref(), TabLink() (+4 more)

### Community 35 - "Community 35"
Cohesion: 0.10
Nodes (22): formatRingQuoteItemCode(), AddLineModalType, FlashMessage, QuoteForm(), calculateQuoteTotals(), drainRingDiameterFeetOptions, EditableQuoteLineItem, formatQuoteCurrency() (+14 more)

### Community 36 - "Community 36"
Cohesion: 0.21
Nodes (7): JobStructureSubmittalActions(), StructureManageLink(), StructureManageLinkProps, GenerateSubmittalPackageButton(), LinkStructuresButton(), MarkWonButton(), QuoteDetailContentProps

### Community 37 - "Community 37"
Cohesion: 0.14
Nodes (11): FileUploadDropzone(), FileUploadDropzoneProps, formatFolderCategoryLabel(), JobFilesBrowser(), JobFilesBrowserProps, createJobFolder(), openJobFolder(), CreateJobFolderButton() (+3 more)

### Community 38 - "Community 38"
Cohesion: 0.18
Nodes (11): devDependencies, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx, @types/node, @types/pg (+3 more)

### Community 39 - "Community 39"
Cohesion: 0.22
Nodes (9): dependencies, next, pdf-lib, pg, @prisma/adapter-pg, @prisma/client, react, react-dom (+1 more)

### Community 40 - "Community 40"
Cohesion: 0.21
Nodes (18): DEFAULT_APP_SETTINGS_DATA, getJobsRoot(), convertPdfToPng(), getCompanyLogoPath(), hasCompanyLogo(), IMAGE_MIME_TYPES, pathExists(), pathToLocalFileUrl() (+10 more)

### Community 41 - "Community 41"
Cohesion: 0.20
Nodes (10): scripts, build, db:seed, db:sync-files, dev, lint, postinstall, predev (+2 more)

### Community 42 - "Community 42"
Cohesion: 0.24
Nodes (7): formatCurrency(), Home(), accentStyles, SummaryCard(), SummaryCardProps, QuoteStatus, quoteStatusLabels

### Community 43 - "Community 43"
Cohesion: 0.32
Nodes (6): createRow(), ProductionEntryForm(), ProductionEntryFormProps, ProductionLineRow, ProductOption, InventoryProductionPage()

### Community 44 - "Community 44"
Cohesion: 0.25
Nodes (7): defaultQuoteExpirationDate(), mapProductToQuoteFormOption(), NewQuotePage(), NewQuotePageProps, listPriceListsForForm(), mockServiceOptions, QuoteFormServiceOption

### Community 45 - "Community 45"
Cohesion: 0.07
Nodes (28): Bug Report — precastapp, C1. Command injection risk in folder-opening shell call, C2. Job-number race condition is not actually fixed by the "fix_job_sequence" migration, Critical, H1. Bulk product import silently drops duplicate product codes within a batch, and crashes ugly on DB-level duplicates, H2. No authentication or authorization anywhere in the app, H3. `createJob` leaves an orphaned, unrecoverable DB row if folder creation fails, High (+20 more)

### Community 46 - "Community 46"
Cohesion: 0.18
Nodes (21): hasPermission(), GET(), buildCustomersExportBuffer(), customerExportHeaders, customerStatusLabels, mapCustomerToExportRow(), buildExportFilename(), buildWorkbookBuffer() (+13 more)

### Community 47 - "Community 47"
Cohesion: 0.29
Nodes (7): BraveBrowser, COMMANDS.md, GoogleChrome, Puppeteer, npx prisma migrate status, npx prisma studio, puppeteer

### Community 48 - "Community 48"
Cohesion: 0.29
Nodes (8): DATABASE_URL, LAN/VPN, PostgreSQL 18, Prisma, prisma, postgresql-x64-18, precastapp, precastapp_db

### Community 49 - "Community 49"
Cohesion: 0.33
Nodes (6): Next.js, PrismaClient, PrismaSchema, README.md, npm run dev, npx prisma generate

### Community 50 - "Community 50"
Cohesion: 0.18
Nodes (11): AGENTS.md, AuthLayer, CLAUDE.md, Customers, Jobs, Products, Quotes, ServerActions (+3 more)

### Community 51 - "Community 51"
Cohesion: 0.13
Nodes (14): DeliveryTicketPreviewContent(), DeliveryTicketPreviewContentProps, DeliveryTicketDetailView, CompanyProfile, getCompanyLogoDataUri(), buildDeliveryTicketPdfHtml(), escapeHtml(), buildQuotePdfHtml() (+6 more)

### Community 52 - "Community 52"
Cohesion: 0.17
Nodes (16): getDefaultHome(), createSession(), deleteCurrentSession(), getCurrentUser(), getSessionExpiryDate(), getUserPermissions(), requireAuthForPath(), signInUser() (+8 more)

### Community 53 - "Community 53"
Cohesion: 0.50
Nodes (3): name, private, version

### Community 64 - "Community 64"
Cohesion: 0.16
Nodes (13): assertSanitaryDrainRingAllowed(), diameterSupportsSanitaryDrainRing(), DRAIN_RING_SANITARY_DIAMETERS, DrainRingStyle, drainRingStyleFormOptions, isRecognizedBulkRingStyle(), parseBulkRingStyle(), mapBulkImportRow() (+5 more)

### Community 65 - "Community 65"
Cohesion: 0.11
Nodes (31): ALL_PERMISSION_KEYS, canAccessPathWithPermissions(), formatPermissionLabel(), getDefaultHomeForRole(), getEffectivePermissionsForUser(), getRequiredPermissionForPath(), getRolePermissions(), PERMISSION_GROUPS (+23 more)

### Community 66 - "Community 66"
Cohesion: 0.09
Nodes (21): Authentication today, Authorization, Prisma / Database Rules, Project context, Security posture: internal, trusted-network tool, This is NOT the Next.js you know, App (Next.js), Browse data (+13 more)

### Community 67 - "Community 67"
Cohesion: 0.21
Nodes (11): DispatcherWeekCalendar, DispatcherWeekCalendarProps, DISPATCH_STATUSES, formatDateIso(), formatWeekRangeLabel(), getCurrentWeekWeekdays(), getTodaysScheduledLoads(), groupTicketsByDeliveryDate() (+3 more)

### Community 68 - "Community 68"
Cohesion: 0.14
Nodes (17): ProductDetailPage(), ProductDetailPageProps, categoryVariant(), formatCurrency(), formatDecimal(), formatYesNo(), mapProductToDetail(), mapProductToRow() (+9 more)

### Community 69 - "Community 69"
Cohesion: 0.20
Nodes (16): AuditLogInput, writeAuditLog(), ROLE_LABELS, requireAuth(), prisma, ProfilePage(), UserListRow, UsersListProps (+8 more)

### Community 70 - "Community 70"
Cohesion: 0.25
Nodes (11): geistMono, geistSans, generateMetadata(), CompanySettingsPage(), getCompanyProfile(), companyLogoApiUrl(), getCompanyLogoUpdatedAt(), DeliveryTicketPreviewPage() (+3 more)

### Community 72 - "Community 72"
Cohesion: 0.16
Nodes (11): customerStatusFilterOptions, compareCustomers(), CustomersList(), CustomersListProps, parseActivityDate(), parseBalance(), SortableHeaderProps, SortColumn (+3 more)

### Community 73 - "Community 73"
Cohesion: 0.18
Nodes (11): deliveryDateFilterOptions, deliveryDriverFilterOptions, deliveryJobFilterOptions, DeliveryTicketRow, deliveryTicketStatusFilterOptions, deliveryTicketStatusLabels, deliveryTruckFilterOptions, placeholderDeliveryTickets (+3 more)

### Community 74 - "Community 74"
Cohesion: 0.28
Nodes (15): "Contact", "Customer", "Job", "JobFile", "JobSequence", "JobStructure", "JobStructureCasting", "JobStructureDimension" (+7 more)

### Community 75 - "Community 75"
Cohesion: 0.22
Nodes (12): DeliveryTicketDetailContent(), getDeliveryTicketDetailById(), DeliveryTicketDetailPage(), DeliveryTicketDetailPageProps, DbDeliveryTicket, formatDate(), formatDateIsoLocal(), formatWeight() (+4 more)

### Community 76 - "Community 76"
Cohesion: 0.24
Nodes (12): "DailyProductionEntry", "DailyProductionLine", "DeliveryDayReconciliation", "DeliveryTicket", "DeliveryTicketLineItem", "DeliveryTicketSequence", "InventoryTransaction", "Invoice" (+4 more)

### Community 77 - "Community 77"
Cohesion: 0.36
Nodes (11): compactCustomerName(), compactSimilarity(), CustomerNameCandidate, getCustomerNameSimilarity(), jaccardSimilarity(), levenshteinDistance(), levenshteinRatio(), normalizeCustomerName() (+3 more)

### Community 78 - "Community 78"
Cohesion: 0.24
Nodes (8): checkBulkCustomerDbDuplicates(), importCustomers(), BulkPasteForm(), parseBulkPaste(), BulkCustomerPasteRow, bulkPasteColumnHeaders, markBulkPasteDuplicateRows(), validateBulkCustomerPasteRow()

### Community 79 - "Community 79"
Cohesion: 0.19
Nodes (11): buildLineCreates(), DeliveryTicketLineInput, listDeliveryTicketsForPage(), parseDate(), SaveDeliveryTicketInput, STATUS_FLOW, ticketData(), DeliveryTicketsList() (+3 more)

### Community 80 - "Community 80"
Cohesion: 0.27
Nodes (14): validateLines(), DbClient, drainRingCatalogKey(), DrainRingOption, getQuoteLineFulfillment(), getShippedFeetForDrainRingLine(), getShippedQuantityForQuoteLine(), isQuoteLineDrainRing() (+6 more)

### Community 81 - "Community 81"
Cohesion: 0.14
Nodes (15): CustomerContactsPanel(), CustomerDetailContent(), CustomerDetailContentProps, CustomerDetailPage(), CustomerDetailPageProps, ContactSnapshot, contactToSnapshot(), DbClient (+7 more)

### Community 82 - "Community 82"
Cohesion: 0.33
Nodes (5): Dates, Delivery eligibility, Job Structure Production Workflow, Quote → JobStructure linking, Server actions

### Community 83 - "Community 83"
Cohesion: 0.83
Nodes (3): "AuditLog", "Session", "User"

### Community 84 - "Community 84"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 89 - "Community 89"
Cohesion: 0.29
Nodes (11): addCustomerContact(), backfillCustomerContacts(), CustomerContactInput, deleteCustomerContact(), revalidateCustomerPaths(), setPrimaryCustomerContact(), updateCustomerContact(), validateContactInput() (+3 more)

### Community 104 - "Community 104"
Cohesion: 0.19
Nodes (7): ProductCatalogRename, ProductCatalogUsageGroup, renamesAffectingProducts(), ProductCatalogRenameConfirmDialog(), ProductCatalogRenameConfirmDialogProps, EditableCategory, ProductCatalogSettingsFormProps

### Community 105 - "Community 105"
Cohesion: 0.26
Nodes (10): getJobFilesForBrowser(), JobDetailPage(), JobDetailPageProps, resolveTab(), VALID_TABS, JobFilesPage(), JobFilesPageProps, JobDetailContent() (+2 more)

### Community 106 - "Community 106"
Cohesion: 0.28
Nodes (7): ReconcileDay(), ReconcileDayProps, ReconcileTicket, TicketVerificationForm(), updateTicketPaperVerification(), DeliveryTicketsReconcilePage(), PageProps

### Community 107 - "Community 107"
Cohesion: 0.22
Nodes (8): cancelDeliveredTicket(), markDeliveryTicketDelivered(), adjustInventory(), DbClient, deductInventoryForDeliveredTicket(), ProductionLineInput, reverseInventoryForTicket(), saveDailyProductionEntry()

### Community 108 - "Community 108"
Cohesion: 0.43
Nodes (7): defaultInvoiceDueDate(), convertDeliveryTicketToInvoice(), mapDeliveryLineTypeToInvoiceLineType(), nextInvoiceNumber(), preloadUnitPriceLookups(), resolveUnitPrice(), UnitPriceLookups

### Community 109 - "Community 109"
Cohesion: 0.38
Nodes (5): EditDeliveryTicketPage(), EditDeliveryTicketPageProps, NewDeliveryTicketPage(), NewDeliveryTicketPageProps, listJobsWithQuotes()

### Community 111 - "Community 111"
Cohesion: 0.33
Nodes (3): JobQuoteSelectorProps, QuoteFulfillmentPickerProps, QuoteLineFulfillment

### Community 112 - "Community 112"
Cohesion: 0.40
Nodes (4): PriceListDetailPage(), PriceListDetailPageProps, deletePriceListItem(), deletePriceListItemFormAction()

### Community 115 - "Community 115"
Cohesion: 0.14
Nodes (15): EditCustomerPage(), EditCustomerPageProps, JobStructureDetailContent(), clientHasAppSettingsFields(), createPool(), createPrismaClient(), getPrismaClient(), globalForPrisma (+7 more)

## Knowledge Gaps
- **382 isolated node(s):** `EditCustomerPageProps`, `CustomerDetailPageProps`, `CUSTOMER_STATUSES`, `CustomerRecordInput`, `BulkImportRow` (+377 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `withDatabaseRetry()` connect `Community 13` to `Community 2`, `Community 3`, `Community 7`, `Community 9`, `Community 10`, `Community 11`, `Community 14`, `Community 15`, `Community 18`, `Community 19`, `Community 20`, `Community 21`, `Community 23`, `Community 25`, `Community 27`, `Community 28`, `Community 30`, `Community 31`, `Community 33`, `Community 40`, `Community 42`, `Community 43`, `Community 44`, `Community 52`, `Community 70`, `Community 75`, `Community 79`, `Community 81`, `Community 89`, `Community 105`, `Community 106`, `Community 109`, `Community 112`, `Community 115`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `SectionCard()` connect `Community 14` to `Community 0`, `Community 2`, `Community 3`, `Community 5`, `Community 6`, `Community 10`, `Community 15`, `Community 17`, `Community 19`, `Community 21`, `Community 23`, `Community 26`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 33`, `Community 34`, `Community 35`, `Community 36`, `Community 37`, `Community 42`, `Community 43`, `Community 52`, `Community 64`, `Community 67`, `Community 68`, `Community 69`, `Community 72`, `Community 73`, `Community 78`, `Community 81`, `Community 89`, `Community 106`, `Community 111`, `Community 112`, `Community 115`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Why does `requirePermission()` connect `Community 13` to `Community 2`, `Community 3`, `Community 7`, `Community 14`, `Community 15`, `Community 17`, `Community 18`, `Community 20`, `Community 21`, `Community 23`, `Community 25`, `Community 26`, `Community 28`, `Community 31`, `Community 34`, `Community 37`, `Community 46`, `Community 52`, `Community 69`, `Community 78`, `Community 79`, `Community 89`, `Community 106`, `Community 112`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Are the 16 inferred relationships involving `withDatabaseRetry()` (e.g. with `EditCustomerPage()` and `EditDeliveryTicketPage()`) actually correct?**
  _`withDatabaseRetry()` has 16 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `requirePermission()` (e.g. with `EditSettingsUserPage()` and `NewSettingsUserPage()`) actually correct?**
  _`requirePermission()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `getAppSettings` (e.g. with `EditDeliveryTicketPage()` and `FileSettingsPage()`) actually correct?**
  _`getAppSettings` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `EditCustomerPageProps`, `CustomerDetailPageProps`, `CUSTOMER_STATUSES` to the rest of the system?**
  _382 weakly-connected nodes found - possible documentation gaps or missing edges._