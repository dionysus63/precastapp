# Graph Report - precastapp  (2026-10-03)

## Corpus Check
- 755 files · ~476,179 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 3, .mdc 2, .example 1)

## Summary
- 8884 nodes · 26172 edges · 208 communities (155 shown, 53 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 226 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `88c570f2`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app/products/actions.ts
- rect-structure.ts
- _
- ConfigNamespace
- XFAObject
- .getOperatorList
- structure-workbook.ts
- rect-structure-workbook.ts
- ContentObject
- rect-template-pdf.ts
- DeliveryTicketEditor
- .add
- drill-sheet-template-pdf.ts
- QuoteForm
- quote-form.tsx
- ref_fs
- job-structure-workflow.ts
- invoice-pdf-fill.ts
- job-structure-documents-service.ts
- product-kinds.ts
- compilerOptions
- .createDocumentHandler
- Annotation
- rect-sheet-persistence.ts
- .getUint16
- purchase-orders/actions.ts
- useConfirm
- galley-actions.ts
- delivery-ticket-pdf-line-items.ts
- drain-ring-matrix-utils.ts
- delivery-tickets/pdf-actions.ts
- drill-sheet-preview.tsx
- scripts
- job-detail-mapper.ts
- build
- CFFCompiler
- translatePrismaError
- quote-line-items-table.tsx
- formatQuantity
- rect-sheet-detail-view.tsx
- drill-sheet.ts
- .success
- inventory/page.tsx
- warn
- structures/actions.ts
- drill-sheet-form.tsx
- shipping/actions.ts
- XMLParserBase
- app_generated_prisma_client
- dependencies
- job-structure-import-dialog.tsx
- app_generated_prisma_client_prisma
- BulkLoadPlanner
- postcss.config.mjs
- contact-actions.ts
- invoices/actions.ts
- quote-mapper.ts
- Handy Commands — Precast App
- devDependencies
- withDatabaseRetry
- delivery-ticket-editor.tsx
- PsWasmCompiler
- quote-pdf-line-items.ts
- rect-sheet-detail.ts
- bulk-load-planner.tsx
- app_generated_prisma_client_prismaclient
- delivery-ticket-pdf-fill.ts
- settings/products/page.tsx
- delivery-ticket-pdf-pickup.ts
- PipeModal
- XmlObject
- delivery-fulfillment.ts
- job-structure-detail-mapper.ts
- Job Structure Production Workflow
- casting-utils.ts
- AGENTS.md
- walk-ins-board.tsx
- jobs-list.tsx
- quote-pdf-data.ts
- ._bindElement
- ChunkedStreamManager
- updateQuote
- ring-builder-settings-form.tsx
- XFAFactory
- zone-map.tsx
- paginateQuoteLineItems
- calculateSHA256
- AnnotationBorderStyle
- input.tsx
- Precast Ops desktop updates
- Ps
- GlobalColorSpaceCache
- reconcile/page.tsx
- quote-pdf-fill.ts
- app-settings.ts
- quote-pdf-line-items.test.ts
- product-form.tsx
- generate-invoice-templates.ts
- send-actions.ts
- XhtmlObject
- shipping-zones/actions.ts
- job-files-browser.tsx
- createRowId
- plan-sheet-actions.ts
- windows-explorer.ts
- files/actions.ts
- product-export.ts
- vitest
- Office deployment — single Windows server + UNC job folders
- Office rollout checklist
- product-taxonomy.server.ts
- react
- SimpleDOMNode
- price-list-service.ts
- .push
- getStringOption
- delivery-schedule-pdf-html.ts
- rich-text.ts
- Deployment server info checklist
- delivery-ticket-pdf-html.ts
- Troubleshooting
- .#B
- structure-workbook-plan-takeoff.tsx
- Precast Ops
- calibrate-rect-templates.ts
- receiving-utils.ts
- XFAAttribute
- ring-builder-modal.tsx
- quote-form-data.ts
- Builder
- customer-mapper.ts
- MetadataParser
- main.mjs
- submittal-package.ts
- Dict
- ExclGroup
- ChunkedStream
- StringObject
- unreachable
- .#Se
- NullOptimizer
- package.json
- prisma.ts
- BasePDFStreamReader
- ColorSpace
- printPdfUrl
- drill-sheet-detail.ts
- jobs/actions.ts
- ToUnicodeMap
- custom-structure-import.ts
- CMap
- delivery-tickets/actions.ts
- product-mapper.ts
- delivery-ticket-pdf-data.ts
- DeviceRgbCS
- generate-circular-import-template.mjs
- Datasets
- rect-bulk-grid.tsx
- Name
- .checkAndRepair
- signature_Signature
- Stylesheet
- LabCS
- xdp_Xdp
- calculateSHA512
- next
- .getRgbBuffer
- customer-name-similarity.ts
- SingleIntersector
- process-app-icon.ps1
- .getTextContent
- Color
- Phase 6 — Electron client (staff PCs)
- shadow
- MathClamp
- allowScripts
- Security posture: internal, trusted-network tool
- PDFImage
- ta
- IntegerObject
- RegionalImageCache

## God Nodes (most connected - your core abstractions)
1. `_` - 1180 edges
2. `withDatabaseRetry()` - 349 edges
3. `requirePermission()` - 335 edges
4. `next` - 209 edges
5. `XFAObject` - 206 edges
6. `SectionCard()` - 195 edges
7. `warn()` - 173 edges
8. `DashboardShell()` - 162 edges
9. `react` - 151 edges
10. `ConfigNamespace` - 141 edges

## Surprising Connections (you probably didn't know these)
- `Authentication today` --references--> `signInWithPassword()`  [INFERRED]
  AGENTS.md → app/login/actions.ts
- `Quote → JobStructure linking` --references--> `linkJobStructuresFromQuote()`  [INFERRED]
  docs/STRUCTURE_PRODUCTION_WORKFLOW.md → lib/job-structure-workflow.ts
- `handleImport()` --calls--> `importContacts()`  [EXTRACTED]
  components/customers/bulk-contact-paste-form.tsx → app/customers/contact-actions.ts
- `handleDiscardSavedPlan()` --calls--> `discardSavedLoadPlan()`  [EXTRACTED]
  components/delivery-tickets/bulk-load-planner.tsx → app/delivery-tickets/actions.ts
- `AllDeliveryTicketsPage()` --indirect_call--> `mapDbDeliveryTicketToListRow()`  [INFERRED]
  app/delivery-tickets/all/page.tsx → lib/delivery-ticket-mapper.ts

## Import Cycles
- None detected.

## Communities (208 total, 53 thin omitted)

### Community 0 - "app/products/actions.ts"
Cohesion: 0.07
Nodes (52): assertAllAssemblyComponentCodesExist(), BulkImportRow, bulkImportUpdateData(), collectAssemblyBomImportRows(), collectReferencedComponentCodes(), createFormProfileReader(), createProduct(), findExistingProductCodesAction() (+44 more)

### Community 1 - "rect-structure.ts"
Cohesion: 0.09
Nodes (39): SumpMode, annotateRectOpeningSections(), ComputedRectSection, computeHorizontalGeometry(), computeRectDefaultSumpFeet(), computeRectPricing(), computeRectStructure(), computeRectWallHeightFeet() (+31 more)

### Community 2 - "_"
Cohesion: 0.01
Nodes (338): _, 1072(), 1108(), 1148(), 116(), 1291(), 1385(), 1548() (+330 more)

### Community 3 - "ConfigNamespace"
Cohesion: 0.01
Nodes (98): Acrobat, Acrobat7, ADBE_JSConsole, ADBE_JSDebugger, AddSilentPrint, AddViewerPreferences, Agent, Attributes (+90 more)

### Community 5 - "XFAObject"
Cohesion: 0.01
Nodes (72): Arc, Assist, Barcode, Bind, BindItems, Bookend, Border, Break (+64 more)

### Community 6 - ".getOperatorList"
Cohesion: 0.04
Nodes (28): 4576(), addCachedImageOps(), assert(), CheckedOperatorList, EvalState, getEncoding(), getStandardFontName(), getTilingPatternIR() (+20 more)

### Community 7 - "structure-workbook.ts"
Cohesion: 0.07
Nodes (69): DrillSheetTemplateOption, formatQuoteCurrency(), pipeSizesForMaterial(), StructureWorkbookDefaultsPanel(), StructureWorkbookDefaultsPanelProps, uniquePipeMaterials(), createInitialWorkbookRows(), groupToneClasses() (+61 more)

### Community 9 - "rect-structure-workbook.ts"
Cohesion: 0.07
Nodes (58): JobSheetImportCandidate, completeRectDrillSheets(), JobSheetImportDialog(), JobSheetImportDialogProps, CompleteDrillSheetEntry, CompleteDrillSheetsClient(), handleCreate(), CompleteDrillSheetsClientProps (+50 more)

### Community 10 - "ContentObject"
Cohesion: 0.02
Nodes (25): handleDeliverAll(), AlwaysEmbed, BehaviorOverride, BooleanElement, ContentObject, DateElement, DateTime, DateTimeSymbols (+17 more)

### Community 11 - "rect-template-pdf.ts"
Cohesion: 0.09
Nodes (40): sectionJointHeightsFeet(), baseOffsetText(), BLACK, buildFlaps(), buildRectSheetFieldMap(), CalloutLayout, calloutSlotTops(), consumeMarkerField() (+32 more)

### Community 12 - "DeliveryTicketEditor"
Cohesion: 0.06
Nodes (51): DeliveryTicketEditor(), addExtraCustomLine(), addExtraProduct(), addWalkInLine(), applyAutoRingAssignment(), applyPickupListPrices(), buildPayload(), buildSplitDraft() (+43 more)

### Community 13 - ".add"
Cohesion: 0.04
Nodes (22): Commands, compileCharString(), bezierCurveTo(), lineTo(), moveTo(), CompiledFont, compileGlyf(), lineTo() (+14 more)

### Community 14 - "drill-sheet-template-pdf.ts"
Cohesion: 0.06
Nodes (56): DrillSheetPreviewMeta, ComputedOpening, DrillSheetResult, flattenPdfForms(), applyTemplateFieldFonts(), baseSectionHeightFeet(), buildDiagramLayout(), buildDrillSheetFieldMap() (+48 more)

### Community 15 - "QuoteForm"
Cohesion: 0.07
Nodes (49): loadJobCustomStructureImportCandidates(), toPlainNumberString(), createDefaultCustomStructureRow(), createLineId(), PipeModal, QuoteForm(), addCategoryLine(), addLineItem() (+41 more)

### Community 16 - "quote-form.tsx"
Cohesion: 0.04
Nodes (54): QuoteSaveDestination, JobCustomStructureImportCandidate, AddLineModalType, CustomStructureRow, FlashMessage, handleAddPipeUnitPrices(), QuoteFormProps, quoteCompactInputClassName (+46 more)

### Community 17 - "ref_fs"
Cohesion: 0.05
Nodes (57): GET(), geistMono, geistSans, generateMetadata(), RootLayout(), CONTENT_TYPES, RouteContext, UPDATES_DIR (+49 more)

### Community 18 - "job-structure-workflow.ts"
Cohesion: 0.05
Nodes (61): addJobBidder(), awardJob(), generateQuotesFromMaster(), removeJobBidder(), CreateQuoteInput, buildContactMapForGenerate(), buildDefaultContactMap(), JobBiddingPanel() (+53 more)

### Community 19 - "invoice-pdf-fill.ts"
Cohesion: 0.06
Nodes (48): GET(), parseDateParam(), GET(), parseDateParam(), GET(), RouteContext, GET(), parseVariant() (+40 more)

### Community 20 - "job-structure-documents-service.ts"
Cohesion: 0.09
Nodes (37): pathExists(), resolveUniqueFilePath(), sanitizeFileName(), assertPathUnderJobFolder(), assertPathUnderRoot(), normalizePath(), pathsEqual(), pathStartsWith() (+29 more)

### Community 21 - "product-kinds.ts"
Cohesion: 0.06
Nodes (39): parseCastingBomPayload(), parseBulkPaste(), presetPreviewColumns(), parseAdsPipeJointType(), parseCastingPieceRole(), assertSanitaryDrainRingAllowed(), formatSanitaryDrainRingDiametersLabel(), isRecognizedBulkRingStyle() (+31 more)

### Community 22 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 23 - ".createDocumentHandler"
Cohesion: 0.03
Nodes (36): AbortException, AnnotationFactory, arrayBuffersToBytes(), BasePdfManager, BasePDFStream, addPageDict(), DocumentData, InvalidPDFException (+28 more)

### Community 24 - "Annotation"
Cohesion: 0.08
Nodes (3): Annotation, ObjectLoader, StreamsSequenceStream

### Community 25 - "rect-sheet-persistence.ts"
Cohesion: 0.09
Nodes (42): importJobStructuresFromConfigs(), CompleteRectDrillSheetsResult, createDrillSheetsFromQuote(), buildCalcData(), buildCastingCreate(), buildOpeningsCreate(), buildSectionsCreate(), createJobStructureFromPayload() (+34 more)

### Community 26 - ".getUint16"
Cohesion: 0.05
Nodes (24): buildComponentData(), CompositeGlyph, Contour, decodeScan(), decodeBlock(), decodeHuffman(), decodeMcu(), readBit() (+16 more)

### Community 27 - "purchase-orders/actions.ts"
Cohesion: 0.08
Nodes (34): createPurchaseOrder(), parseDate(), parseLinesFromFormData(), parseSaveInput(), persistVendorQuote(), revalidatePurchaseOrderPaths(), updatePurchaseOrder(), handleSubmit() (+26 more)

### Community 28 - "useConfirm"
Cohesion: 0.08
Nodes (32): deleteCustomer(), GlobalError(), isStaleDeploymentError(), NotFound(), FormTypeahead(), closeDropdown(), handleContainerBlur(), handleKeyDown() (+24 more)

### Community 29 - "galley-actions.ts"
Cohesion: 0.13
Nodes (26): injectGalleyFamilyOptions(), applyGalleyBreakdown(), ApplyGalleyBreakdownResult, BREAKDOWN_STATUSES, BreakdownDialog(), submit(), formatMixSummary(), GalleyBreakdownBanner() (+18 more)

### Community 30 - "delivery-ticket-pdf-line-items.ts"
Cohesion: 0.11
Nodes (31): COL_DESC_WIDTH, COL_DESC_X, COL_ITEM_NUM_WIDTH, COL_ITEM_NUM_X, COL_QTY_WIDTH, COL_QTY_X, DEFAULT_TABLE_LAYOUT, DeliveryTicketTableLayout (+23 more)

### Community 31 - "drain-ring-matrix-utils.ts"
Cohesion: 0.07
Nodes (39): DrainRingMatrixRows(), DrainRingMatrixRowsProps, DrainRingStyleTable(), DrainRingStyleTableProps, FEET_STAT_COLUMNS, ringStockClassName(), ringStockLabel(), allocateRingsAcrossPools() (+31 more)

### Community 32 - "delivery-tickets/pdf-actions.ts"
Cohesion: 0.10
Nodes (42): DeliveryTicketPdfPreviewResult, generateDeliveryTicketPdf(), GenerateDeliveryTicketPdfResult, PrintDeliveryTicketDirectResult, saveDeliverySchedulePdf(), SaveDeliverySchedulePdfResult, generateDrillSheetPdf(), GenerateDrillSheetPdfResult (+34 more)

### Community 33 - "drill-sheet-preview.tsx"
Cohesion: 0.11
Nodes (41): CalcRow(), DrillSheetPreview(), DrillSheetPreviewProps, feet(), HeaderRow(), PlanDiagram(), PreviewPanel(), angleToClockPosition() (+33 more)

### Community 34 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, build, db:seed, db:sync-files, deploy:build, deploy:check, deploy:start, deploy:update (+11 more)

### Community 35 - "job-detail-mapper.ts"
Cohesion: 0.03
Nodes (113): updateJobCustomerAction(), updateJobStatusAction(), listCustomersForBidList(), JobTabContent(), JobTabContentProps, JobDetailPage(), JobDetailPageProps, resolveTab() (+105 more)

### Community 36 - "build"
Cohesion: 0.11
Nodes (18): build, appId, directories, extraResources, icon, nsis, productName, publish (+10 more)

### Community 37 - "CFFCompiler"
Cohesion: 0.05
Nodes (15): CFF, CFFCharset, CFFCompiler, CFFDict, CFFFDSelect, CFFHeader, CFFIndex, CFFOffsetTracker (+7 more)

### Community 38 - "translatePrismaError"
Cohesion: 0.18
Nodes (21): createSheetPdfSetAction(), deleteSheetPdfSetAction(), deleteSheetPdfSetFileAction(), parseBooleanField(), renameSheetPdfSetAction(), revalidate(), uploadSheetPdfSetFileAction(), SHAPE_LABELS (+13 more)

### Community 39 - "quote-line-items-table.tsx"
Cohesion: 0.09
Nodes (36): CustomStructureCostBreakdown(), addItem(), CustomStructureCostBreakdownProps, CustomStructureDetailBreakdown(), CustomStructurePricingFooter(), CustomStructurePricingFooterProps, buildCreateQuoteInput(), autoResizeTextarea() (+28 more)

### Community 40 - "formatQuantity"
Cohesion: 0.17
Nodes (17): saveDailyProductionDay(), DailyProductionPage(), DailyProductionPageProps, DailyProductionEntry(), save(), DailyProductionEntryProps, localToday(), shiftDate() (+9 more)

### Community 41 - "rect-sheet-detail-view.tsx"
Cohesion: 0.10
Nodes (30): aboveFloorText(), fmtElevation(), InfoRow(), placementText(), RectSheetDetailView(), RectSheetDetailViewProps, Stat(), wholeInches() (+22 more)

### Community 42 - "drill-sheet.ts"
Cohesion: 0.07
Nodes (38): annotateOpeningSections(), buildSolverHoles(), compareCost(), computeBaseTopToOpeningBottomInches(), computeDefaultSumpFeet(), computeDrillSheet(), ComputedSection, ComputedWeights (+30 more)

### Community 43 - ".success"
Cohesion: 0.04
Nodes (45): applyAssist(), ariaLabel(), bf, Caption, CheckButton, checkDimensions(), ChoiceList, computeBbox() (+37 more)

### Community 44 - "inventory/page.tsx"
Cohesion: 0.03
Nodes (120): CustomerDetailPage(), CustomerDetailPageProps, AGGREGATE_SORT_COLUMNS, CONTACT_SORT_COLUMNS, ContactSortColumn, CUSTOMER_SORT_FIELDS, CustomerSortColumn, CustomersPage() (+112 more)

### Community 45 - "warn"
Cohesion: 0.03
Nodes (45): addHex(), BinaryCMapReader, BinaryCMapStream, addPageError(), CipherTransform, createBuiltInCMap(), createDataNode(), createValidAbsoluteUrl() (+37 more)

### Community 46 - "structures/actions.ts"
Cohesion: 0.07
Nodes (59): assertDiametersHaveMolds(), createStructureTemplate(), duplicateStructureTemplate(), handlePrismaError(), parseTemplatePayload(), resolvePriceListIdForTemplateSave(), saveRectPriceEntry(), updateStructureTemplate() (+51 more)

### Community 47 - "drill-sheet-form.tsx"
Cohesion: 0.03
Nodes (92): buildCommittedPreview(), CommittedOpeningNumbers, CommittedPreviewNumbers, connectionOptions, createOpening(), DiameterConfigOption, DrillSheetCastingOption, DrillSheetForm() (+84 more)

### Community 48 - "shipping/actions.ts"
Cohesion: 0.12
Nodes (30): lookupShippingRate(), lookupShippingRateAtPoint(), resolveShippingRateForPoint(), ShippingLookupResult, ShippingLookupSuccess, suggestShippingAddresses(), ShippingRatesPage(), AddressAutocomplete() (+22 more)

### Community 50 - "XMLParserBase"
Cohesion: 0.14
Nodes (3): XFAParser, XMLParserBase, skipWs()

### Community 51 - "app_generated_prisma_client"
Cohesion: 0.03
Nodes (104): RouteContext, RouteContext, GET(), RouteContext, RouteContext, RouteContext, DeliveryTicketDetailPage(), DeliveryTicketDetailPageProps (+96 more)

### Community 52 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, leaflet, next, nodemailer, pdf-lib, @pdf-lib/fontkit, pdf-to-printer, pdfjs-dist (+11 more)

### Community 53 - "job-structure-import-dialog.tsx"
Cohesion: 0.10
Nodes (30): JobStructureImportEntry, JobStructureImportResult, loadJobStructureImportOptions(), buildPreview(), Cell, detectShape(), ImportOptions, JobStructureImportButton() (+22 more)

### Community 54 - "app_generated_prisma_client_prisma"
Cohesion: 0.08
Nodes (24): decimal(), DiameterConfigPayload, parseDiameterConfigPayload(), parsePrice(), saveStructureDiameterConfigs(), combinedMaterial(), decimal(), parsePipeOpeningsPayload() (+16 more)

### Community 55 - "BulkLoadPlanner"
Cohesion: 0.13
Nodes (30): buildRows(), BulkLoadPlanner(), addLoad(), autoRingCount(), buildLoadLines(), buildPayload(), castingGroupIsEven(), castingSetsForLoad() (+22 more)

### Community 57 - "contact-actions.ts"
Cohesion: 0.14
Nodes (28): addCustomerContact(), BulkContactDbState, BulkContactImportRow, CONTACT_ROLES, CustomerContactInput, deleteCustomerContact(), importContacts(), ImportContactsResult (+20 more)

### Community 64 - "invoices/actions.ts"
Cohesion: 0.13
Nodes (23): computeInvoiceFinancials(), deleteDraftInvoice(), DraftInvoiceLineInput, EDITABLE_INVOICE_STATUSES, finalizeAllDraftInvoices(), finalizeInvoices(), InvoiceListRow, markInvoicePaid() (+15 more)

### Community 65 - "quote-mapper.ts"
Cohesion: 0.08
Nodes (32): QuotePreviewPage(), QuotePreviewPageProps, bidDueUrgencyFor(), deriveOriginalQuoteNumber(), deriveSupersededBy(), formatLineNotes(), formatQuoteDate(), formatQuoteDateLong() (+24 more)

### Community 66 - "Handy Commands — Precast App"
Cohesion: 0.15
Nodes (13): App (Next.js), Browse data, Daily workflow, Database backups, Electron desktop client, Git / GitHub (optional), Handy Commands — Precast App, Office deployment (Windows server) (+5 more)

### Community 67 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, electron, electron-builder, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+8 more)

### Community 68 - "withDatabaseRetry"
Cohesion: 0.04
Nodes (121): GET(), parseCopyParam(), RouteContext, GET(), GET(), INLINE_CONTENT_TYPES, RouteContext, GET() (+113 more)

### Community 69 - "delivery-ticket-editor.tsx"
Cohesion: 0.04
Nodes (81): UpdateTicketDriverResult, DeliveryTicketsPage(), startOfToday(), DeliveryTicketEditorProps, EditorLine, formatWeight(), JobOption, ProductOption (+73 more)

### Community 70 - "PsWasmCompiler"
Cohesion: 0.05
Nodes (25): ast_Parser, buildPostScriptWasmFunction(), encodeASCIIString(), lexer_Lexer, _nodesEqual(), parsePostScriptFunction(), PsArgNode, PsBinaryNode (+17 more)

### Community 71 - "quote-pdf-line-items.ts"
Cohesion: 0.12
Nodes (26): COL_DESC_WIDTH, COL_DESC_X, COL_ITEM_NUM_WIDTH, COL_ITEM_NUM_X, COL_QTY_WIDTH, COL_QTY_X, COL_TOTAL_WIDTH, COL_TOTAL_X (+18 more)

### Community 72 - "rect-sheet-detail.ts"
Cohesion: 0.15
Nodes (23): DrillSheetDetailPage(), DrillSheetDetailPageProps, loadJobSheetNav(), RectSheetDetail(), DeleteDrillSheetButton(), DeleteDrillSheetButtonProps, DrillSheetJobNav(), JobSheetNavEntry (+15 more)

### Community 73 - "bulk-load-planner.tsx"
Cohesion: 0.08
Nodes (26): DeliveryTicketLineInput, PlannedLoadInput, SavePlannedLoadsInput, BulkLoadPlannerProps, CategoryRow, DeletedTicket, ExcludedLine, ExistingTicketSummary (+18 more)

### Community 74 - "app_generated_prisma_client_prismaclient"
Cohesion: 0.15
Nodes (17): DEFAULT_APP_SETTINGS_DATA, DEFAULT_SEED_LOGO_PDF_PATH, decodeApiKey(), PrismaDevPayload, resolveDatabaseUrl(), resolvePrismaDevPayload(), resolveShadowDatabaseUrl(), databaseUrl (+9 more)

### Community 75 - "delivery-ticket-pdf-fill.ts"
Cohesion: 0.14
Nodes (23): DeliveryTicketContentPage, DeliveryTicketPdfFillOptions, buildContentPageBytes(), buildCopyPdfBytes(), fillAcroFormFields(), fitTermsField(), generateDeliveryTicketCopyPdfBytes(), getDeliveryTicketPdfFillOptions() (+15 more)

### Community 76 - "settings/products/page.tsx"
Cohesion: 0.19
Nodes (20): createProductCategoryFormAction(), createProductSubcategoryFormAction(), deleteProductCategory(), deleteProductSubcategory(), revalidateProductTaxonomyPaths(), updateProductCategoryFormAction(), updateProductSubcategoryFormAction(), ProductCatalogSettingsPage() (+12 more)

### Community 77 - "delivery-ticket-pdf-pickup.ts"
Cohesion: 0.14
Nodes (17): FONT_SIZE, LINE_HEIGHT, ROW_PADDING, wrapText(), applyPickupTicketArtwork(), BAND_CAPTIONS, BAND_COLS, BLACK (+9 more)

### Community 78 - "PipeModal"
Cohesion: 0.19
Nodes (15): createDefaultQuoteRow(), createRowId(), PipeModal(), handleAddQuoteLines(), handleAddUnitPricesToDescription(), handleClose(), resetModal(), pipeTypeLabel() (+7 more)

### Community 80 - "delivery-fulfillment.ts"
Cohesion: 0.09
Nodes (42): AdsPipeJointType, adsPipeJointTypeFormOptions, adsPipeJointTypeLabels, formatAdsPipeJointTypeLabel(), normalizeAdsPipeJointType(), AdsPipeOption, allLineageIds(), buildFulfillmentFromContext() (+34 more)

### Community 81 - "job-structure-detail-mapper.ts"
Cohesion: 0.05
Nodes (57): BulkAttachPage(), mapStructure(), needsDrillSheetWhere, ProductionPage(), structureInclude, JobProgressLine, JobProgressSummary, JobProgressView (+49 more)

### Community 82 - "Job Structure Production Workflow"
Cohesion: 0.33
Nodes (5): Dates, Delivery eligibility, Job Structure Production Workflow, Quote → JobStructure linking, Server actions

### Community 83 - "casting-utils.ts"
Cohesion: 0.13
Nodes (12): CastingAssemblyBomImportRow, castingAssemblyBomRoleOrder, castingAssemblyOptionalBomRoles, castingAssemblyRequiredBomRoles, CastingBomRowInput, CastingComponentLookup, CastingComponentOption, castingPieceRoleFormOptions (+4 more)

### Community 84 - "AGENTS.md"
Cohesion: 0.38
Nodes (4): Codebase exploration: use graphify first, Prisma / Database Rules, Project context, This is NOT the Next.js you know

### Community 85 - "walk-ins-board.tsx"
Cohesion: 0.23
Nodes (14): MarkPickedUpControl(), handleConfirm(), MarkPickedUpControlProps, BadgeVariant, CalledInPickupCard(), CompletedPickupCard(), dateLine(), itemsPaymentLine() (+6 more)

### Community 86 - "jobs-list.tsx"
Cohesion: 0.19
Nodes (13): toggleJobFavorite(), JobFavoriteStar(), handleClick(), JobFavoriteStarProps, JobsFavorites, JobsListFilters, JobsListProps, JobsTable (+5 more)

### Community 87 - "quote-pdf-data.ts"
Cohesion: 0.24
Nodes (13): QuoteLineItemRecord, QuoteRecord, blankOr(), buildQuoteFormData(), formatDateForPdf(), formatMoneyForPdf(), formatPageNumber(), formatQuoteNumberForPdf() (+5 more)

### Community 90 - "updateQuote"
Cohesion: 0.33
Nodes (12): assertGalleyFamiliesExist(), computeQuoteFinancials(), createQuote(), parseOptionalDate(), quoteSaveRedirectPath(), toDecimal(), toOptionalDecimal(), updateQuote() (+4 more)

### Community 91 - "ring-builder-settings-form.tsx"
Cohesion: 0.24
Nodes (8): buildEditableFromConfig(), createMappingId(), EditableMapping, parseExtraSubcategoriesText(), RingBuilderSettingsForm(), RingBuilderSettingsFormProps, SubcategoryPicker(), isTopLevelRingStyle()

### Community 93 - "zone-map.tsx"
Cohesion: 0.24
Nodes (9): ClickCapture(), FlyToPin(), ZoneMap(), ZoneMapProps, LatLng, PolygonRing, ResolvableZone, leaflet (+1 more)

### Community 94 - "paginateQuoteLineItems"
Cohesion: 0.25
Nodes (6): availableHeight(), paginateQuoteLineItems(), QuoteDrawLineItem, QuoteLineItemPageSlice, suffixFitsMain(), mockFont

### Community 95 - "calculateSHA256"
Cohesion: 0.36
Nodes (8): calculate_sha256_ch(), calculate_sha256_littleSigma(), calculate_sha256_littleSigmaPrime(), calculate_sha256_maj(), calculate_sha256_sigma(), calculate_sha256_sigmaPrime(), calculateSHA256(), rotr()

### Community 97 - "input.tsx"
Cohesion: 0.40
Nodes (3): inputClassName, InputProps, textareaClassName

### Community 98 - "Precast Ops desktop updates"
Cohesion: 0.40
Nodes (4): Precast Ops desktop updates, Publish a desktop update (from the dev PC), Verify (from any office PC), Which machine does what

### Community 102 - "quote-pdf-fill.ts"
Cohesion: 0.19
Nodes (15): removeFlattenLeftovers(), DbQuoteForPdf, ADDRESS_FIELD_NAMES, buildQuotePageBytes(), fillAcroFormFields(), fitProjectAddressFields(), generateQuotePdfBytes(), getQuoteContinuationTemplatePath() (+7 more)

### Community 104 - "app-settings.ts"
Cohesion: 0.04
Nodes (123): GET(), DeliveryTicketPreviewPage(), DeliveryTicketPreviewPageProps, PREVIEW_ORIGINS, DeliveryTicketSubmittalPreviewPage(), DeliveryTicketSubmittalPreviewPageProps, QuoteDetailPage(), QuoteDetailPageProps (+115 more)

### Community 105 - "quote-pdf-line-items.test.ts"
Cohesion: 0.23
Nodes (10): drawCenteredInColumn(), drawLineItemRow(), drawRightAlignedInColumn(), drawRowSeparator(), drawTextAt(), drawTextUnderline(), measureDescriptionLines(), measureRowHeight() (+2 more)

### Community 106 - "product-form.tsx"
Cohesion: 0.07
Nodes (35): CastingComponentPickerOption, CastingSupplierOption, drainRingDiameterOptions, ProductForm(), handleCategoryChange(), handleProductKindChange(), handleProductTypeChange(), handleRingDiameterChange() (+27 more)

### Community 108 - "generate-invoice-templates.ts"
Cohesion: 0.12
Nodes (25): CONT_TABLE_BOTTOM_Y, MAIN_TABLE_BOTTOM_Y, addTextField(), BLACK, BOTTOM_BOX, buildTemplate(), Ctx, drawBox() (+17 more)

### Community 110 - "send-actions.ts"
Cohesion: 0.06
Nodes (58): findSupersededBy(), getSendQuoteDefaults(), getSendQuoteEmailConfigured(), OpenOutlookDraftResult, openQuoteInOutlook(), sendQuote(), SendQuoteDefaults, SendQuoteInput (+50 more)

### Community 111 - "XhtmlObject"
Cohesion: 0.03
Nodes (22): a, B, Body, br, Button, fixURL(), Html, _i (+14 more)

### Community 112 - "shipping-zones/actions.ts"
Cohesion: 0.18
Nodes (18): createShippingZone(), deleteShippingZone(), revalidateShippingZonePaths(), setYardLocation(), ShippingZoneInput, updateShippingZone(), ValidatedZone, validateZoneInput() (+10 more)

### Community 114 - "job-files-browser.tsx"
Cohesion: 0.07
Nodes (47): listJobFilesAction(), openJobFile(), revalidateFilesPaths(), syncJobFilesAction(), uploadJobFileAction(), openJobFolder(), EditJobPage(), EditJobPageProps (+39 more)

### Community 115 - "createRowId"
Cohesion: 0.10
Nodes (34): loadJobSheetImportCandidates(), RectImportDialog(), handleFile(), handlePasteParse(), RectImportDialogProps, DecimalLike, decimalToInput(), lowestInvertText() (+26 more)

### Community 117 - "plan-sheet-actions.ts"
Cohesion: 0.12
Nodes (25): GET(), RouteContext, EditQuoteStructuresPage(), EditQuoteStructuresPageProps, getPlanSheetForOpen(), getPlanSheetForQuote(), listJobConstructionPlanPdfs(), mapPlanSheetRow() (+17 more)

### Community 118 - "windows-explorer.ts"
Cohesion: 0.09
Nodes (32): ClientPathMapping, getClientPathMappings(), stripTrailingSeparators(), toClientOpenPath(), translateToClientPath(), assertDirectoryExists(), assertFileExists(), assertPathAccessible() (+24 more)

### Community 119 - "files/actions.ts"
Cohesion: 0.21
Nodes (21): ExplorerOpenResult, getJobFilesForBrowser(), openJobFolderCategory(), syncAllFiles(), SyncAllFilesResult, assertJobFolderPath(), assertPathUnderJobRoot(), getJobFileForOpen() (+13 more)

### Community 120 - "product-export.ts"
Cohesion: 0.09
Nodes (39): GET(), GET(), listStockProductsForTicket(), DetailField(), ProductDetailPage(), ProductDetailPageProps, searchProductsForQuoteForm(), DbClient (+31 more)

### Community 121 - "vitest"
Cohesion: 0.16
Nodes (15): calculateQuoteTotals(), Decimal, DecimalInstance, DecimalLike, toDecimal(), ComputedMoneyTotals, computeMoneyTotals(), MoneyLineInput (+7 more)

### Community 122 - "Office deployment — single Windows server + UNC job folders"
Cohesion: 0.11
Nodes (18): Architecture, End-to-end smoke test, Firewall, Important behavior, Install prerequisites, Office deployment — single Windows server + UNC job folders, Ongoing maintenance, Phase 1 — Prepare the Windows server (+10 more)

### Community 123 - "Office rollout checklist"
Cohesion: 0.12
Nodes (17): 1. Server URL for the desktop app, 2. First install on each staff PC, 3. Staff expectations, 4. Role walkthrough (recommended), 5. Backups, 6. Support contacts, 7. Post-rollout verification (first week), Database (nightly recommended) (+9 more)

### Community 124 - "product-taxonomy.server.ts"
Cohesion: 0.20
Nodes (19): ensureTaxonomyForBulkImport(), fetchActiveProductTaxonomy(), resolveTaxonomyByNamesForImport(), validateTaxonomySelection(), analyzeTaxonomyByNames(), buildCategoryFilterOptions(), buildSubcategoryFilterOptions(), categoryNameMatches() (+11 more)

### Community 125 - "react"
Cohesion: 0.04
Nodes (91): createJobFolder(), convertTicketToInvoice(), setQuoteTaxExempt(), CollapsibleSectionCard(), CollapsibleSectionCardProps, DeliveryTicketDetailContent(), DeliveryTicketDetailContentProps, formatLineType() (+83 more)

### Community 126 - "SimpleDOMNode"
Cohesion: 0.15
Nodes (3): DatasetXMLParser, SimpleDOMNode, SimpleXMLParser

### Community 127 - "price-list-service.ts"
Cohesion: 0.07
Nodes (47): EDIT_ORIGINS, EditDeliveryTicketPage(), EditDeliveryTicketPageProps, NewDeliveryTicketPage(), NewDeliveryTicketPageProps, TICKET_ORIGINS, listJobsWithQuotes(), BulkProductsPage() (+39 more)

### Community 128 - ".push"
Cohesion: 0.03
Nodes (47): 1181(), 7416(), 7642(), 9835(), addChildren(), ao, appendIfJavaScriptDict(), parseNestedOrder() (+39 more)

### Community 129 - "getStringOption"
Cohesion: 0.02
Nodes (37): BatchOutput, CalendarSymbols, CurrencySymbol, CurrencySymbols, Data, DatePattern, DatePatterns, Day (+29 more)

### Community 130 - "delivery-schedule-pdf-html.ts"
Cohesion: 0.22
Nodes (15): DeliveryScheduleTicket, JobDeliverySchedule, buildDeliverySchedulePdfHtml(), DeliveryScheduleVariant, escapeHtml(), formatDeliveryAddress(), formatFriendlyDate(), formatTime12() (+7 more)

### Community 131 - "rich-text.ts"
Cohesion: 0.15
Nodes (21): handleAddCustomStructure(), RichTextEditor(), applyCommand(), emitChange(), handlePaste(), RichTextEditorProps, getCompanyLogoDataUri(), buildQuotePdfHtml() (+13 more)

### Community 134 - "Deployment server info checklist"
Cohesion: 0.22
Nodes (9): Database, Deployment server info checklist, Electron client, File shares (UNC), Network, PDF generation, Post-deploy verification, Server (+1 more)

### Community 136 - "delivery-ticket-pdf-html.ts"
Cohesion: 0.35
Nodes (11): CompanyProfile, DeliveryTicketCopySettings, DeliveryTicketPdfView, getDeliveryTicketCopyTitles(), addressBlockHtml(), buildDeliveryTicketPdfHtml(), escapeHtml(), optionalNote() (+3 more)

### Community 137 - "Troubleshooting"
Cohesion: 0.33
Nodes (6): `P1001` — Can't reach database server, Password authentication failed, Port 3000 already in use, Prisma Studio — "Could not load schema metadata", Quote PDF — "Could not find Chrome" / browser not found, Troubleshooting

### Community 138 - ".#B"
Cohesion: 0.07
Nodes (12): BaseShading, buildMeshVertexData(), DefaultAppearanceEvaluator, DummyShading, FunctionBasedShading, getB(), IccColorSpace, LZWStream (+4 more)

### Community 139 - "structure-workbook-plan-takeoff.tsx"
Cohesion: 0.09
Nodes (32): pipeSizesForMaterial(), uniquePipeMaterials(), bearingFromDelta(), commitRow(), DragState, pdfToScreen(), PipePopup(), polarToScreenPoint() (+24 more)

### Community 141 - "Precast Ops"
Cohesion: 0.40
Nodes (5): Desktop shell (optional), Local development, Office deployment, Precast Ops, Project docs

### Community 142 - "calibrate-rect-templates.ts"
Cohesion: 0.05
Nodes (49): BASE_SLAB_ONLY_FIELDS, RECT_ELEVATION_WALL_MARKER_FIELD, RECT_EXPLODED_CENTER_MARKER_FIELD, RECT_EXPLODED_MARKER_FIELD, RECT_OPENING_ROWS, RECT_SHEET_TEMPLATE_FIELD_NAMES, RECT_TOP_SLAB_MARKER_FIELD, RECT_WEIGHT_PIECE_LINES (+41 more)

### Community 155 - "receiving-utils.ts"
Cohesion: 0.07
Nodes (54): InventoryProductSearchOption, resolveReceivingCategory(), saveInventoryAdjustment(), savePurchaseReceipt(), searchInventoryProducts(), InventoryReceiptsPage(), InventoryReceiptsPageProps, listOpenPurchaseOrdersForReceiving() (+46 more)

### Community 158 - "ring-builder-modal.tsx"
Cohesion: 0.09
Nodes (48): updateRingBuilderSettingsFormAction(), saveRingBuilderSettings(), createDefaultHeightPoolRow(), createRowId(), formatRingBuilderUnitPrice(), HeightPoolRow, initOtherInputs(), OtherProductInput (+40 more)

### Community 160 - "quote-form-data.ts"
Cohesion: 0.07
Nodes (44): ProfilePage(), reloadQuoteFormPriceOptions(), EditQuotePage(), EditQuotePageProps, NewQuotePage(), NewQuotePageProps, collectRingOtherSubcategories(), formatJobAddress() (+36 more)

### Community 161 - "Builder"
Cohesion: 0.17
Nodes (3): Builder, Empty, UnknownNamespace

### Community 162 - "customer-mapper.ts"
Cohesion: 0.05
Nodes (57): checkBulkCustomerDbDuplicates(), importCustomers(), mapBulkImportRow(), SimilarCustomerMatch, BulkContactPasteForm(), handleImport(), handleParsePreview(), parseBulkContactPaste() (+49 more)

### Community 165 - "main.mjs"
Cohesion: 0.07
Nodes (39): __dirname, getUserConfigPath(), loadConfig(), readJsonFile(), validateServerUrl(), buildApplicationMenu(), createWindow(), __dirname (+31 more)

### Community 168 - "submittal-package.ts"
Cohesion: 0.08
Nodes (50): getCompanyProfile(), getStockSubmittalsRoot(), getSubmittalsJobSubfolder(), dedupeSharedPdfObjects(), isSkipped(), rewriteRefs(), SKIP_TYPES, structuralKey() (+42 more)

### Community 172 - "Dict"
Cohesion: 0.04
Nodes (44): ButtonWidgetAnnotation, CaretAnnotation, CircleAnnotation, computeIDs(), createImage(), createImageDict(), createPNGLikeImage(), createRawImage() (+36 more)

### Community 173 - "ExclGroup"
Cohesion: 0.05
Nodes (11): addHTML(), Area, createLine(), ExclGroup, flushHTML(), getAvailableSpace(), getContainedChildren(), Image (+3 more)

### Community 175 - "StringObject"
Cohesion: 0.02
Nodes (43): Amd, AppearanceFilter, Base, Certificate, config_Picture, connection_set_Uri, ConnectionSet, ConnectionSetNamespace (+35 more)

### Community 179 - "unreachable"
Cohesion: 0.02
Nodes (21): Ascii85Stream, AsciiHexStream, BasePDFStreamRangeReader, BaseStream, BrotliStream, CCITTFaxStream, parseOperand(), DecodeStream (+13 more)

### Community 183 - "NullOptimizer"
Cohesion: 0.12
Nodes (3): NullOptimizer, QueueOptimizer, TextState

### Community 186 - "package.json"
Cohesion: 0.08
Nodes (24): eslintConfig, main, name, postcss, overrides, @hono/node-server, next, private (+16 more)

### Community 187 - "prisma.ts"
Cohesion: 0.04
Nodes (110): BulkCustomersPage(), BulkContactsPage(), EditCustomerPage(), EditCustomerPageProps, CustomerNotFound(), NewCustomerPage(), EDITABLE_STATUSES, EmptyState() (+102 more)

### Community 190 - "ColorSpace"
Cohesion: 0.13
Nodes (3): ColorSpace, DeviceGrayCS, PatternCS

### Community 192 - "printPdfUrl"
Cohesion: 0.04
Nodes (66): getDeliveryTicketPdfPreviewBase64(), loadTicketForPdf(), printDeliveryTicketDirect(), printDeliveryTicketSubmittalsDirect(), DraftBatchPreviewPage(), listPrintersForClient(), printServerPdfForClient(), ServerPrintResult (+58 more)

### Community 193 - "drill-sheet-detail.ts"
Cohesion: 0.10
Nodes (31): GET(), rectPreviewResponse(), RouteContext, DrillSheetPreviewPage(), DrillSheetPreviewPageProps, buildDrillSheetDetail(), buildDrillSheetFormValues(), decimalToInput() (+23 more)

### Community 194 - "jobs/actions.ts"
Cohesion: 0.08
Nodes (45): BulkImportRow, createCustomer(), CUSTOMER_STATUSES, CustomerRecordInput, findSimilarCustomers(), ImportCustomersResult, loadSimilarCustomerMatches(), parseCustomerFormData() (+37 more)

### Community 196 - "custom-structure-import.ts"
Cohesion: 0.14
Nodes (19): importCustomJobStructures(), JobCustomStructureImportButton(), handleFile(), handleImport(), parseGrid(), Cell, cellText(), ColumnMap (+11 more)

### Community 203 - "delivery-tickets/actions.ts"
Cohesion: 0.04
Nodes (71): assertQuoteLinkable(), buildLineCreates(), buildLinesPayload(), createDeliveryTicket(), DeliveryTicketActionResult, DeliveryTicketJobSearchOption, discardSavedLoadPlan(), generateDeliveryTicketSubmittalPackage() (+63 more)

### Community 204 - "product-mapper.ts"
Cohesion: 0.16
Nodes (17): formatProductKindBadgeLabel(), categoryVariant(), documentTypeLabel(), formatDecimal(), formatDocumentDate(), formatFileSize(), formatYesNo(), mapProductToDetail() (+9 more)

### Community 205 - "delivery-ticket-pdf-data.ts"
Cohesion: 0.15
Nodes (20): blankOr(), buildDeliveryTicketFormData(), computeTotalPieces(), DbCustomer, DbDeliveryTicketForPdf, DbJob, DELIVERY_TICKET_PDF_INCLUDE, DeliveryTicketPdfLineItem (+12 more)

### Community 209 - "generate-circular-import-template.mjs"
Cohesion: 0.06
Nodes (29): colWidths, EXAMPLE_ROWS, exampleSheet, HEADERS, INSTRUCTIONS, instructionsSheet, outDir, outPath (+21 more)

### Community 220 - "Datasets"
Cohesion: 0.20
Nodes (3): Datasets, datasets_Data, DatasetsNamespace

### Community 227 - "rect-bulk-grid.tsx"
Cohesion: 0.08
Nodes (52): BulkSheetRowInput, BulkSheetRowResult, bulkUpdateDrillSheets(), bulkUpdateRectSheets(), runBulkUpdate(), RectSheetFormValues, circularPayloadFromValues(), rectPayloadFromValues() (+44 more)

### Community 242 - ".checkAndRepair"
Cohesion: 0.04
Nodes (41): adjustMapping(), amendFallbackToUnicode(), buildToFontChar(), bytesToString(), CFFFont, compileFontInfo(), convertCidString(), createCmapTable() (+33 more)

### Community 248 - "LabCS"
Cohesion: 0.12
Nodes (3): CalGrayCS, DeviceCmykCS, LabCS

### Community 256 - "calculateSHA512"
Cohesion: 0.07
Nodes (21): AES128Cipher, AES256Cipher, AESBaseCipher, ARCFourCipher, calculateMD5(), calculateSHA384(), calculateSHA512(), ch() (+13 more)

### Community 260 - "next"
Cohesion: 0.05
Nodes (102): ProductInventoryPage(), ProductInventoryPageProps, CompactTable(), Home(), updatePurchaseOrderStatus(), CastingSuppliersPage(), CastingSuppliersPageProps, VendorsPageProps (+94 more)

### Community 261 - ".getRgbBuffer"
Cohesion: 0.13
Nodes (3): AlternateCS, DeviceRgbaCS, IndexedCS

### Community 267 - "customer-name-similarity.ts"
Cohesion: 0.36
Nodes (11): compactCustomerName(), compactSimilarity(), CustomerNameCandidate, getCustomerNameSimilarity(), jaccardSimilarity(), levenshteinDistance(), levenshteinRatio(), normalizeCustomerName() (+3 more)

### Community 281 - ".getTextContent"
Cohesion: 0.07
Nodes (22): AppearanceStreamEvaluator, BaseLocalCache, Intersector, LocalColorSpaceCache, LocalFunctionCache, LocalGStateCache, LocalImageCache, LocalTilingPatternCache (+14 more)

### Community 311 - "Phase 6 — Electron client (staff PCs)"
Cohesion: 0.25
Nodes (8): A. Server app updates (quotes, jobs, UI — most changes), B. Desktop shell updates (Electron auto-update), Build the installer, C. Server URL change only, Client updates (auto-update from server), Install on each desk PC, Local development with Electron, Phase 6 — Electron client (staff PCs)

### Community 315 - "shadow"
Cohesion: 0.03
Nodes (11): Catalog, clearGlobalCaches(), CmykICCBasedCS, ColorSpaceUtils, DataHandler, FeatureTest, fetchSync(), JpegStream (+3 more)

### Community 330 - "allowScripts"
Cohesion: 0.25
Nodes (8): allowScripts, electron@35.7.5, esbuild@0.28.1, prisma@7.8.0, @prisma/engines@7.8.0, puppeteer@25.1.0, sharp@0.34.5, unrs-resolver@1.12.2

### Community 333 - "Security posture: internal, trusted-network tool"
Cohesion: 0.67
Nodes (3): Authentication today, Authorization, Security posture: internal, trusted-network tool

### Community 336 - "PDFImage"
Cohesion: 0.10
Nodes (6): convertBlackAndWhiteToRGBA(), convertToRGBA(), ImageResizer, PDFFunction, PDFImage, toNumberArray()

### Community 347 - "ta"
Cohesion: 0.14
Nodes (13): 616(), 8745(), 9504(), 9565(), JBig2CCITTFaxImage, Jbig2Error, oa(), doRun() (+5 more)

### Community 369 - "IntegerObject"
Cohesion: 0.05
Nodes (13): AdjustData, AdobeExtensionLevel, CompressObjectStream, Copies, CurrentPage, IntegerObject, Level, MsgId (+5 more)

## Knowledge Gaps
- **1331 isolated node(s):** `RouteContext`, `RouteContext`, `RouteContext`, `RouteContext`, `RouteContext` (+1326 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2392 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **53 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_` connect `_` to `.push`, `calculateSHA512`, `getStringOption`, `ConfigNamespace`, `.getRgbBuffer`, `.getOperatorList`, `XFAObject`, `ContentObject`, `.#B`, `DeliveryTicketEditor`, `.add`, `SingleIntersector`, `.createDocumentHandler`, `Annotation`, `.getTextContent`, `.getUint16`, `XFAAttribute`, `Builder`, `Color`, `MetadataParser`, `CFFCompiler`, `.success`, `Dict`, `warn`, `ExclGroup`, `StringObject`, `ChunkedStream`, `XMLParserBase`, `unreachable`, `.#Se`, `NullOptimizer`, `shadow`, `BasePDFStreamReader`, `ColorSpace`, `MathClamp`, `ToUnicodeMap`, `PsWasmCompiler`, `RegionalImageCache`, `CMap`, `DeviceRgbCS`, `PDFImage`, `XmlObject`, `._bindElement`, `ChunkedStreamManager`, `ta`, `Datasets`, `XFAFactory`, `calculateSHA256`, `AnnotationBorderStyle`, `Ps`, `GlobalColorSpaceCache`, `Name`, `XhtmlObject`, `IntegerObject`, `.checkAndRepair`, `job-files-browser.tsx`, `signature_Signature`, `Stylesheet`, `xdp_Xdp`, `LabCS`, `SimpleDOMNode`?**
  _High betweenness centrality (0.371) - this node is a cross-community bridge._
- **Why does `buildPayload()` connect `DeliveryTicketEditor` to `bulk-load-planner.tsx`, `delivery-tickets/actions.ts`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `SectionCard()` connect `next` to `app/products/actions.ts`, `structure-workbook.ts`, `rect-structure-workbook.ts`, `DeliveryTicketEditor`, `QuoteForm`, `quote-form.tsx`, `job-structure-workflow.ts`, `receiving-utils.ts`, `useConfirm`, `quote-form-data.ts`, `customer-mapper.ts`, `job-detail-mapper.ts`, `translatePrismaError`, `formatQuantity`, `rect-sheet-detail-view.tsx`, `inventory/page.tsx`, `structures/actions.ts`, `drill-sheet-form.tsx`, `shipping/actions.ts`, `app_generated_prisma_client`, `contact-actions.ts`, `prisma.ts`, `invoices/actions.ts`, `jobs/actions.ts`, `withDatabaseRetry`, `delivery-ticket-editor.tsx`, `settings/products/page.tsx`, `jobs-list.tsx`, `app-settings.ts`, `shipping-zones/actions.ts`, `job-files-browser.tsx`, `product-export.ts`, `react`, `price-list-service.ts`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **What connects `RouteContext`, `RouteContext`, `RouteContext` to the rest of the system?**
  _1331 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app/products/actions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07071887784921099 - nodes in this community are weakly interconnected._
- **Should `rect-structure.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `_` be split into smaller, more focused modules?**
  _Cohesion score 0.010443864229765013 - nodes in this community are weakly interconnected._