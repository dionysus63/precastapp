# Graph Report - precastapp  (2026-10-04)

## Corpus Check
- 771 files · ~489,611 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: (none) 3, .mdc 2, .example 1)

## Summary
- 8970 nodes · 26705 edges · 218 communities (165 shown, 53 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 228 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d33ed513`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app/products/actions.ts
- rect-structure.ts
- _
- Annotation
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
- company-logo.ts
- quotes/actions.ts
- quotes/[id]/edit/page.tsx
- product-form.tsx
- product-kinds.ts
- compilerOptions
- unreachable
- .getTextContent
- rect-sheet-persistence.ts
- Glyph
- customer-name-similarity.ts
- rich-text.ts
- galley-actions.ts
- delivery-ticket-pdf-line-items.ts
- drain-ring-matrix-utils.ts
- delivery-tickets/pdf-actions.ts
- drill-sheet-preview.tsx
- scripts
- job-detail-mapper.ts
- build
- MathClamp
- ref_path
- custom-structure.ts
- formatQuantity
- rect-sheet-form.tsx
- drill-sheet.ts
- .success
- inventory/page.tsx
- CMap
- structure-import.ts
- drill-sheet-form.tsx
- rate-lookup.tsx
- XMLParserBase
- auth/constants.ts
- dependencies
- customer-utils.ts
- structures/actions.ts
- BulkLoadPlanner
- postcss.config.mjs
- CustomerContactsPanel
- .getUint16
- quote-mapper.ts
- Handy Commands — Precast App
- devDependencies
- withDatabaseRetry
- delivery-ticket-editor.tsx
- PsWasmCompiler
- quote-pdf-line-items.ts
- drill-sheets/[id]/page.tsx
- casting-ticket-lines.ts
- casting-utils.ts
- delivery-ticket-pdf-fill.ts
- invoices-tabs.tsx
- app-settings.ts
- pipe-modal.tsx
- XmlObject
- delivery-fulfillment.ts
- structure-utils.ts
- randomId
- calibrate-rect-templates.ts
- AGENTS.md
- walk-ins-board.tsx
- vitest
- inventory-service.ts
- ._bindElement
- jobs/actions.ts
- ChunkedStreamManager
- IntegerObject
- job-structure-import-dialog.tsx
- shipping-zones-manager.tsx
- files/actions.ts
- contact-actions.ts
- AnnotationBorderStyle
- input.tsx
- Precast Ops desktop updates
- pdf-text.ts
- JobBiddingPanel
- Builder
- pdf-lib
- SimpleDOMNode
- delivery-ticket-preview-content.tsx
- product-taxonomy.server.ts
- generate-invoice-templates.ts
- send-actions.ts
- XhtmlObject
- bulk-load-planner.tsx
- completeExplorerOpen
- zones.ts
- plan-sheet-actions.ts
- windows-explorer.ts
- bulk-attach-board.tsx
- product-export.ts
- invoice-draft-editor.tsx
- Office deployment — single Windows server + UNC job folders
- Office rollout checklist
- next
- react
- pdfjs-dist
- BulkContactPasteForm
- .push
- getStringOption
- delivery-schedule-pdf-html.ts
- app_generated_prisma_client_prismaclient
- Deployment server info checklist
- delivery-ticket-pdf-html.ts
- Troubleshooting
- .constructor
- structure-workbook-plan-takeoff.tsx
- Precast Ops
- printPdfUrl
- stringToBytes
- drill-sheet-preview-content.tsx
- ring-builder-settings-form.tsx
- JpegImage
- rect-sheet-detail.ts
- receiving-utils.ts
- Name
- ref_fs
- ring-builder-modal.tsx
- CalRGBCS
- getCurrentUser
- Job Structure Production Workflow
- customer-mapper.ts
- delivery-ticket-submittal-preview-content.tsx
- signature_Signature
- main.mjs
- Stylesheet
- lexer_Lexer
- submittal-package.ts
- GroupMemberReorderTable
- MetadataParser
- TextState
- Dict
- ExclGroup
- ChunkedStream
- StringObject
- invoice-mapper.ts
- SimpleGlyph
- ToUnicodeMap
- FormatError
- test-db.ts
- quotes/[id]/page.tsx
- BulkPasteForm
- NullOptimizer
- DeviceGrayCS
- .#Se
- package.json
- DashboardShell
- Ps
- GlobalColorSpaceCache
- RegionalImageCache
- Driver
- print-pdf-url.ts
- custom-structure-import.ts
- delivery-ticket-detail-content.tsx
- product-mapper.ts
- invoice-pdf-fill.ts
- rect-structure-import.ts
- rect-bulk-grid.tsx
- .checkAndRepair
- ConfigNamespace
- LabCS
- xdp_Xdp
- calculateSHA512
- SectionCard
- ColorSpace
- SingleIntersector
- process-app-icon.ps1
- DeviceRgbCS
- Color
- Phase 6 — Electron client (staff PCs)
- warn
- allowScripts
- Security posture: internal, trusted-network tool
- PDFImage
- ta

## God Nodes (most connected - your core abstractions)
1. `_` - 1180 edges
2. `withDatabaseRetry()` - 350 edges
3. `requirePermission()` - 336 edges
4. `XFAObject` - 206 edges
5. `next` - 200 edges
6. `SectionCard()` - 195 edges
7. `warn()` - 173 edges
8. `DashboardShell()` - 163 edges
9. `react` - 156 edges
10. `ConfigNamespace` - 141 edges

## Surprising Connections (you probably didn't know these)
- `Authentication today` --references--> `signInWithPassword()`  [INFERRED]
  AGENTS.md → app/login/actions.ts
- `Quote → JobStructure linking` --references--> `linkJobStructuresFromQuote()`  [INFERRED]
  docs/STRUCTURE_PRODUCTION_WORKFLOW.md → lib/job-structure-workflow.ts
- `handleDiscardSavedPlan()` --calls--> `discardSavedLoadPlan()`  [EXTRACTED]
  components/delivery-tickets/bulk-load-planner.tsx → app/delivery-tickets/actions.ts
- `AllDeliveryTicketsPage()` --indirect_call--> `mapDbDeliveryTicketToListRow()`  [INFERRED]
  app/delivery-tickets/all/page.tsx → lib/delivery-ticket-mapper.ts
- `DeliveryTicketsPage()` --indirect_call--> `mapDbDeliveryTicketToListRow()`  [INFERRED]
  app/delivery-tickets/page.tsx → lib/delivery-ticket-mapper.ts

## Import Cycles
- None detected.

## Communities (218 total, 53 thin omitted)

### Community 0 - "app/products/actions.ts"
Cohesion: 0.07
Nodes (49): parseJobFormData(), parseJobUpdateFormData(), assertAllAssemblyComponentCodesExist(), BulkImportRow, bulkImportUpdateData(), collectAssemblyBomImportRows(), collectReferencedComponentCodes(), createFormProfileReader() (+41 more)

### Community 1 - "rect-structure.ts"
Cohesion: 0.09
Nodes (38): SumpMode, annotateRectOpeningSections(), ComputedRectSection, computeHorizontalGeometry(), computeRectDefaultSumpFeet(), computeRectPricing(), computeRectStructure(), computeRectWallHeightFeet() (+30 more)

### Community 2 - "_"
Cohesion: 0.01
Nodes (335): _, 1072(), 1108(), 1148(), 116(), 1291(), 1385(), 1548() (+327 more)

### Community 3 - "Annotation"
Cohesion: 0.09
Nodes (3): Annotation, LinkAnnotation, PopupAnnotation

### Community 5 - "XFAObject"
Cohesion: 0.01
Nodes (71): Arc, Assist, Barcode, Bind, BindItems, Bookend, Border, Break (+63 more)

### Community 6 - ".getOperatorList"
Cohesion: 0.03
Nodes (32): 4576(), addCachedImageOps(), assert(), CheckedOperatorList, ColorSpaceUtils, EvalState, fetchBinaryData(), getPdfColorArray() (+24 more)

### Community 7 - "structure-workbook.ts"
Cohesion: 0.07
Nodes (67): pipeSizesForMaterial(), StructureWorkbookDefaultsPanel(), StructureWorkbookDefaultsPanelProps, uniquePipeMaterials(), createInitialWorkbookRows(), groupToneClasses(), pipeSizesForMaterial(), RowOpeningsEditor() (+59 more)

### Community 9 - "rect-structure-workbook.ts"
Cohesion: 0.05
Nodes (82): JobCustomStructureImportCandidate, JobSheetImportCandidate, JobSheetImportCandidates, loadJobCustomStructureImportCandidates(), loadJobSheetImportCandidates(), STATUS_LABELS, toPlainNumberString(), RectSheetCastingOption (+74 more)

### Community 10 - "ContentObject"
Cohesion: 0.02
Nodes (25): save(), AlwaysEmbed, BehaviorOverride, BooleanElement, ContentObject, DateElement, DateTime, DateTimeSymbols (+17 more)

### Community 11 - "rect-template-pdf.ts"
Cohesion: 0.07
Nodes (49): sectionJointHeightsFeet(), baseOffsetText(), BLACK, buildFlaps(), buildRectSheetFieldMap(), CalloutLayout, calloutSlotTops(), consumeMarkerField() (+41 more)

### Community 12 - "DeliveryTicketEditor"
Cohesion: 0.06
Nodes (51): DeliveryTicketEditor(), addExtraCustomLine(), addExtraProduct(), addWalkInLine(), applyAutoRingAssignment(), applyPickupListPrices(), buildPayload(), buildSplitDraft() (+43 more)

### Community 13 - ".add"
Cohesion: 0.02
Nodes (38): bytesToString(), CFF, CFFCharset, CFFCompiler, CFFDict, CFFFDSelect, CFFHeader, CFFIndex (+30 more)

### Community 14 - "drill-sheet-template-pdf.ts"
Cohesion: 0.06
Nodes (56): DrillSheetPreviewMeta, ComputedOpening, DrillSheetResult, flattenPdfForms(), applyTemplateFieldFonts(), baseSectionHeightFeet(), buildDiagramLayout(), buildDrillSheetFieldMap() (+48 more)

### Community 15 - "QuoteForm"
Cohesion: 0.06
Nodes (54): getCustomerForQuoteForm(), createDefaultCustomStructureRow(), createLineId(), QuoteForm(), addCategoryLine(), addLineItem(), addLineItems(), addNoteLine() (+46 more)

### Community 16 - "quote-form.tsx"
Cohesion: 0.03
Nodes (59): QuoteSaveDestination, reloadQuoteFormPriceOptions(), collectRingOtherSubcategories(), formatJobAddress(), loadPipeProductsForQuoteForm(), loadQuoteFormPriceOptions(), mapPipeProductToQuoteOption(), mapServiceProductsToOptions() (+51 more)

### Community 17 - "company-logo.ts"
Cohesion: 0.10
Nodes (34): GET(), geistMono, geistSans, generateMetadata(), RootLayout(), COMPANY_LOGO_FILENAME, companyLogoApiUrl(), getCompanyLogoPath() (+26 more)

### Community 18 - "quotes/actions.ts"
Cohesion: 0.06
Nodes (59): assertGalleyFamiliesExist(), computeQuoteFinancials(), createQuote(), CreateQuoteInput, CreateQuoteLineItemInput, DeleteQuoteResult, isQuoteNumberConflict(), parseOptionalDate() (+51 more)

### Community 19 - "quotes/[id]/edit/page.tsx"
Cohesion: 0.13
Nodes (22): DeliveryTicketPreviewPage(), DeliveryTicketPreviewPageProps, PREVIEW_ORIGINS, DeliveryTicketSubmittalPreviewPage(), DeliveryTicketSubmittalPreviewPageProps, DrillSheetPreviewPage(), DrillSheetPreviewPageProps, ProfilePage() (+14 more)

### Community 20 - "product-form.tsx"
Cohesion: 0.07
Nodes (30): CastingComponentPickerOption, CastingSupplierOption, drainRingDiameterOptions, ProductFormProps, ProductFormValues, bulkPasteColumnHeaders, bulkPasteExample, BulkProductPasteRow (+22 more)

### Community 21 - "product-kinds.ts"
Cohesion: 0.06
Nodes (44): findExistingProductCodesAction(), importProducts(), parseCastingBomPayload(), BulkPasteForm(), handleImport(), handleParsePreview(), lookUpExistingCodes(), formatMissingTaxonomySummary() (+36 more)

### Community 22 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 23 - "unreachable"
Cohesion: 0.02
Nodes (31): handleClear(), AbortException, arrayBuffersToBytes(), BasePdfManager, BasePDFStream, BasePDFStreamRangeReader, BasePDFStreamReader, BaseStream (+23 more)

### Community 24 - ".getTextContent"
Cohesion: 0.09
Nodes (20): AppearanceStreamEvaluator, BaseLocalCache, EvaluatorPreprocessor, LocalColorSpaceCache, LocalGStateCache, LocalImageCache, LocalTilingPatternCache, addFakeSpaces() (+12 more)

### Community 25 - "rect-sheet-persistence.ts"
Cohesion: 0.05
Nodes (80): createDrillSheet(), createRectSheet(), updateDrillSheet(), updateRectSheet(), upgradeRectSheetFromPlaceholder(), loadPlaceholder(), NewRectSheetPage(), NewRectSheetPageProps (+72 more)

### Community 26 - "Glyph"
Cohesion: 0.12
Nodes (4): CompositeGlyph, GlyfTable, Glyph, GlyphHeader

### Community 27 - "customer-name-similarity.ts"
Cohesion: 0.33
Nodes (12): compactCustomerName(), compactSimilarity(), CustomerNameCandidate, findSimilarCustomers(), getCustomerNameSimilarity(), jaccardSimilarity(), levenshteinDistance(), levenshteinRatio() (+4 more)

### Community 28 - "rich-text.ts"
Cohesion: 0.15
Nodes (21): handleAddCustomStructure(), RichTextEditor(), applyCommand(), emitChange(), handlePaste(), RichTextEditorProps, getCompanyLogoDataUri(), buildQuotePdfHtml() (+13 more)

### Community 29 - "galley-actions.ts"
Cohesion: 0.14
Nodes (25): injectGalleyFamilyOptions(), applyGalleyBreakdown(), ApplyGalleyBreakdownResult, BREAKDOWN_STATUSES, BreakdownDialog(), submit(), formatMixSummary(), GalleyBreakdownBanner() (+17 more)

### Community 30 - "delivery-ticket-pdf-line-items.ts"
Cohesion: 0.07
Nodes (50): COL_DESC_WIDTH, COL_DESC_X, COL_ITEM_NUM_WIDTH, COL_ITEM_NUM_X, COL_QTY_WIDTH, COL_QTY_X, DEFAULT_TABLE_LAYOUT, DeliveryTicketTableLayout (+42 more)

### Community 31 - "drain-ring-matrix-utils.ts"
Cohesion: 0.08
Nodes (37): DrainRingMatrixRows(), DrainRingMatrixRowsProps, DrainRingStyleTable(), DrainRingStyleTableProps, FEET_STAT_COLUMNS, ringStockClassName(), ringStockLabel(), allocateRingsForLoads() (+29 more)

### Community 32 - "delivery-tickets/pdf-actions.ts"
Cohesion: 0.10
Nodes (40): DeliveryTicketPdfPreviewResult, generateDeliveryTicketPdf(), GenerateDeliveryTicketPdfResult, getDeliveryTicketPdfPreviewBase64(), loadTicketForPdf(), PrintDeliveryTicketDirectResult, saveDeliverySchedulePdf(), SaveDeliverySchedulePdfResult (+32 more)

### Community 33 - "drill-sheet-preview.tsx"
Cohesion: 0.08
Nodes (46): CalcRow(), DrillSheetPreview(), DrillSheetPreviewProps, feet(), HeaderRow(), PlanDiagram(), PreviewPanel(), angleToClockPosition() (+38 more)

### Community 34 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, build, db:seed, db:sync-files, deploy:build, deploy:check, deploy:start, deploy:update (+11 more)

### Community 35 - "job-detail-mapper.ts"
Cohesion: 0.03
Nodes (122): listJobFilesAction(), revalidateFilesPaths(), syncJobFilesAction(), uploadJobFileAction(), updateJobCustomerAction(), updateJobStatusAction(), JobTabContent(), JobTabContentProps (+114 more)

### Community 36 - "build"
Cohesion: 0.11
Nodes (18): build, appId, directories, extraResources, icon, nsis, productName, publish (+10 more)

### Community 37 - "MathClamp"
Cohesion: 0.10
Nodes (6): IndexedCS, LocalFunctionCache, MathClamp(), PDFFunction, PDFFunctionFactory, toNumberArray()

### Community 38 - "ref_path"
Cohesion: 0.07
Nodes (51): createSheetPdfSetAction(), deleteSheetPdfSetAction(), deleteSheetPdfSetFileAction(), parseBooleanField(), renameSheetPdfSetAction(), revalidate(), uploadSheetPdfSetFileAction(), SHAPE_LABELS (+43 more)

### Community 39 - "custom-structure.ts"
Cohesion: 0.16
Nodes (19): CustomStructureCostBreakdown(), addItem(), CustomStructureCostBreakdownProps, CustomStructureDetailBreakdown(), CustomStructurePricingFooter(), CustomStructurePricingFooterProps, closeEditCustomStructureLine(), handleSaveEditedCustomStructure() (+11 more)

### Community 40 - "formatQuantity"
Cohesion: 0.32
Nodes (10): DailyProductionPage(), DailyProductionPageProps, DailyProductionDayEntry, DailyProductionStockProduct, DailyProductionStructureRow, getProductionDayEntries(), getStockProductsForDaily(), getStructuresInProductionForDaily() (+2 more)

### Community 41 - "rect-sheet-form.tsx"
Cohesion: 0.09
Nodes (38): DrillSheetJobOption, aboveFloorText(), fmtElevation(), InfoRow(), placementText(), RectSheetDetailView(), RectSheetDetailViewProps, Stat() (+30 more)

### Community 42 - "drill-sheet.ts"
Cohesion: 0.07
Nodes (39): annotateOpeningSections(), buildSolverHoles(), compareCost(), computeBaseTopToOpeningBottomInches(), computeDefaultSumpFeet(), computeDrillSheet(), ComputedSection, ComputedWeights (+31 more)

### Community 43 - ".success"
Cohesion: 0.04
Nodes (46): applyAssist(), ariaLabel(), bf, Caption, CheckButton, checkDimensions(), ChoiceList, computeBbox() (+38 more)

### Community 44 - "inventory/page.tsx"
Cohesion: 0.03
Nodes (121): AGGREGATE_SORT_COLUMNS, CONTACT_SORT_COLUMNS, ContactSortColumn, CUSTOMER_SORT_FIELDS, CustomerSortColumn, CustomersPage(), isAggregateSortColumn(), loadCustomerAggregates() (+113 more)

### Community 46 - "structure-import.ts"
Cohesion: 0.20
Nodes (20): CONNECTION_ALIASES, isBlank(), numberIssue(), parseBooleanCell(), parseConnectionCell(), parseDiametersCell(), parseSizesCell(), parseStatusCell() (+12 more)

### Community 47 - "drill-sheet-form.tsx"
Cohesion: 0.11
Nodes (23): buildCommittedPreview(), CommittedOpeningNumbers, CommittedPreviewNumbers, connectionOptions, createOpening(), DiameterConfigOption, DrillSheetCastingOption, DrillSheetForm() (+15 more)

### Community 48 - "rate-lookup.tsx"
Cohesion: 0.13
Nodes (21): lookupShippingRate(), lookupShippingRateAtPoint(), ShippingLookupResult, AddressAutocomplete(), closeDropdown(), handleContainerBlur(), AddressAutocompleteProps, DEFAULT_CENTER (+13 more)

### Community 50 - "XMLParserBase"
Cohesion: 0.14
Nodes (3): XFAParser, XMLParserBase, skipWs()

### Community 51 - "auth/constants.ts"
Cohesion: 0.06
Nodes (58): EditSettingsUserPage(), NewSettingsUserPage(), Header(), HeaderProps, NAV_ICON_PATHS, NavIcon(), NavIconId, NavItem (+50 more)

### Community 52 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, leaflet, next, nodemailer, pdf-lib, @pdf-lib/fontkit, pdf-to-printer, pdfjs-dist (+11 more)

### Community 53 - "customer-utils.ts"
Cohesion: 0.11
Nodes (22): parseBulkPaste(), ContactFormState, CustomerContactsPanelProps, emptyForm, RoleChip(), roleChipClassNames, bulkContactColumnHeaders, bulkContactExample (+14 more)

### Community 54 - "structures/actions.ts"
Cohesion: 0.08
Nodes (41): assertDiametersHaveMolds(), createStructureTemplate(), deleteStructureTemplate(), duplicateStructureTemplate(), handlePrismaError(), parseTemplatePayload(), resolvePriceListIdForTemplateSave(), saveRectPriceEntry() (+33 more)

### Community 55 - "BulkLoadPlanner"
Cohesion: 0.13
Nodes (30): buildRows(), BulkLoadPlanner(), addLoad(), autoRingCount(), buildLoadLines(), buildPayload(), castingGroupIsEven(), castingSetsForLoad() (+22 more)

### Community 57 - "CustomerContactsPanel"
Cohesion: 0.23
Nodes (17): addCustomerContact(), deleteCustomerContact(), loadContactRows(), revalidateCustomerPaths(), setPrimaryCustomerContact(), setRoleDefaultContact(), updateCustomerContact(), validateContactInput() (+9 more)

### Community 64 - ".getUint16"
Cohesion: 0.20
Nodes (16): buildComponentData(), decodeScan(), decodeBlock(), decodeHuffman(), decodeMcu(), readBit(), receive(), receiveAndExtend() (+8 more)

### Community 65 - "quote-mapper.ts"
Cohesion: 0.06
Nodes (43): QuotePreviewPage(), QuotePreviewPageProps, AWARDABLE_QUOTE_STATUSES, REMOVABLE_BIDDER_QUOTE_STATUSES, bidDueUrgencyFor(), deriveOriginalQuoteNumber(), deriveSupersededBy(), formatLineNotes() (+35 more)

### Community 66 - "Handy Commands — Precast App"
Cohesion: 0.15
Nodes (13): App (Next.js), Browse data, Daily workflow, Database backups, Electron desktop client, Git / GitHub (optional), Handy Commands — Precast App, Office deployment (Windows server) (+5 more)

### Community 67 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, electron, electron-builder, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+8 more)

### Community 68 - "withDatabaseRetry"
Cohesion: 0.03
Nodes (147): GET(), checkBulkContactDbState(), assertQuoteLinkable(), buildLineCreates(), buildLinesPayload(), createDeliveryTicket(), DeliveryTicketActionResult, discardSavedLoadPlan() (+139 more)

### Community 69 - "delivery-ticket-editor.tsx"
Cohesion: 0.03
Nodes (79): DeliveryTicketJobSearchOption, SaveDeliveryTicketInput, UpdateTicketDriverResult, DeliveryTicketEditorProps, EditorLine, formatWeight(), JobOption, ProductOption (+71 more)

### Community 70 - "PsWasmCompiler"
Cohesion: 0.06
Nodes (22): ast_Parser, buildPostScriptWasmFunction(), encodeASCIIString(), _nodesEqual(), PsArgNode, PsBinaryNode, PsBlock, PsConstNode (+14 more)

### Community 71 - "quote-pdf-line-items.ts"
Cohesion: 0.09
Nodes (43): toWinAnsiText(), COL_DESC_WIDTH, COL_DESC_X, COL_ITEM_NUM_WIDTH, COL_ITEM_NUM_X, COL_QTY_WIDTH, COL_QTY_X, COL_TOTAL_WIDTH (+35 more)

### Community 72 - "drill-sheets/[id]/page.tsx"
Cohesion: 0.07
Nodes (37): DrillSheetDetailPage(), DrillSheetDetailPageProps, loadJobSheetNav(), RectSheetDetail(), DeleteDrillSheetButton(), DeleteDrillSheetButtonProps, DrillSheetJobNav(), JobSheetNavEntry (+29 more)

### Community 73 - "casting-ticket-lines.ts"
Cohesion: 0.25
Nodes (8): CastingCollapseMeta, CastingCollapsibleLine, CastingExplodeComponent, CastingExplodedPiece, collapseCastingTicketLines(), perSetByProduct(), setWeightFor(), META

### Community 74 - "casting-utils.ts"
Cohesion: 0.15
Nodes (14): buildCastingBomFromProductCodes(), CastingAssemblyBomImportRow, castingAssemblyOptionalBomRoles, castingAssemblyRequiredBomRoles, CastingBomRowInput, CastingComponentLookup, castingPieceRoleFormOptions, castingRoleFormOptions (+6 more)

### Community 75 - "delivery-ticket-pdf-fill.ts"
Cohesion: 0.09
Nodes (43): blankOr(), buildDeliveryTicketFormData(), computeTotalPieces(), DbCustomer, DbDeliveryTicketForPdf, DbJob, DELIVERY_TICKET_PDF_INCLUDE, DeliveryTicketContentPage (+35 more)

### Community 76 - "invoices-tabs.tsx"
Cohesion: 0.04
Nodes (72): GlobalError(), isStaleDeploymentError(), InvoiceListRow, NotFound(), FormTypeahead(), closeDropdown(), handleContainerBlur(), handleKeyDown() (+64 more)

### Community 77 - "app-settings.ts"
Cohesion: 0.04
Nodes (123): DeliveryTicketsPage(), startOfToday(), checkJobsRootReadAccess(), clearAllCustomersFormAction(), clearAllDeliveryTicketsFormAction(), clearAllJobsFormAction(), clearAllProductsFormAction(), clearAllQuotesFormAction() (+115 more)

### Community 78 - "pipe-modal.tsx"
Cohesion: 0.12
Nodes (28): createDefaultQuoteRow(), createRowId(), PipeModal(), handleAddQuoteLines(), handleAddUnitPricesToDescription(), handleClose(), resetModal(), PipeModalMode (+20 more)

### Community 79 - "XmlObject"
Cohesion: 0.05
Nodes (5): Datasets, datasets_Data, DatasetsNamespace, XFAAttribute, XmlObject

### Community 80 - "delivery-fulfillment.ts"
Cohesion: 0.11
Nodes (38): getQuoteFulfillmentForTicket(), getQuoteFulfillmentWithOpenLoads(), AdsPipeOption, allLineageIds(), buildFulfillmentFromContext(), buildQuoteLineLineageMap(), buildScheduledFromContext(), DbClient (+30 more)

### Community 81 - "structure-utils.ts"
Cohesion: 0.04
Nodes (60): mapStructure(), needsDrillSheetWhere, ProductionPage(), structureInclude, JobStructureFormProps, JobProgressLine, JobProgressSummary, JobProgressView (+52 more)

### Community 82 - "randomId"
Cohesion: 0.04
Nodes (66): savePurchaseReceipt(), handleOpenFolder(), createRow(), ProductionEntryForm(), addLine(), handleSubmit(), ProductionEntryFormProps, ProductionLineRow (+58 more)

### Community 83 - "calibrate-rect-templates.ts"
Cohesion: 0.09
Nodes (25): Align, ALIGNMENTS, BLACK, calibrateVariant(), EXPLODED_SPECS, extractTextItems(), findItem(), HEADER_SPECS (+17 more)

### Community 84 - "AGENTS.md"
Cohesion: 0.38
Nodes (4): Codebase exploration: use graphify first, Prisma / Database Rules, Project context, This is NOT the Next.js you know

### Community 85 - "walk-ins-board.tsx"
Cohesion: 0.24
Nodes (14): MarkPickedUpControl(), handleConfirm(), BadgeVariant, CalledInPickupCard(), CompletedPickupCard(), dateLine(), itemsPaymentLine(), jobNameLine() (+6 more)

### Community 86 - "vitest"
Cohesion: 0.06
Nodes (31): EDITABLE_INVOICE_STATUSES, finalizeAllDraftInvoices(), finalizeInvoices(), markInvoicePaid(), parseInvoiceDate(), reopenVoidedInvoice(), requireEditableInvoice(), UpdateDraftInvoiceInput (+23 more)

### Community 87 - "inventory-service.ts"
Cohesion: 0.15
Nodes (15): undoTicketDelivery(), applyInboundStockChanges(), applyStockChange(), applyStructureProductionLines(), DbClient, deductInventoryForDeliveredTicket(), InboundStockChange, productionDayTimestamp() (+7 more)

### Community 88 - "._bindElement"
Cohesion: 0.11
Nodes (5): Binder, createText(), DataHandler, searchNode(), XFAFactory

### Community 89 - "jobs/actions.ts"
Cohesion: 0.08
Nodes (43): allocateJobNumber(), createJob(), createJobStructure(), deleteJobStructureDocumentActionOrThrow(), formatJobNumber(), JOB_STATUSES, JobFormCustomerOption, JobStructureExplorerOpenResult (+35 more)

### Community 91 - "IntegerObject"
Cohesion: 0.05
Nodes (13): AdjustData, AdobeExtensionLevel, CompressObjectStream, Copies, CurrentPage, IntegerObject, Level, MsgId (+5 more)

### Community 92 - "job-structure-import-dialog.tsx"
Cohesion: 0.09
Nodes (32): JobStructureImportEntry, JobStructureImportResult, buildPreview(), Cell, detectShape(), ImportOptions, JobStructureImportButton(), handleFile() (+24 more)

### Community 93 - "shipping-zones-manager.tsx"
Cohesion: 0.14
Nodes (25): createShippingZone(), deleteShippingZone(), revalidateShippingZonePaths(), setYardLocation(), ShippingZoneInput, updateShippingZone(), ValidatedZone, validateZoneInput() (+17 more)

### Community 94 - "files/actions.ts"
Cohesion: 0.22
Nodes (21): ExplorerOpenResult, openJobFile(), openJobFolderCategory(), syncAllFiles(), SyncAllFilesResult, assertJobFolderPath(), assertPathUnderJobRoot(), getJobFileForOpen() (+13 more)

### Community 95 - "contact-actions.ts"
Cohesion: 0.17
Nodes (12): BulkContactDbState, BulkContactImportRow, CONTACT_ROLES, CustomerContactInput, importContactsOrThrow(), ImportContactsResult, assignMissingRoleDefaults(), ContactSnapshot (+4 more)

### Community 97 - "input.tsx"
Cohesion: 0.40
Nodes (3): inputClassName, InputProps, textareaClassName

### Community 98 - "Precast Ops desktop updates"
Cohesion: 0.40
Nodes (4): Precast Ops desktop updates, Publish a desktop update (from the dev PC), Verify (from any office PC), Which machine does what

### Community 99 - "pdf-text.ts"
Cohesion: 0.36
Nodes (7): CP1252_HIGH, fitPdfFieldFontSize(), isWinAnsi(), lastFontSize(), replaceLastFontSize(), setPdfFieldText(), WINANSI_REPLACEMENTS

### Community 100 - "JobBiddingPanel"
Cohesion: 0.29
Nodes (11): generateQuotesFromMaster(), buildContactMapForGenerate(), buildDefaultContactMap(), JobBiddingPanel(), handleAddBidder(), handleAward(), handleGenerateQuotes(), handleRemoveBidder() (+3 more)

### Community 101 - "Builder"
Cohesion: 0.17
Nodes (3): Builder, Empty, UnknownNamespace

### Community 102 - "pdf-lib"
Cohesion: 0.10
Nodes (29): removeFlattenLeftovers(), QuoteLineItemRecord, QuoteRecord, blankOr(), buildQuoteFormData(), DbQuoteForPdf, formatDateForPdf(), formatMoneyForPdf() (+21 more)

### Community 104 - "SimpleDOMNode"
Cohesion: 0.15
Nodes (3): DatasetXMLParser, SimpleDOMNode, SimpleXMLParser

### Community 105 - "delivery-ticket-preview-content.tsx"
Cohesion: 0.25
Nodes (12): printDeliveryTicketDirect(), printInvoiceDirect(), DeliveryTicketPdfCanvasPreview(), DeliveryTicketPdfCanvasPreviewProps, getDeliveryTicketPreviewPrintUrl(), DeliveryTicketPreviewContent(), handleGeneratePdf(), handlePrint() (+4 more)

### Community 106 - "product-taxonomy.server.ts"
Cohesion: 0.11
Nodes (31): createProductCategoryFormAction(), updateProductCategoryFormAction(), ProductForm(), handleCategoryChange(), handleProductKindChange(), handleProductTypeChange(), handleRingDiameterChange(), getDrainRingStyleOptionsForDiameter() (+23 more)

### Community 108 - "generate-invoice-templates.ts"
Cohesion: 0.12
Nodes (25): CONT_TABLE_BOTTOM_Y, MAIN_TABLE_BOTTOM_Y, addTextField(), BLACK, BOTTOM_BOX, buildTemplate(), Ctx, drawBox() (+17 more)

### Community 110 - "send-actions.ts"
Cohesion: 0.07
Nodes (56): findSupersededBy(), getSendQuoteDefaults(), getSendQuoteEmailConfigured(), OpenOutlookDraftResult, openQuoteInOutlook(), sendQuote(), SendQuoteDefaults, SendQuoteInput (+48 more)

### Community 111 - "XhtmlObject"
Cohesion: 0.03
Nodes (22): a, B, Body, br, Button, fixURL(), Html, _i (+14 more)

### Community 112 - "bulk-load-planner.tsx"
Cohesion: 0.11
Nodes (18): DeliveryTicketLineInput, PlannedLoadInput, SavePlannedLoadsInput, BulkLoadPlannerProps, CategoryRow, DeletedTicket, DraftLoadColumn, ExcludedLine (+10 more)

### Community 114 - "completeExplorerOpen"
Cohesion: 0.08
Nodes (35): openJobFolder(), deleteProductDocumentAction(), openProductDocument(), openProductSubmittalsFolder(), scanProductDocumentsAction(), uploadProductDocumentAction(), JobDrillSheetsPdfButtons(), FilesHub() (+27 more)

### Community 115 - "zones.ts"
Cohesion: 0.20
Nodes (13): resolveShippingRateForPoint(), ClickCapture(), FlyToPin(), ZoneMap(), ZoneMapProps, haversineMiles(), pointInPolygon(), PolygonRing (+5 more)

### Community 117 - "plan-sheet-actions.ts"
Cohesion: 0.19
Nodes (15): GET(), RouteContext, getPlanSheetForOpen(), listJobConstructionPlanPdfs(), mapPlanSheetRow(), pathExists(), savePlanSheetMarkup(), selectJobPlanSheet() (+7 more)

### Community 118 - "windows-explorer.ts"
Cohesion: 0.10
Nodes (32): ClientPathMapping, getClientPathMappings(), stripTrailingSeparators(), toClientOpenPath(), translateToClientPath(), assertDirectoryExists(), assertFileExists(), assertPathAccessible() (+24 more)

### Community 119 - "bulk-attach-board.tsx"
Cohesion: 0.21
Nodes (15): BulkAttachPage(), BulkAttachBoard(), getTile(), handleFiles(), renderTile(), selectMode(), setTile(), tileKey() (+7 more)

### Community 120 - "product-export.ts"
Cohesion: 0.09
Nodes (37): DetailField(), ProductDetailPage(), ProductDetailPageProps, searchProductsForQuoteForm(), normalizeAdsPipeJointType(), DbClient, DerivedAssemblyValues, enrichProductWithDerivedAssemblyValues() (+29 more)

### Community 121 - "invoice-draft-editor.tsx"
Cohesion: 0.12
Nodes (25): computeInvoiceFinancials(), DraftInvoiceLineInput, saveDraftInvoiceAndRedirect(), updateDraftInvoice(), computePreviewTotals(), EditorLine, formatMoney(), InvoiceDraftEditor() (+17 more)

### Community 122 - "Office deployment — single Windows server + UNC job folders"
Cohesion: 0.11
Nodes (18): Architecture, End-to-end smoke test, Firewall, Important behavior, Install prerequisites, Office deployment — single Windows server + UNC job folders, Ongoing maintenance, Phase 1 — Prepare the Windows server (+10 more)

### Community 123 - "Office rollout checklist"
Cohesion: 0.12
Nodes (17): 1. Server URL for the desktop app, 2. First install on each staff PC, 3. Staff expectations, 4. Role walkthrough (recommended), 5. Backups, 6. Support contacts, 7. Post-rollout verification (first week), Database (nightly recommended) (+9 more)

### Community 124 - "next"
Cohesion: 0.03
Nodes (128): GET(), parseCopyParam(), RouteContext, GET(), RouteContext, GET(), rectPreviewResponse(), RouteContext (+120 more)

### Community 125 - "react"
Cohesion: 0.04
Nodes (96): deleteDraftInvoice(), createJobFolder(), deleteJobStructureDocumentAction(), openJobStructureDocument(), uploadJobStructureDocumentAction(), importCustomJobStructures(), bulkSetJobStructureStatuses(), BulkStructureStatus (+88 more)

### Community 126 - "pdfjs-dist"
Cohesion: 0.17
Nodes (12): DraftBatchPreviewPage(), renderPage(), renderPage(), DraftBatchPreviewContent(), loadDocument(), renderPage(), renderPage(), loadPdf() (+4 more)

### Community 127 - "BulkContactPasteForm"
Cohesion: 0.20
Nodes (11): importContacts(), BulkContactPasteForm(), handleImport(), handleParsePreview(), parseBulkContactPaste(), bulkContactRowKey(), markBulkContactDuplicateRows(), parseContactRolesCell() (+3 more)

### Community 128 - ".push"
Cohesion: 0.03
Nodes (59): 1181(), 7416(), 7642(), 9835(), addChildren(), AnnotationFactory, ao, ButtonWidgetAnnotation (+51 more)

### Community 129 - "getStringOption"
Cohesion: 0.03
Nodes (31): CalendarSymbols, CurrencySymbol, CurrencySymbols, Data, DatePattern, DatePatterns, DayNames, EraNames (+23 more)

### Community 130 - "delivery-schedule-pdf-html.ts"
Cohesion: 0.22
Nodes (15): DeliveryScheduleTicket, JobDeliverySchedule, buildDeliverySchedulePdfHtml(), DeliveryScheduleVariant, escapeHtml(), formatDeliveryAddress(), formatFriendlyDate(), formatTime12() (+7 more)

### Community 131 - "app_generated_prisma_client_prismaclient"
Cohesion: 0.17
Nodes (16): DEFAULT_APP_SETTINGS_DATA, DEFAULT_SEED_LOGO_PDF_PATH, decodeApiKey(), PrismaDevPayload, resolveDatabaseUrl(), resolvePrismaDevPayload(), resolveShadowDatabaseUrl(), databaseUrl (+8 more)

### Community 134 - "Deployment server info checklist"
Cohesion: 0.22
Nodes (9): Database, Deployment server info checklist, Electron client, File shares (UNC), Network, PDF generation, Post-deploy verification, Server (+1 more)

### Community 136 - "delivery-ticket-pdf-html.ts"
Cohesion: 0.16
Nodes (20): CompanyProfile, getCompanyProfile(), DeliveryTicketCopySettings, DeliveryTicketPdfView, getDeliveryTicketCopyTitles(), addressBlockHtml(), buildDeliveryTicketPdfHtml(), escapeHtml() (+12 more)

### Community 137 - "Troubleshooting"
Cohesion: 0.33
Nodes (6): `P1001` — Can't reach database server, Password authentication failed, Port 3000 already in use, Prisma Studio — "Could not load schema metadata", Quote PDF — "Could not find Chrome" / browser not found, Troubleshooting

### Community 138 - ".constructor"
Cohesion: 0.12
Nodes (9): BaseShading, buildMeshVertexData(), DummyShading, FunctionBasedShading, getB(), MeshShading, MeshStreamReader, Pattern (+1 more)

### Community 139 - "structure-workbook-plan-takeoff.tsx"
Cohesion: 0.11
Nodes (28): pipeSizesForMaterial(), uniquePipeMaterials(), bearingFromDelta(), commitRow(), DragState, pdfToScreen(), PipePopup(), polarToScreenPoint() (+20 more)

### Community 141 - "Precast Ops"
Cohesion: 0.40
Nodes (5): Desktop shell (optional), Local development, Office deployment, Precast Ops, Project docs

### Community 142 - "printPdfUrl"
Cohesion: 0.24
Nodes (12): generateQuotePdf(), printAllForDay(), handlePrint(), printSelectedSheets(), getQuotePreviewPrintUrl(), QuotePdfCanvasPreview(), QuotePdfCanvasPreviewProps, QuotePreviewContent() (+4 more)

### Community 150 - "stringToBytes"
Cohesion: 0.12
Nodes (7): ARCFourCipher, calculateMD5(), CipherTransform, CipherTransformFactory, encodeToXmlString(), stringToBytes(), utf8StringToString()

### Community 151 - "drill-sheet-preview-content.tsx"
Cohesion: 0.22
Nodes (11): DrillSheetPdfCanvasPreview(), loadPdf(), DrillSheetPdfCanvasPreviewProps, DrillSheetPdfPreviewInfo, getDrillSheetPreviewPrintUrl(), LoadedPdf, DrillSheetPreviewContent(), handleGeneratePdf() (+3 more)

### Community 152 - "ring-builder-settings-form.tsx"
Cohesion: 0.24
Nodes (8): buildEditableFromConfig(), createMappingId(), EditableMapping, parseExtraSubcategoriesText(), RingBuilderSettingsForm(), RingBuilderSettingsFormProps, SubcategoryPicker(), isTopLevelRingStyle()

### Community 154 - "rect-sheet-detail.ts"
Cohesion: 0.38
Nodes (10): RectSectionField, buildRectSheetFormValues(), buildRectSheetFormValuesForIdentity(), buildRectSheetFormValuesFromQuoteConfig(), decimalToInput(), emptyOpeningField(), nextId(), num() (+2 more)

### Community 155 - "receiving-utils.ts"
Cohesion: 0.06
Nodes (54): resolveReceivingCategory(), listOpenPurchaseOrdersForReceiving(), ReceivingPage(), mapOpenPurchaseOrders(), ReceivePage(), ReceivePageProps, createVendorFormAction(), revalidateVendorPaths() (+46 more)

### Community 157 - "ref_fs"
Cohesion: 0.09
Nodes (17): CONTENT_TYPES, RouteContext, UPDATES_DIR, puppeteer, templatePath, templates, findBrowser(), HTML_PATH (+9 more)

### Community 158 - "ring-builder-modal.tsx"
Cohesion: 0.08
Nodes (50): RingBuilderModal, formatQuoteCurrency(), createDefaultHeightPoolRow(), createRowId(), formatRingBuilderUnitPrice(), HeightPoolRow, initOtherInputs(), OtherProductInput (+42 more)

### Community 160 - "getCurrentUser"
Cohesion: 0.10
Nodes (29): GET(), GET(), GET(), DeliveryTicketDetailPage(), getDraftInvoiceEditorData(), EditDraftInvoicePage(), PageProps, InvoiceDetailPage() (+21 more)

### Community 161 - "Job Structure Production Workflow"
Cohesion: 0.33
Nodes (5): Dates, Delivery eligibility, Job Structure Production Workflow, Quote → JobStructure linking, Server actions

### Community 162 - "customer-mapper.ts"
Cohesion: 0.15
Nodes (18): CustomerDetailStats, CustomerRelatedDeliveryTicket, CustomerRelatedInvoice, CustomerRelatedQuote, CustomerRow, CustomerRowAggregates, customerStatusLabels, formatCustomerDate() (+10 more)

### Community 163 - "delivery-ticket-submittal-preview-content.tsx"
Cohesion: 0.38
Nodes (8): printDeliveryTicketSubmittalsDirect(), DeliveryTicketSubmittalPdfCanvasPreview(), DeliveryTicketSubmittalPdfCanvasPreviewProps, getDeliveryTicketSubmittalPreviewPrintUrl(), DeliveryTicketSubmittalPreviewContent(), handlePrint(), openPrintWindow(), DeliveryTicketSubmittalPreviewContentProps

### Community 165 - "main.mjs"
Cohesion: 0.07
Nodes (39): __dirname, getUserConfigPath(), loadConfig(), readJsonFile(), validateServerUrl(), buildApplicationMenu(), createWindow(), __dirname (+31 more)

### Community 167 - "lexer_Lexer"
Cohesion: 0.36
Nodes (3): lexer_Lexer, parsePostScriptFunction(), Token

### Community 168 - "submittal-package.ts"
Cohesion: 0.12
Nodes (39): getStockSubmittalsRoot(), getSubmittalsJobSubfolder(), assertPathUnderStockSubmittalsRoot(), assertProductExists(), buildSubmittalPackageBaseName(), collectSubmittalFilesForCode(), deleteProductDocument(), getProductDocumentForOpen() (+31 more)

### Community 169 - "GroupMemberReorderTable"
Cohesion: 0.33
Nodes (8): GroupEditor(), ProductGroupsPage(), GroupMemberReorderTable(), clearDrag(), insertionIndexFor(), onRowDragOver(), onRowDrop(), ReloadOnSubmitForm()

### Community 172 - "Dict"
Cohesion: 0.04
Nodes (38): CaretAnnotation, ChoiceWidgetAnnotation, CircleAnnotation, createImage(), createImageDict(), createPNGLikeImage(), createRawImage(), DefaultAppearanceEvaluator (+30 more)

### Community 173 - "ExclGroup"
Cohesion: 0.05
Nodes (11): addHTML(), Area, createLine(), ExclGroup, flushHTML(), getAvailableSpace(), getContainedChildren(), Image (+3 more)

### Community 175 - "StringObject"
Cohesion: 0.01
Nodes (47): Amd, AppearanceFilter, Base, Certificate, config_Picture, connection_set_Uri, ConnectionSet, ConnectionSetNamespace (+39 more)

### Community 176 - "invoice-mapper.ts"
Cohesion: 0.53
Nodes (5): formatDate(), formatMoney(), InvoiceDetailView, mapDbInvoiceToDetailView(), statusVariant()

### Community 179 - "FormatError"
Cohesion: 0.02
Nodes (56): addHex(), Ascii85Stream, AsciiHexStream, BinaryCMapReader, BinaryCMapStream, BrotliStream, CCITTFaxStream, Cmd (+48 more)

### Community 180 - "test-db.ts"
Cohesion: 0.46
Nodes (4): globalSetup(), url, assertIsTestDatabaseUrl(), getTestDatabaseUrl()

### Community 181 - "quotes/[id]/page.tsx"
Cohesion: 0.33
Nodes (4): QuoteDetailPage(), QuoteDetailPageProps, buildQuoteAttachmentFilename(), quote

### Community 182 - "BulkPasteForm"
Cohesion: 0.40
Nodes (4): checkBulkCustomerDbDuplicates(), BulkPasteForm(), handleImport(), handleParsePreview()

### Community 186 - "package.json"
Cohesion: 0.08
Nodes (23): eslintConfig, main, name, postcss, overrides, @hono/node-server, next, private (+15 more)

### Community 187 - "DashboardShell"
Cohesion: 0.04
Nodes (99): BulkCustomersPage(), BulkContactsPage(), EditCustomerPage(), EditCustomerPageProps, CustomerNotFound(), CustomerDetailPage(), CustomerDetailPageProps, NewCustomerPage() (+91 more)

### Community 192 - "print-pdf-url.ts"
Cohesion: 0.18
Nodes (15): listPrintersForClient(), printServerPdfForClient(), ServerPrintResult, attachHiddenIframe(), cleanupAfterPrint(), pickPrinter(), printBlobAsPdfFrame(), printViaServerWithPicker() (+7 more)

### Community 196 - "custom-structure-import.ts"
Cohesion: 0.20
Nodes (13): Cell, cellText(), ColumnMap, CustomImportEntry, CustomImportIssue, CustomImportResult, CustomImportRow, findHeader() (+5 more)

### Community 203 - "delivery-ticket-detail-content.tsx"
Cohesion: 0.20
Nodes (15): DeliveryTicketDetailContent(), DeliveryTicketDetailContentProps, formatLineType(), isBlank(), OptionalField(), paymentMethodLabel(), PickupInfo, RELATED_PLACEHOLDERS (+7 more)

### Community 204 - "product-mapper.ts"
Cohesion: 0.17
Nodes (17): formatProductKindBadgeLabel(), categoryVariant(), documentTypeLabel(), formatDecimal(), formatDocumentDate(), formatFileSize(), formatYesNo(), mapProductToDetail() (+9 more)

### Community 205 - "invoice-pdf-fill.ts"
Cohesion: 0.09
Nodes (34): formatPostalAddressLines(), removeAdsJointTypeSuffix(), removeTrailingRingHeightSuffix(), resolveDeliveryAddressLines(), resolveLineDescription(), splitMultilineAddress(), blankOr(), buildInvoiceFormData() (+26 more)

### Community 209 - "rect-structure-import.ts"
Cohesion: 0.05
Nodes (49): RectImportDialog(), handleFile(), handlePasteParse(), RectImportDialogProps, handleFile(), Cell, cellText(), findHeaderRow() (+41 more)

### Community 227 - "rect-bulk-grid.tsx"
Cohesion: 0.06
Nodes (56): BulkSheetRowInput, BulkSheetRowResult, DrillSheetTemplateOption, RectOpeningField, RectSheetFormValues, circularPayloadFromValues(), rectPayloadFromValues(), focusGridCell() (+48 more)

### Community 242 - ".checkAndRepair"
Cohesion: 0.05
Nodes (36): adjustMapping(), amendFallbackToUnicode(), applyStandardFontGlyphMap(), buildToFontChar(), CFFFont, compileFontInfo(), convertCidString(), createCmapTable() (+28 more)

### Community 243 - "ConfigNamespace"
Cohesion: 0.01
Nodes (100): Acrobat, Acrobat7, ADBE_JSConsole, ADBE_JSDebugger, AddSilentPrint, AddViewerPreferences, Agent, Attributes (+92 more)

### Community 248 - "LabCS"
Cohesion: 0.12
Nodes (3): CalGrayCS, DeviceCmykCS, LabCS

### Community 256 - "calculateSHA512"
Cohesion: 0.07
Nodes (24): AES128Cipher, AES256Cipher, AESBaseCipher, calculate_sha256_ch(), calculate_sha256_littleSigma(), calculate_sha256_littleSigmaPrime(), calculate_sha256_maj(), calculate_sha256_sigma() (+16 more)

### Community 260 - "SectionCard"
Cohesion: 0.04
Nodes (131): ScheduleLoadUpdate, ProductInventoryPage(), ProductInventoryPageProps, CompactTable(), Home(), CastingSuppliersPage(), CastingSuppliersPageProps, PriceListDetailPage() (+123 more)

### Community 261 - "ColorSpace"
Cohesion: 0.10
Nodes (4): AlternateCS, ColorSpace, DeviceRgbaCS, PatternCS

### Community 311 - "Phase 6 — Electron client (staff PCs)"
Cohesion: 0.25
Nodes (8): A. Server app updates (quotes, jobs, UI — most changes), B. Desktop shell updates (Electron auto-update), Build the installer, C. Server URL change only, Client updates (auto-update from server), Install on each desk PC, Local development with Electron, Phase 6 — Electron client (staff PCs)

### Community 315 - "warn"
Cohesion: 0.02
Nodes (26): Catalog, addPageError(), clearGlobalCaches(), CmykICCBasedCS, createDataNode(), createValidAbsoluteUrl(), DatasetReader, decodeString() (+18 more)

### Community 330 - "allowScripts"
Cohesion: 0.25
Nodes (8): allowScripts, electron@35.7.5, esbuild@0.28.1, prisma@7.8.0, @prisma/engines@7.8.0, puppeteer@25.1.0, sharp@0.34.5, unrs-resolver@1.12.2

### Community 333 - "Security posture: internal, trusted-network tool"
Cohesion: 0.67
Nodes (3): Authentication today, Authorization, Security posture: internal, trusted-network tool

### Community 336 - "PDFImage"
Cohesion: 0.14
Nodes (4): convertBlackAndWhiteToRGBA(), convertToRGBA(), ImageResizer, PDFImage

### Community 347 - "ta"
Cohesion: 0.14
Nodes (13): 616(), 8745(), 9504(), 9565(), JBig2CCITTFaxImage, Jbig2Error, oa(), doRun() (+5 more)

## Knowledge Gaps
- **1345 isolated node(s):** `RouteContext`, `RouteContext`, `RouteContext`, `RouteContext`, `RouteContext` (+1340 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2408 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **53 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `_` connect `_` to `.push`, `calculateSHA512`, `getStringOption`, `Annotation`, `ColorSpace`, `.getOperatorList`, `XFAObject`, `ContentObject`, `.constructor`, `.add`, `SingleIntersector`, `stringToBytes`, `unreachable`, `.getTextContent`, `DeviceRgbCS`, `Glyph`, `JpegImage`, `Name`, `CalRGBCS`, `Color`, `signature_Signature`, `MathClamp`, `Stylesheet`, `lexer_Lexer`, `MetadataParser`, `.success`, `Dict`, `ExclGroup`, `ChunkedStream`, `StringObject`, `CMap`, `SimpleGlyph`, `TextState`, `FormatError`, `ToUnicodeMap`, `XMLParserBase`, `NullOptimizer`, `DeviceGrayCS`, `.#Se`, `warn`, `Ps`, `GlobalColorSpaceCache`, `RegionalImageCache`, `Driver`, `.getUint16`, `PsWasmCompiler`, `XmlObject`, `PDFImage`, `._bindElement`, `ChunkedStreamManager`, `IntegerObject`, `ta`, `AnnotationBorderStyle`, `Builder`, `SimpleDOMNode`, `XhtmlObject`, `.checkAndRepair`, `ConfigNamespace`, `LabCS`, `xdp_Xdp`?**
  _High betweenness centrality (0.381) - this node is a cross-community bridge._
- **Why does `reloadAfterAction()` connect `react` to `SectionCard`, `ContentObject`, `unreachable`, `galley-actions.ts`, `job-detail-mapper.ts`, `ref_path`, `GroupMemberReorderTable`, `structures/actions.ts`, `delivery-ticket-editor.tsx`, `delivery-ticket-detail-content.tsx`, `invoices-tabs.tsx`, `app-settings.ts`, `structure-utils.ts`, `randomId`, `walk-ins-board.tsx`, `job-structure-import-dialog.tsx`, `shipping-zones-manager.tsx`, `JobBiddingPanel`, `completeExplorerOpen`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `handleSubmit()` connect `randomId` to `next`, `react`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **What connects `RouteContext`, `RouteContext`, `RouteContext` to the rest of the system?**
  _1345 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app/products/actions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0726764500349406 - nodes in this community are weakly interconnected._
- **Should `rect-structure.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0898989898989899 - nodes in this community are weakly interconnected._
- **Should `_` be split into smaller, more focused modules?**
  _Cohesion score 0.010567976669906958 - nodes in this community are weakly interconnected._