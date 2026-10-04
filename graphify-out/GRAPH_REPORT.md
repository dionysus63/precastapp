# Graph Report - precastapp  (2026-10-04)

## Corpus Check
- 783 files · ~497,009 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 3, .mdc 2, .example 1)

## Summary
- 8942 nodes · 27121 edges · 219 communities (170 shown, 49 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 239 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `22b75ebb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app/products/actions.ts
- rect-structure.ts
- pdf.worker.min.mjs
- getStringOption
- XFAObject
- .getOperatorList
- structure-workbook.ts
- rect-structure-workbook.ts
- ContentObject
- rect-template-pdf.ts
- DeliveryTicketEditor
- FormatError
- drill-sheet-template-pdf.ts
- QuoteForm
- quote-form.tsx
- company-logo.ts
- drill-sheet-detail.ts
- IntegerObject
- product-form.tsx
- product-kinds.ts
- compilerOptions
- .createDocumentHandler
- .getTextContent
- rect-sheet-persistence.ts
- Option01
- .getObj
- delivery-tickets/pdf-actions.ts
- galley-actions.ts
- delivery-ticket-pdf-line-items.ts
- drain-ring-matrix-utils.ts
- profile/page.tsx
- drill-sheet-preview.tsx
- scripts
- getAppSettings
- build
- drill-sheet-options.ts
- returnActionError
- money-rules.ts
- delivery-ticket-pdf-pickup.ts
- withDatabaseRetry
- drill-sheet.ts
- .success
- prisma.ts
- pipe-modal.tsx
- import/actions.ts
- DrillSheetForm
- shipping/actions.ts
- XMLParserBase
- auth/constants.ts
- dependencies
- customer-mapper.ts
- structures/actions.ts
- bulk-load-planner.tsx
- postcss.config.mjs
- customer-name-similarity.ts
- rect-sheet-detail-view.tsx
- quote-mapper.ts
- Handy Commands — Precast App
- devDependencies
- delivery-tickets/actions.ts
- date-only.ts
- PsNode
- quote-pdf-line-items.ts
- job-detail-mapper.ts
- DeliveryTicketDetailContent
- casting-utils.ts
- delivery-ticket-pdf-fill.ts
- settings/products/page.tsx
- SectionCard
- .constructor
- rect-pdf-set-service.ts
- delivery-fulfillment.ts
- inventory/page.tsx
- react
- calibrate-rect-templates.ts
- AGENTS.md
- quote-pdf-html.ts
- invoicing-service.ts
- XhtmlObject
- PDFDocument
- purchase-orders/actions.ts
- .getBytes
- contact-actions.ts
- job-structure-import-dialog.tsx
- settings/actions.ts
- plan-sheet-actions.ts
- quotes/actions.ts
- AnnotationBorderStyle
- input.tsx
- Precast Ops desktop updates
- price-list-service.ts
- sheet-pdfs/actions.ts
- XmlObject
- invoice-pdf-fill.ts
- PsWasmCompiler
- structure-workbook.tsx
- product-taxonomy.server.ts
- generate-invoice-templates.ts
- send-actions.ts
- delivery-ticket-pdf-data.ts
- translatePrismaError
- reloadAfterAction
- drill-sheet-form.tsx
- quote-form-data.ts
- windows-explorer.ts
- ._parseBlock
- app/products/page.tsx
- shipping-zones-manager.tsx
- Office deployment — single Windows server + UNC job folders
- Office rollout checklist
- app_generated_prisma_client
- job-structure-detail-content.tsx
- drill-sheets/pdf-actions.ts
- delivery-ticket-pdf-html.ts
- .get
- .getUint16
- delivery-schedule-pdf-html.ts
- app_generated_prisma_client_prismaclient
- Deployment server info checklist
- app-settings.ts
- Troubleshooting
- invoice-pdf-data.ts
- structure-workbook-plan-takeoff.tsx
- Precast Ops
- job-structure-detail-mapper.ts
- XRef
- pdfjs-dist
- FontFinder
- JpegImage
- calculateSHA512
- receiving-utils.ts
- Builder
- ref_path
- ring-builder-modal.tsx
- ColorSpace
- rect-structure-import.ts
- Glyph
- product-groups/page.tsx
- casting-ticket-lines.ts
- signature_Signature
- main.mjs
- session-keep-alive.tsx
- AlternateCS
- submittal-package.ts
- job-sheet-import-actions.ts
- CalRGBCS
- TextState
- .push
- ExclGroup
- ChunkedStream
- StringObject
- walk-ins-board.tsx
- receiving/receive/page.tsx
- lexer_Lexer
- CMap
- SimpleGlyph
- reconcile/page.tsx
- zone-map.tsx
- NullOptimizer
- .compile
- .#Ne
- package.json
- DashboardShell
- .add
- product-export.ts
- PsJsCompiler
- ToUnicodeMap
- customers/[id]/page.tsx
- invoice-mapper.ts
- GlyphHeader
- PipeOpeningSizesForm
- custom-structure-import.ts
- RectOpeningSizesForm
- Stylesheet
- product-mapper.ts
- contentDisposition
- generate-circular-import-template.mjs
- rect-bulk-grid.tsx
- .checkAndRepair
- ConfigNamespace
- LabCS
- xdp_Xdp
- next
- Annotation
- SingleIntersector
- process-app-icon.ps1
- Phase 6 — Electron client (staff PCs)
- warn
- allowScripts
- Security posture: internal, trusted-network tool
- PDFImage

## God Nodes (most connected - your core abstractions)
1. `withDatabaseRetry()` - 350 edges
2. `requirePermission()` - 336 edges
3. `XFAObject` - 208 edges
4. `next` - 201 edges
5. `SectionCard()` - 195 edges
6. `warn()` - 175 edges
7. `DashboardShell()` - 163 edges
8. `react` - 156 edges
9. `ConfigNamespace` - 141 edges
10. `reloadAfterAction()` - 137 edges

## Surprising Connections (you probably didn't know these)
- `Authentication today` --references--> `signInWithPassword()`  [INFERRED]
  AGENTS.md → app/login/actions.ts
- `Quote → JobStructure linking` --references--> `linkJobStructuresFromQuote()`  [INFERRED]
  docs/STRUCTURE_PRODUCTION_WORKFLOW.md → lib/job-structure-workflow.ts
- `handleSubmit()` --calls--> `createJobStructure()`  [EXTRACTED]
  components/jobs/job-structure-form.tsx → app/jobs/actions.ts
- `JobsPage()` --indirect_call--> `mapJobToRow()`  [INFERRED]
  app/jobs/page.tsx → lib/job-mapper.ts
- `openDialog()` --calls--> `loadJobStructureImportOptions()`  [EXTRACTED]
  components/jobs/job-structure-import-dialog.tsx → app/jobs/structure-import-actions.ts

## Import Cycles
- None detected.

## Communities (219 total, 49 thin omitted)

### Community 0 - "app/products/actions.ts"
Cohesion: 0.06
Nodes (61): parseCustomerFormData(), parseJobFormData(), parseJobUpdateFormData(), assertAllAssemblyComponentCodesExist(), BulkImportRow, bulkImportUpdateData(), collectAssemblyBomImportRows(), collectReferencedComponentCodes() (+53 more)

### Community 1 - "rect-structure.ts"
Cohesion: 0.09
Nodes (39): SumpMode, annotateRectOpeningSections(), ComputedRectSection, computeHorizontalGeometry(), computeRectDefaultSumpFeet(), computeRectPricing(), computeRectStructure(), computeRectWallHeightFeet() (+31 more)

### Community 2 - "pdf.worker.min.mjs"
Cohesion: 0.01
Nodes (227): 14(), 291(), 463(), 750(), 812(), 837(), 944(), 981() (+219 more)

### Community 3 - "getStringOption"
Cohesion: 0.02
Nodes (38): CalendarSymbols, Color, CurrencySymbol, CurrencySymbols, Data, DatePattern, DatePatterns, Day (+30 more)

### Community 5 - "XFAObject"
Cohesion: 0.01
Nodes (74): Arc, Assist, Barcode, Bind, BindItems, Bookend, Border, Break (+66 more)

### Community 6 - ".getOperatorList"
Cohesion: 0.03
Nodes (33): addCachedImageOps(), BaseLocalCache, BrotliStream, CheckedOperatorList, EvalState, fetchBinaryData(), generateFont(), getFamilyName() (+25 more)

### Community 7 - "structure-workbook.ts"
Cohesion: 0.11
Nodes (43): groupToneClasses(), pipeSizesForMaterial(), RowOpeningsEditor(), RowPenetrationsEditor(), StructureWorkbookGrid(), StructureWorkbookGridProps, uniquePipeMaterials(), applyDefaultsToBlankRow() (+35 more)

### Community 9 - "rect-structure-workbook.ts"
Cohesion: 0.07
Nodes (63): completeRectDrillSheets(), RectSheetCastingOption, RectSheetOpeningSizeOption, RectSheetTemplateOption, CompleteDrillSheetEntry, CompleteDrillSheetsClient(), handleCreate(), CompleteDrillSheetsClientProps (+55 more)

### Community 10 - "ContentObject"
Cohesion: 0.02
Nodes (24): AlwaysEmbed, BehaviorOverride, BooleanElement, ContentObject, DateElement, DateTime, DateTimeSymbols, Decimal (+16 more)

### Community 11 - "rect-template-pdf.ts"
Cohesion: 0.09
Nodes (40): sectionJointHeightsFeet(), baseOffsetText(), BLACK, buildFlaps(), buildRectSheetFieldMap(), CalloutLayout, calloutSlotTops(), consumeMarkerField() (+32 more)

### Community 12 - "DeliveryTicketEditor"
Cohesion: 0.06
Nodes (46): DeliveryTicketEditor(), addExtraCustomLine(), addExtraProduct(), addWalkInLine(), applyPickupListPrices(), buildPayload(), buildSplitDraft(), castingPiecesAreEvenSets() (+38 more)

### Community 13 - "FormatError"
Cohesion: 0.06
Nodes (15): CFFCompiler, CFFDict, CFFFDSelect, CFFIndex, CFFOffsetTracker, CFFParser, parseOperand(), CFFPrivateDict (+7 more)

### Community 14 - "drill-sheet-template-pdf.ts"
Cohesion: 0.05
Nodes (68): DrillSheetPreviewMeta, ComputedOpening, DrillSheetResult, appendDrillSheetFillablePage(), BORDER, drawField(), feet(), FieldContext (+60 more)

### Community 15 - "QuoteForm"
Cohesion: 0.06
Nodes (62): loadJobCustomStructureImportCandidates(), toPlainNumberString(), createDefaultCustomStructureRow(), createLineId(), QuoteForm(), addCategoryLine(), addLineItem(), addLineItems() (+54 more)

### Community 16 - "quote-form.tsx"
Cohesion: 0.04
Nodes (67): CustomStructureCostBreakdown(), addItem(), CustomStructureCostBreakdownProps, CustomStructureDetailBreakdown(), CustomStructurePricingFooter(), CustomStructurePricingFooterProps, AddLineModalType, CustomStructureRow (+59 more)

### Community 17 - "company-logo.ts"
Cohesion: 0.10
Nodes (35): GET(), geistMono, geistSans, generateMetadata(), RootLayout(), CompanySettingsPage(), COMPANY_LOGO_FILENAME, companyLogoApiUrl() (+27 more)

### Community 18 - "drill-sheet-detail.ts"
Cohesion: 0.06
Nodes (56): GET(), rectPreviewResponse(), RouteContext, DrillSheetDetailPage(), DrillSheetDetailPageProps, loadJobSheetNav(), RectSheetDetail(), DrillSheetPreviewPage() (+48 more)

### Community 19 - "IntegerObject"
Cohesion: 0.05
Nodes (13): AdjustData, AdobeExtensionLevel, CompressObjectStream, Copies, CurrentPage, IntegerObject, Level, MsgId (+5 more)

### Community 20 - "product-form.tsx"
Cohesion: 0.08
Nodes (30): CastingComponentPickerOption, CastingSupplierOption, drainRingDiameterOptions, ProductForm(), handleRingDiameterChange(), ProductFormProps, ProductFormValues, bulkPasteColumnHeaders (+22 more)

### Community 21 - "product-kinds.ts"
Cohesion: 0.08
Nodes (32): parseBulkPaste(), presetPreviewColumns(), diameterSupportsSanitaryDrainRing(), formatSanitaryDrainRingDiametersLabel(), parseBulkRingStyle(), bulkImportPresetLabels, bulkImportPresets, bulkPasteAdsPipeBaseHeaders (+24 more)

### Community 22 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 23 - ".createDocumentHandler"
Cohesion: 0.03
Nodes (28): AbortException, BasePdfManager, BasePDFStream, BasePDFStreamRangeReader, BasePDFStreamReader, BaseStream, clearGlobalCaches(), JpxImage (+20 more)

### Community 24 - ".getTextContent"
Cohesion: 0.13
Nodes (19): buildHuffmanTable(), ii, Intersector, addFakeSpaces(), appendEOL(), applyInverseRotation(), buildTextContentItem(), closePendingMarkedContentItems() (+11 more)

### Community 25 - "rect-sheet-persistence.ts"
Cohesion: 0.09
Nodes (52): createDrillSheet(), createRectSheet(), updateDrillSheet(), updateRectSheet(), upgradeRectSheetFromPlaceholder(), upgradeRectSheetFromPlaceholderOrThrow(), BulkSheetRowInput, BulkSheetRowResult (+44 more)

### Community 26 - "Option01"
Cohesion: 0.03
Nodes (20): AddSilentPrint, AddViewerPreferences, Change, CompressLogicalStructure, config_Encrypt, ContentCopy, DocumentAssembly, Embed (+12 more)

### Community 27 - ".getObj"
Cohesion: 0.08
Nodes (22): addHex(), BinaryCMapReader, BinaryCMapStream, Cmd, createBuiltInCMap(), expectInt(), expectString(), extendCMap() (+14 more)

### Community 28 - "delivery-tickets/pdf-actions.ts"
Cohesion: 0.05
Nodes (57): DeliveryTicketPreviewPage(), DeliveryTicketPreviewPageProps, PREVIEW_ORIGINS, DeliveryTicketSubmittalPreviewPage(), DeliveryTicketSubmittalPreviewPageProps, DeliveryTicketPdfPreviewResult, generateDeliveryTicketPdf(), GenerateDeliveryTicketPdfResult (+49 more)

### Community 29 - "galley-actions.ts"
Cohesion: 0.14
Nodes (25): injectGalleyFamilyOptions(), applyGalleyBreakdown(), ApplyGalleyBreakdownResult, BREAKDOWN_STATUSES, BreakdownDialog(), submit(), formatMixSummary(), GalleyBreakdownBanner() (+17 more)

### Community 30 - "delivery-ticket-pdf-line-items.ts"
Cohesion: 0.12
Nodes (32): COL_DESC_WIDTH, COL_DESC_X, COL_ITEM_NUM_WIDTH, COL_ITEM_NUM_X, COL_QTY_WIDTH, COL_QTY_X, DEFAULT_TABLE_LAYOUT, DeliveryTicketTableLayout (+24 more)

### Community 31 - "drain-ring-matrix-utils.ts"
Cohesion: 0.07
Nodes (40): applyAutoRingAssignment(), setAdsPipeCount(), setDrainRingCount(), DrainRingMatrixRows(), DrainRingMatrixRowsProps, DrainRingStyleTable(), DrainRingStyleTableProps, FEET_STAT_COLUMNS (+32 more)

### Community 32 - "profile/page.tsx"
Cohesion: 0.20
Nodes (9): SimilarCustomerMatch, ProfilePage(), CustomerForm(), handleSubmit(), submitForm(), CustomerFormProps, CustomerFormValues, customerInputClassName (+1 more)

### Community 33 - "drill-sheet-preview.tsx"
Cohesion: 0.11
Nodes (41): CalcRow(), DrillSheetPreview(), DrillSheetPreviewProps, feet(), HeaderRow(), PlanDiagram(), PreviewPanel(), angleToClockPosition() (+33 more)

### Community 34 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, build, db:seed, db:sync-files, deploy:build, deploy:check, deploy:start, deploy:update (+11 more)

### Community 35 - "getAppSettings"
Cohesion: 0.08
Nodes (31): EDIT_ORIGINS, EditDeliveryTicketPage(), EditDeliveryTicketPageProps, NewDeliveryTicketPage(), NewDeliveryTicketPageProps, TICKET_ORIGINS, CandidateDraft, EmptyState() (+23 more)

### Community 36 - "build"
Cohesion: 0.11
Nodes (18): build, appId, directories, extraResources, icon, nsis, productName, publish (+10 more)

### Community 37 - "drill-sheet-options.ts"
Cohesion: 0.09
Nodes (28): NewDrillSheetPage(), EditRectSheetPage(), EditRectSheetPageProps, loadPlaceholder(), NewRectSheetPage(), NewRectSheetPageProps, BulkEditPageProps, JobStructuresBulkEditPage() (+20 more)

### Community 38 - "returnActionError"
Cohesion: 0.06
Nodes (55): allocateJobNumber(), createJob(), createJobFolder(), createJobFolderOrThrow(), createJobOrThrow(), createJobStructure(), createJobStructureOrThrow(), deleteJobStructureDocumentAction() (+47 more)

### Community 39 - "money-rules.ts"
Cohesion: 0.17
Nodes (17): computeInvoiceFinancials(), computePreviewTotals(), Decimal, DecimalInstance, DecimalLike, toDecimal(), ComputedMoneyTotals, computeMoneyTotals() (+9 more)

### Community 40 - "delivery-ticket-pdf-pickup.ts"
Cohesion: 0.14
Nodes (17): FONT_SIZE, LINE_HEIGHT, ROW_PADDING, wrapText(), applyPickupTicketArtwork(), BAND_CAPTIONS, BAND_COLS, BLACK (+9 more)

### Community 41 - "withDatabaseRetry"
Cohesion: 0.04
Nodes (99): searchCustomersForWalkInTicket(), searchJobsForDeliveryTicket(), splitStructureForShipping(), unsplitStructure(), updateTicketDriver(), updateTicketTrailer(), deleteDrillSheet(), deleteDraftInvoice() (+91 more)

### Community 42 - "drill-sheet.ts"
Cohesion: 0.08
Nodes (37): annotateOpeningSections(), buildSolverHoles(), compareCost(), computeDefaultSumpFeet(), computeDrillSheet(), ComputedSection, ComputedWeights, computeInvertToTopFeet() (+29 more)

### Community 43 - ".success"
Cohesion: 0.04
Nodes (42): applyAssist(), ariaLabel(), Caption, CheckButton, checkDimensions(), ChoiceList, computeBbox(), Corner (+34 more)

### Community 44 - "prisma.ts"
Cohesion: 0.08
Nodes (21): clientHasAppSettingsFields(), createPool(), createPrismaClient(), getPrismaClient(), globalForPrisma, isConnectionError(), isPrismaClientStale(), isSchemaValidationError() (+13 more)

### Community 45 - "pipe-modal.tsx"
Cohesion: 0.11
Nodes (31): createDefaultQuoteRow(), createRowId(), PipeModal(), handleAddQuoteLines(), handleAddUnitPricesToDescription(), handleClose(), resetModal(), PipeModalMode (+23 more)

### Community 46 - "import/actions.ts"
Cohesion: 0.11
Nodes (39): buildCastingResolver(), CastingResolution, importPipeOpenings(), importPipeOpeningsOrThrow(), importRectOpenings(), importRectOpeningsOrThrow(), ImportRowInput, ImportRowMessage (+31 more)

### Community 47 - "DrillSheetForm"
Cohesion: 0.16
Nodes (13): EditDrillSheetPage(), EditDrillSheetPageProps, buildCommittedPreview(), DrillSheetForm(), addOpening(), commitNumericField(), flushPreviewNumbers(), handleNumericBlur() (+5 more)

### Community 48 - "shipping/actions.ts"
Cohesion: 0.12
Nodes (29): lookupShippingRate(), lookupShippingRateAtPoint(), resolveShippingRateForPoint(), ShippingLookupResult, ShippingLookupSuccess, suggestShippingAddresses(), AddressAutocomplete(), closeDropdown() (+21 more)

### Community 50 - "XMLParserBase"
Cohesion: 0.06
Nodes (7): DatasetXMLParser, MetadataParser, SimpleDOMNode, SimpleXMLParser, XFAParser, XMLParserBase, skipWs()

### Community 51 - "auth/constants.ts"
Cohesion: 0.07
Nodes (44): NAV_ICON_PATHS, NavIconId, NavItem, navItems, NavSection, NavSectionId, navSections, PermissionRouteGuard() (+36 more)

### Community 52 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, leaflet, next, nodemailer, pdf-lib, @pdf-lib/fontkit, pdf-to-printer, pdfjs-dist (+11 more)

### Community 53 - "customer-mapper.ts"
Cohesion: 0.05
Nodes (49): BulkContactPasteForm(), handleImport(), handleParsePreview(), parseBulkContactPaste(), handleParsePreview(), parseBulkPaste(), ContactFormState, CustomerContactsPanelProps (+41 more)

### Community 54 - "structures/actions.ts"
Cohesion: 0.12
Nodes (29): assertDiametersHaveMolds(), createStructureTemplate(), createStructureTemplateOrThrow(), duplicateStructureTemplate(), handlePrismaError(), loadCastingProductOptions(), parseTemplatePayload(), resolvePriceListIdForTemplateSave() (+21 more)

### Community 55 - "bulk-load-planner.tsx"
Cohesion: 0.07
Nodes (53): DeliveryTicketLineInput, discardSavedLoadPlan(), PlannedLoadInput, saveLoadPlanForLater(), savePlannedLoads(), SavePlannedLoadsInput, buildRows(), BulkLoadPlanner() (+45 more)

### Community 57 - "customer-name-similarity.ts"
Cohesion: 0.36
Nodes (11): compactCustomerName(), compactSimilarity(), CustomerNameCandidate, getCustomerNameSimilarity(), jaccardSimilarity(), levenshteinDistance(), levenshteinRatio(), normalizeCustomerName() (+3 more)

### Community 64 - "rect-sheet-detail-view.tsx"
Cohesion: 0.14
Nodes (26): aboveFloorText(), fmtElevation(), InfoRow(), placementText(), RectSheetDetailView(), RectSheetDetailViewProps, Stat(), wholeInches() (+18 more)

### Community 65 - "quote-mapper.ts"
Cohesion: 0.06
Nodes (51): EditQuoteRectStructuresPage(), EditQuoteRectStructuresPageProps, EditQuoteStructuresPage(), EditQuoteStructuresPageProps, QuotePreviewPage(), QuotePreviewPageProps, QUOTE_LIST_SELECT, statusWhereFor() (+43 more)

### Community 66 - "Handy Commands — Precast App"
Cohesion: 0.15
Nodes (13): App (Next.js), Browse data, Daily workflow, Database backups, Electron desktop client, Git / GitHub (optional), Handy Commands — Precast App, Office deployment (Windows server) (+5 more)

### Community 67 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, electron, electron-builder, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+8 more)

### Community 68 - "delivery-tickets/actions.ts"
Cohesion: 0.07
Nodes (38): assertQuoteLinkable(), buildLineCreates(), buildLinesPayload(), createDeliveryTicket(), DeliveryTicketActionResult, DeliveryTicketJobSearchOption, GenerateTicketSubmittalResult, parseDate() (+30 more)

### Community 69 - "date-only.ts"
Cohesion: 0.06
Nodes (63): UpdateTicketDriverResult, AllDeliveryTicketsPage(), VALID_DELIVERY_STATUSES, DeliveryTicketsPage(), formatWeight(), buildDeliveryFilterOptions(), deliveryDateFilterOptions, DeliveryFilterOptions (+55 more)

### Community 70 - "PsNode"
Cohesion: 0.16
Nodes (8): _nodesEqual(), PsArgNode, PsBinaryNode, PsConstNode, PsNode, PSStackToTree, PsTernaryNode, PsUnaryNode

### Community 71 - "quote-pdf-line-items.ts"
Cohesion: 0.08
Nodes (45): COL_DESC_WIDTH, COL_DESC_X, COL_ITEM_NUM_WIDTH, COL_ITEM_NUM_X, COL_QTY_WIDTH, COL_QTY_X, COL_TOTAL_WIDTH, COL_TOTAL_X (+37 more)

### Community 72 - "job-detail-mapper.ts"
Cohesion: 0.03
Nodes (110): JobTabContent(), JobTabContentProps, JobDetailPage(), JobDetailPageProps, resolveTab(), VALID_TABS, MarkAllSubmittedButton(), ChevronIcon() (+102 more)

### Community 73 - "DeliveryTicketDetailContent"
Cohesion: 0.15
Nodes (13): generateDeliveryTicketSubmittalPackage(), DeliveryTicketDetailContent(), formatLineType(), isBlank(), OptionalField(), paymentMethodLabel(), RelatedRecordRow(), StatItem() (+5 more)

### Community 74 - "casting-utils.ts"
Cohesion: 0.13
Nodes (16): buildCastingBomFromProductCodes(), CastingAssemblyBomImportRow, castingAssemblyBomRoleOrder, castingAssemblyOptionalBomRoles, castingAssemblyRequiredBomRoles, CastingBomRowInput, CastingComponentLookup, CastingComponentOption (+8 more)

### Community 75 - "delivery-ticket-pdf-fill.ts"
Cohesion: 0.12
Nodes (29): computeTotalPieces(), DbDeliveryTicketForPdf, DELIVERY_TICKET_PDF_INCLUDE, mapLineItemsForPdf(), buildContentPageBytes(), buildCopyPdfBytes(), fillAcroFormFields(), fitTermsField() (+21 more)

### Community 76 - "settings/products/page.tsx"
Cohesion: 0.06
Nodes (42): GlobalError(), isStaleDeploymentError(), NotFound(), ProductCatalogSettingsPage(), ProductCatalogSettingsPageProps, DeleteCustomerButton(), DeleteCustomerButtonProps, formatDateOnly() (+34 more)

### Community 77 - "SectionCard"
Cohesion: 0.05
Nodes (86): ensureYearSequencesAction(), removeCompanyLogoFormAction(), revalidateSettingsPaths(), syncAllJobFilesFromSettingsAction(), testJobsRootWriteAccessAction(), testStockSubmittalsRootWriteAccessAction(), updateCompanySettingsFormAction(), updateFileSettingsFormAction() (+78 more)

### Community 78 - ".constructor"
Cohesion: 0.11
Nodes (9): BaseShading, buildMeshVertexData(), DummyShading, FunctionBasedShading, getB(), MeshShading, MeshStreamReader, Pattern (+1 more)

### Community 79 - "rect-pdf-set-service.ts"
Cohesion: 0.09
Nodes (33): getRectPdfSetsRoot(), PDF_EXTENSIONS, readRectPdfSetFileBytes(), rectPdfSetRelativePath(), RectSheetPdfSetFileRecord, resolveUnderRoot(), saveRectPdfSetFile(), SetFileKey (+25 more)

### Community 80 - "delivery-fulfillment.ts"
Cohesion: 0.09
Nodes (45): validateLines(), loadCastingComponentOptionsByAssembly(), loadCastingComponentOptionsForAssembly(), AdsPipeOption, allLineageIds(), buildFulfillmentFromContext(), buildQuoteLineAliasMap(), buildQuoteLineLineageMap() (+37 more)

### Community 81 - "inventory/page.tsx"
Cohesion: 0.04
Nodes (82): AGGREGATE_SORT_COLUMNS, CONTACT_SORT_COLUMNS, ContactSortColumn, CUSTOMER_SORT_FIELDS, CustomerSortColumn, CustomersPage(), isAggregateSortColumn(), loadCustomerAggregates() (+74 more)

### Community 82 - "react"
Cohesion: 0.03
Nodes (90): FormTypeahead(), closeDropdown(), handleContainerBlur(), handleKeyDown(), handleSelect(), FormTypeaheadProps, BulkPasteForm(), handleImport() (+82 more)

### Community 83 - "calibrate-rect-templates.ts"
Cohesion: 0.07
Nodes (33): BASE_SLAB_ONLY_FIELDS, RECT_EXPLODED_CENTER_MARKER_FIELD, RECT_EXPLODED_MARKER_FIELD, RECT_OPENING_ROWS, RECT_SHEET_TEMPLATE_FIELD_NAMES, RECT_TOP_SLAB_MARKER_FIELD, RECT_WEIGHT_PIECE_LINES, TOP_SLAB_ONLY_FIELDS (+25 more)

### Community 84 - "AGENTS.md"
Cohesion: 0.38
Nodes (4): Codebase exploration: use graphify first, Prisma / Database Rules, Project context, This is NOT the Next.js you know

### Community 85 - "quote-pdf-html.ts"
Cohesion: 0.42
Nodes (7): getCompanyLogoDataUri(), buildQuotePdfHtml(), escapeHtml(), fieldBlock(), notesBlock(), isCategoryLineItem(), QuoteDetailView

### Community 86 - "invoicing-service.ts"
Cohesion: 0.12
Nodes (18): batchConvertDeliveredTicketsToInvoices(), BatchInvoiceConversionResult, CastingSetCharge, castingSetsStarted(), convertDeliveryTicketToInvoice(), InvoiceAlreadyExistsError, invoiceDueDateFromDelivery(), mapDeliveryLineTypeToInvoiceLineType() (+10 more)

### Community 87 - "XhtmlObject"
Cohesion: 0.04
Nodes (18): B, Body, Br, hl, Html, $i, layoutText(), li (+10 more)

### Community 88 - "PDFDocument"
Cohesion: 0.06
Nodes (5): addChildren(), DataHandler, ObjectLoader, PDFDocument, XFAFactory

### Community 89 - "purchase-orders/actions.ts"
Cohesion: 0.06
Nodes (57): InventoryProductSearchOption, resolveReceivingCategory(), saveInventoryAdjustment(), savePurchaseReceipt(), searchInventoryProducts(), saveDailyProductionDay(), saveProductionEntry(), createPurchaseOrder() (+49 more)

### Community 90 - ".getBytes"
Cohesion: 0.03
Nodes (30): Ascii85Stream, AsciiHexStream, bytesToString(), CCITTFaxStream, CFF, CFFCharset, CFFHeader, CipherTransform (+22 more)

### Community 91 - "contact-actions.ts"
Cohesion: 0.10
Nodes (35): addCustomerContact(), BulkContactDbState, BulkContactImportRow, checkBulkContactDbState(), CONTACT_ROLES, CustomerContactInput, deleteCustomerContact(), importContacts() (+27 more)

### Community 92 - "job-structure-import-dialog.tsx"
Cohesion: 0.11
Nodes (29): importJobStructuresFromConfigs(), JobStructureImportEntry, JobStructureImportResult, buildPreview(), Cell, detectShape(), ImportOptions, JobStructureImportButton() (+21 more)

### Community 93 - "settings/actions.ts"
Cohesion: 0.10
Nodes (40): checkJobsRootReadAccess(), clearAllCustomersFormAction(), clearAllCustomersOrThrow(), clearAllDeliveryTicketsFormAction(), clearAllDeliveryTicketsOrThrow(), clearAllJobsFormAction(), clearAllJobsOrThrow(), clearAllProductsFormAction() (+32 more)

### Community 94 - "plan-sheet-actions.ts"
Cohesion: 0.06
Nodes (67): GET(), RouteContext, ExplorerOpenResult, listJobsMissingFolders(), listRecentFiles(), openJobFile(), openJobFolderCategory(), revalidateFilesPaths() (+59 more)

### Community 95 - "quotes/actions.ts"
Cohesion: 0.06
Nodes (59): assertGalleyFamiliesExist(), computeQuoteFinancials(), createQuote(), CreateQuoteInput, CreateQuoteLineItemInput, DeleteQuoteResult, isQuoteNumberConflict(), parseOptionalDate() (+51 more)

### Community 97 - "input.tsx"
Cohesion: 0.40
Nodes (3): inputClassName, InputProps, textareaClassName

### Community 98 - "Precast Ops desktop updates"
Cohesion: 0.40
Nodes (4): Precast Ops desktop updates, Publish a desktop update (from the dev PC), Verify (from any office PC), Which machine does what

### Community 99 - "price-list-service.ts"
Cohesion: 0.13
Nodes (22): deleteStructureTemplate(), decimalToString(), EditStructureTemplatePage(), EditStructureTemplatePageProps, PipeOpeningSizesPage(), PipeOpeningSizesPageProps, RectOpeningSizesPage(), RectOpeningSizesPageProps (+14 more)

### Community 100 - "sheet-pdfs/actions.ts"
Cohesion: 0.15
Nodes (25): GET(), RouteContext, createSheetPdfSetAction(), deleteSheetPdfSetAction(), deleteSheetPdfSetFileAction(), deleteSheetPdfSetOrThrow(), parseBooleanField(), renameSheetPdfSetAction() (+17 more)

### Community 101 - "XmlObject"
Cohesion: 0.04
Nodes (15): Binder, createText(), Datasets, datasets_Data, DatasetsNamespace, Items, JBig2CCITTFaxImage, Jbig2Error (+7 more)

### Community 102 - "invoice-pdf-fill.ts"
Cohesion: 0.07
Nodes (44): buildInvoicePageBytes(), drawDraftWatermark(), ensureInvoiceTemplateExists(), fillAcroFormFields(), getInvoiceContinuationTemplatePath(), getInvoiceTemplatePath(), readInvoiceContinuationTemplateBytes(), readInvoiceTemplateBytes() (+36 more)

### Community 105 - "structure-workbook.tsx"
Cohesion: 0.13
Nodes (27): PlanSheetRecord, DrillSheetTemplateOption, JobSheetImportDialog(), pipeSizesForMaterial(), StructureWorkbookDefaultsPanel(), StructureWorkbookDefaultsPanelProps, uniquePipeMaterials(), createInitialWorkbookRows() (+19 more)

### Community 106 - "product-taxonomy.server.ts"
Cohesion: 0.16
Nodes (25): handleCategoryChange(), handleProductKindChange(), handleProductTypeChange(), ensureTaxonomyForBulkImport(), fetchActiveProductTaxonomy(), resolveTaxonomiesByNamesForImport(), resolveTaxonomyByNamesForImport(), validateTaxonomySelection() (+17 more)

### Community 108 - "generate-invoice-templates.ts"
Cohesion: 0.12
Nodes (25): CONT_TABLE_BOTTOM_Y, MAIN_TABLE_BOTTOM_Y, addTextField(), BLACK, BOTTOM_BOX, buildTemplate(), Ctx, drawBox() (+17 more)

### Community 110 - "send-actions.ts"
Cohesion: 0.05
Nodes (66): generateQuotePdf(), findSupersededBy(), getSendQuoteDefaults(), getSendQuoteEmailConfigured(), OpenOutlookDraftResult, openQuoteInOutlook(), sendQuote(), SendQuoteDefaults (+58 more)

### Community 111 - "delivery-ticket-pdf-data.ts"
Cohesion: 0.16
Nodes (21): blankOr(), buildDeliveryTicketFormData(), DbCustomer, DbJob, DeliveryTicketContentPage, DeliveryTicketPdfFillOptions, DeliveryTicketPdfLineItem, displayOrDash() (+13 more)

### Community 112 - "translatePrismaError"
Cohesion: 0.07
Nodes (50): BulkImportRow, checkBulkCustomerDbDuplicates(), createCustomer(), CUSTOMER_STATUSES, CustomerRecordInput, deleteCustomer(), findSimilarCustomers(), importCustomers() (+42 more)

### Community 114 - "reloadAfterAction"
Cohesion: 0.03
Nodes (105): getJobFilesForBrowser(), listJobFilesAction(), uploadJobFileAction(), JobFilesPage(), JobFilesPageProps, uploadJobStructureDocumentAction(), EditJobPage(), EditJobPageProps (+97 more)

### Community 115 - "drill-sheet-form.tsx"
Cohesion: 0.06
Nodes (42): CommittedOpeningNumbers, CommittedPreviewNumbers, connectionOptions, createOpening(), DiameterConfigOption, DrillSheetFormProps, DrillSheetJobOption, initialOpenings() (+34 more)

### Community 117 - "quote-form-data.ts"
Cohesion: 0.11
Nodes (28): reloadQuoteFormPriceOptions(), EditQuotePage(), EditQuotePageProps, NewQuotePage(), NewQuotePageProps, collectRingOtherSubcategories(), formatJobAddress(), loadPipeProductsForQuoteForm() (+20 more)

### Community 118 - "windows-explorer.ts"
Cohesion: 0.08
Nodes (38): openProductSubmittalsFolderOrThrow(), ClientPathMapping, getClientPathMappings(), stripTrailingSeparators(), toClientOpenPath(), translateToClientPath(), assertPathUnderRoot(), normalizePath() (+30 more)

### Community 119 - "._parseBlock"
Cohesion: 0.15
Nodes (7): ast_Parser, PsBlock, PsIf, PsIfElse, PsNumber, PsOperator, PsProgram

### Community 120 - "app/products/page.tsx"
Cohesion: 0.17
Nodes (22): listStockProductsForTicket(), DetailField(), ProductDetailPage(), ProductDetailPageProps, buildProductOrderBy(), PRODUCT_SORT_COLUMNS, ProductSortColumn, ProductsPage() (+14 more)

### Community 121 - "shipping-zones-manager.tsx"
Cohesion: 0.15
Nodes (24): createShippingZone(), deleteShippingZone(), revalidateShippingZonePaths(), setYardLocation(), ShippingZoneInput, updateShippingZone(), ValidatedZone, validateZoneInput() (+16 more)

### Community 122 - "Office deployment — single Windows server + UNC job folders"
Cohesion: 0.11
Nodes (18): Architecture, End-to-end smoke test, Firewall, Important behavior, Install prerequisites, Office deployment — single Windows server + UNC job folders, Ongoing maintenance, Phase 1 — Prepare the Windows server (+10 more)

### Community 123 - "Office rollout checklist"
Cohesion: 0.12
Nodes (17): 1. Server URL for the desktop app, 2. First install on each staff PC, 3. Staff expectations, 4. Role walkthrough (recommended), 5. Backups, 6. Support contacts, 7. Post-rollout verification (first week), Database (nightly recommended) (+9 more)

### Community 124 - "app_generated_prisma_client"
Cohesion: 0.05
Nodes (83): GET(), GET(), DeliveryTicketDetailPage(), DeliveryTicketDetailPageProps, DraftInvoiceLineInput, EDITABLE_INVOICE_STATUSES, getDraftInvoiceEditorData(), getInvoiceTabCounts() (+75 more)

### Community 125 - "job-structure-detail-content.tsx"
Cohesion: 0.17
Nodes (11): DrillSheetPdfLink(), JobStructureDetailContent(), runAction(), JobStructureDetailContentProps, ApproveForProductionDialog(), groupByJob(), isProductionTabId(), ProductionBoard() (+3 more)

### Community 126 - "drill-sheets/pdf-actions.ts"
Cohesion: 0.08
Nodes (42): generateDrillSheetPdf(), GenerateDrillSheetPdfResult, generateJobDrillSheetsPdf(), GenerateJobDrillSheetsPdfResult, generateRectSheetPdf(), DrillSheetPdfButtonProps, DrillSheetPdfCanvasPreview(), loadPdf() (+34 more)

### Community 127 - "delivery-ticket-pdf-html.ts"
Cohesion: 0.35
Nodes (11): CompanyProfile, DeliveryTicketCopySettings, DeliveryTicketPdfView, getDeliveryTicketCopyTitles(), addressBlockHtml(), buildDeliveryTicketPdfHtml(), escapeHtml(), optionalNote() (+3 more)

### Community 128 - ".get"
Cohesion: 0.03
Nodes (46): 835(), ButtonWidgetAnnotation, addPageDict(), appendIfJavaScriptDict(), parseNestedOrder(), parseOnOff(), parseOrder(), ChoiceWidgetAnnotation (+38 more)

### Community 129 - ".getUint16"
Cohesion: 0.20
Nodes (13): decodeScan(), decodeHuffman(), readBit(), receive(), receiveAndExtend(), DNLMarkerError, EOIMarkerError, findNextFileMarker() (+5 more)

### Community 130 - "delivery-schedule-pdf-html.ts"
Cohesion: 0.13
Nodes (25): DailyProductionPage(), DailyProductionPageProps, DailyProductionDayEntry, DailyProductionStockProduct, DailyProductionStructureRow, getProductionDayEntries(), getStockProductsForDaily(), getStructuresInProductionForDaily() (+17 more)

### Community 131 - "app_generated_prisma_client_prismaclient"
Cohesion: 0.18
Nodes (16): DEFAULT_APP_SETTINGS_DATA, DEFAULT_SEED_LOGO_PDF_PATH, decodeApiKey(), PrismaDevPayload, resolveDatabaseUrl(), resolvePrismaDevPayload(), resolveShadowDatabaseUrl(), databaseUrl (+8 more)

### Community 134 - "Deployment server info checklist"
Cohesion: 0.22
Nodes (9): Database, Deployment server info checklist, Electron client, File shares (UNC), Network, PDF generation, Post-deploy verification, Server (+1 more)

### Community 136 - "app-settings.ts"
Cohesion: 0.10
Nodes (30): AppSettingsView, DEFAULT_DELIVERY_TICKET_COPY1_TITLE, DEFAULT_DELIVERY_TICKET_COPY2_TITLE, DEFAULT_DELIVERY_TICKET_COPY3_TITLE, DEFAULT_DELIVERY_TICKET_FOOTER_TEXT, DEFAULT_DRIVERS, DEFAULT_ESTIMATORS, DEFAULT_PAYMENT_TERMS (+22 more)

### Community 137 - "Troubleshooting"
Cohesion: 0.33
Nodes (6): `P1001` — Can't reach database server, Password authentication failed, Port 3000 already in use, Prisma Studio — "Could not load schema metadata", Quote PDF — "Could not find Chrome" / browser not found, Troubleshooting

### Community 138 - "invoice-pdf-data.ts"
Cohesion: 0.15
Nodes (19): removeAdsJointTypeSuffix(), removeTrailingRingHeightSuffix(), resolveLineDescription(), buildDraftInvoiceCoverHtml(), escapeHtml(), formatDate(), money(), blankOr() (+11 more)

### Community 139 - "structure-workbook-plan-takeoff.tsx"
Cohesion: 0.09
Nodes (32): pipeSizesForMaterial(), uniquePipeMaterials(), bearingFromDelta(), commitRow(), DragState, pdfToScreen(), PipePopup(), polarToScreenPoint() (+24 more)

### Community 141 - "Precast Ops"
Cohesion: 0.40
Nodes (5): Desktop shell (optional), Local development, Office deployment, Precast Ops, Project docs

### Community 142 - "job-structure-detail-mapper.ts"
Cohesion: 0.06
Nodes (52): BulkAttachPage(), JobProgressLine, JobProgressSummary, JobProgressView, JobStructureProgressLine, BulkAttachBoard(), getTile(), handleFiles() (+44 more)

### Community 150 - "XRef"
Cohesion: 0.05
Nodes (13): ARCFourCipher, calculateMD5(), CipherTransformFactory, fs, InvalidPDFException, JpxError, ParserEOFException, PasswordException (+5 more)

### Community 151 - "pdfjs-dist"
Cohesion: 0.17
Nodes (12): DraftBatchPreviewPage(), renderPage(), renderPage(), DraftBatchPreviewContent(), loadDocument(), renderPage(), renderPage(), loadPdf() (+4 more)

### Community 152 - "FontFinder"
Cohesion: 0.16
Nodes (4): FontFinder, FontInfo, FontSelector, makeObj()

### Community 154 - "calculateSHA512"
Cohesion: 0.09
Nodes (16): AES128Cipher, AES256Cipher, AESBaseCipher, calculateSHA384(), calculateSHA512(), ch(), littleSigma(), littleSigmaPrime() (+8 more)

### Community 155 - "receiving-utils.ts"
Cohesion: 0.11
Nodes (30): InventoryReceiptsPage(), InventoryReceiptsPageProps, ReceivingPage(), accentBorderStyles, CategoryCardProps, ReceivingCategoryCard(), formatCalendarDateShort(), mapPurchaseOrderDetail() (+22 more)

### Community 156 - "Builder"
Cohesion: 0.13
Nodes (4): Builder, Empty, Root, UnknownNamespace

### Community 157 - "ref_path"
Cohesion: 0.08
Nodes (23): dynamic, GET(), readBuildId(), CONTENT_TYPES, RouteContext, UPDATES_DIR, puppeteer, templatePath (+15 more)

### Community 158 - "ring-builder-modal.tsx"
Cohesion: 0.08
Nodes (51): updateRingBuilderSettingsFormAction(), saveRingBuilderSettings(), createDefaultHeightPoolRow(), createRowId(), formatRingBuilderUnitPrice(), HeightPoolRow, initOtherInputs(), OtherProductInput (+43 more)

### Community 159 - "ColorSpace"
Cohesion: 0.11
Nodes (4): ColorSpace, DeviceGrayCS, DeviceRgbCS, PatternCS

### Community 160 - "rect-structure-import.ts"
Cohesion: 0.16
Nodes (19): RectImportDialog(), handlePasteParse(), RectImportDialogProps, Cell, cellText(), findHeaderRow(), gridFromTsv(), normalizeHeader() (+11 more)

### Community 161 - "Glyph"
Cohesion: 0.16
Nodes (3): CompositeGlyph, GlyfTable, Glyph

### Community 162 - "product-groups/page.tsx"
Cohesion: 0.21
Nodes (12): reorderProductGroupMembers(), GroupEditor(), GroupWithMembers, ProductGroupsPage(), GroupMemberReorderTable(), clearDrag(), insertionIndexFor(), onRowDragOver() (+4 more)

### Community 163 - "casting-ticket-lines.ts"
Cohesion: 0.25
Nodes (8): CastingCollapseMeta, CastingCollapsibleLine, CastingExplodeComponent, CastingExplodedPiece, collapseCastingTicketLines(), perSetByProduct(), setWeightFor(), META

### Community 165 - "main.mjs"
Cohesion: 0.06
Nodes (43): __dirname, getUserConfigPath(), loadConfig(), readJsonFile(), validateServerUrl(), buildApplicationMenu(), checkForNewServerBuild(), clearWebCache() (+35 more)

### Community 166 - "session-keep-alive.tsx"
Cohesion: 0.52
Nodes (5): keepSessionAlive(), recordPing(), SessionKeepAlive(), ping(), shouldPing()

### Community 168 - "submittal-package.ts"
Cohesion: 0.10
Nodes (45): openProductDocumentOrThrow(), getCompanyProfile(), getStockSubmittalsRoot(), getSubmittalsJobSubfolder(), assertPathUnderStockSubmittalsRoot(), assertProductExists(), buildSubmittalPackageBaseName(), collectSubmittalFilesForCode() (+37 more)

### Community 169 - "job-sheet-import-actions.ts"
Cohesion: 0.15
Nodes (16): JobCustomStructureImportCandidate, JobSheetImportCandidate, JobSheetImportCandidates, loadJobSheetImportCandidates(), STATUS_LABELS, JobSheetImportDialogProps, DecimalLike, decimalToInput() (+8 more)

### Community 172 - ".push"
Cohesion: 0.03
Nodes (53): AnnotationFactory, CaretAnnotation, CircleAnnotation, computeIDs(), core_utils_numberToString(), createImage(), createImageDict(), createPNGLikeImage() (+45 more)

### Community 173 - "ExclGroup"
Cohesion: 0.06
Nodes (9): addHTML(), Area, createLine(), ExclGroup, flushHTML(), getAvailableSpace(), getContainedChildren(), Subform (+1 more)

### Community 174 - "ChunkedStream"
Cohesion: 0.10
Nodes (4): arrayBuffersToBytes(), ChunkedStream, ChunkedStreamManager, MissingDataException

### Community 175 - "StringObject"
Cohesion: 0.02
Nodes (43): Amd, AppearanceFilter, Base, Certificate, config_Picture, connection_set_Uri, ConnectionSet, ConnectionSetNamespace (+35 more)

### Community 176 - "walk-ins-board.tsx"
Cohesion: 0.23
Nodes (14): MarkPickedUpControl(), handleConfirm(), MarkPickedUpControlProps, BadgeVariant, CalledInPickupCard(), CompletedPickupCard(), dateLine(), itemsPaymentLine() (+6 more)

### Community 177 - "receiving/receive/page.tsx"
Cohesion: 0.39
Nodes (8): mapOpenPurchaseOrders(), ReceivePage(), ReceivePageProps, loadCastingAssembliesWithBom(), listOpenPurchaseOrders(), castingOriginForCategory(), isCastingReceivingCategory(), isPipeReceivingCategory()

### Community 182 - "zone-map.tsx"
Cohesion: 0.28
Nodes (8): ZoneMap, ClickCapture(), FlyToPin(), ZoneMap(), ZoneMapProps, ResolvableZone, leaflet, react-leaflet

### Community 184 - ".compile"
Cohesion: 0.43
Nodes (4): encodeASCIIString(), section(), unsignedLEB128(), vec()

### Community 186 - "package.json"
Cohesion: 0.08
Nodes (24): eslintConfig, main, name, postcss, overrides, @hono/node-server, next, private (+16 more)

### Community 187 - "DashboardShell"
Cohesion: 0.09
Nodes (42): BulkCustomersPage(), BulkContactsPage(), EditCustomerPage(), EditCustomerPageProps, CustomerNotFound(), NewCustomerPage(), InventoryAdjustPage(), InventoryProductionPage() (+34 more)

### Community 188 - ".add"
Cohesion: 0.04
Nodes (21): Commands, compileCharString(), bezierCurveTo(), lineTo(), moveTo(), CompiledFont, compileGlyf(), lineTo() (+13 more)

### Community 189 - "product-export.ts"
Cohesion: 0.10
Nodes (26): AdsPipeJointType, adsPipeJointTypeFormOptions, adsPipeJointTypeLabels, formatAdsPipeJointTypeLabel(), normalizeAdsPipeJointType(), parseAdsPipeJointType(), formatCastingRoleLabel(), buildCustomersExportBuffer() (+18 more)

### Community 192 - "customers/[id]/page.tsx"
Cohesion: 0.40
Nodes (5): CustomerDetailPage(), CustomerDetailPageProps, CustomerDetailContent(), sectionCount(), StatTile()

### Community 193 - "invoice-mapper.ts"
Cohesion: 0.53
Nodes (5): formatDate(), formatMoney(), InvoiceDetailView, mapDbInvoiceToDetailView(), statusVariant()

### Community 195 - "PipeOpeningSizesForm"
Cohesion: 0.50
Nodes (3): createRow(), PipeOpeningSizesForm(), uid()

### Community 196 - "custom-structure-import.ts"
Cohesion: 0.14
Nodes (20): importCustomJobStructures(), importCustomJobStructuresOrThrow(), JobCustomStructureImportButton(), handleFile(), handleImport(), parseGrid(), Cell, cellText() (+12 more)

### Community 197 - "RectOpeningSizesForm"
Cohesion: 0.50
Nodes (3): createRow(), RectOpeningSizesForm(), uid()

### Community 204 - "product-mapper.ts"
Cohesion: 0.17
Nodes (17): formatProductKindBadgeLabel(), categoryVariant(), documentTypeLabel(), formatDecimal(), formatDocumentDate(), formatFileSize(), formatYesNo(), mapProductToDetail() (+9 more)

### Community 208 - "contentDisposition"
Cohesion: 0.10
Nodes (35): GET(), parseCopyParam(), RouteContext, GET(), RouteContext, GET(), parseDateParam(), GET() (+27 more)

### Community 209 - "generate-circular-import-template.mjs"
Cohesion: 0.06
Nodes (32): handleFile(), handleFile(), xlsx, colWidths, EXAMPLE_ROWS, exampleSheet, HEADERS, INSTRUCTIONS (+24 more)

### Community 227 - "rect-bulk-grid.tsx"
Cohesion: 0.09
Nodes (45): RectOpeningField, RectSheetFormValues, circularPayloadFromValues(), rectPayloadFromValues(), focusGridCell(), formatBrickInches(), formatElevation(), formatFeet() (+37 more)

### Community 242 - ".checkAndRepair"
Cohesion: 0.06
Nodes (30): adjustMapping(), amendFallbackToUnicode(), CFFFont, convertCidString(), createCmapTable(), createNameTable(), createOS2Table(), createPostscriptName() (+22 more)

### Community 243 - "ConfigNamespace"
Cohesion: 0.01
Nodes (78): Acrobat, Acrobat7, ADBE_JSConsole, ADBE_JSDebugger, Agent, AutoSave, BatchOutput, Cache (+70 more)

### Community 248 - "LabCS"
Cohesion: 0.14
Nodes (3): CalGrayCS, DeviceCmykCS, LabCS

### Community 260 - "next"
Cohesion: 0.04
Nodes (127): where, ProductInventoryPage(), ProductInventoryPageProps, CompactTable(), Home(), CastingSuppliersPageProps, VendorsPageProps, StructuresPage() (+119 more)

### Community 261 - "Annotation"
Cohesion: 0.04
Nodes (24): Annotation, buildPostScriptWasmFunction(), ColorSpaceUtils, getColorConversionBatchSize(), getNewAnnotationsMap(), getRgbColor(), getTilingPatternIR(), getTransformMatrix() (+16 more)

### Community 311 - "Phase 6 — Electron client (staff PCs)"
Cohesion: 0.25
Nodes (8): A. Server app updates (quotes, jobs, UI — most changes), B. Desktop shell updates (Electron auto-update), Build the installer, C. Server URL change only, Client updates (auto-update from server), Install on each desk PC, Local development with Electron, Phase 6 — Electron client (staff PCs)

### Community 315 - "warn"
Cohesion: 0.03
Nodes (26): AppearanceStreamEvaluator, Catalog, addPageError(), CmykICCBasedCS, createDataNode(), createValidAbsoluteUrl(), DatasetReader, decodeString() (+18 more)

### Community 330 - "allowScripts"
Cohesion: 0.25
Nodes (8): allowScripts, electron@35.7.5, esbuild@0.28.1, prisma@7.8.0, @prisma/engines@7.8.0, puppeteer@25.1.0, sharp@0.34.5, unrs-resolver@1.12.2

### Community 333 - "Security posture: internal, trusted-network tool"
Cohesion: 0.67
Nodes (3): Authentication today, Authorization, Security posture: internal, trusted-network tool

### Community 336 - "PDFImage"
Cohesion: 0.08
Nodes (5): convertBlackAndWhiteToRGBA(), convertToRGBA(), ImageResizer, JpegStream, PDFImage

## Knowledge Gaps
- **1362 isolated node(s):** `dynamic`, `RouteContext`, `RouteContext`, `RouteContext`, `RouteContext` (+1357 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2406 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **49 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `util_shadow()` connect `warn` to `.get`, `pdf.worker.min.mjs`, `Annotation`, `XmlObject`, `.getOperatorList`, `.success`, `FormatError`, `PDFImage`, `.checkAndRepair`, `react`, `XMLParserBase`, `XRef`, `.createDocumentHandler`, `LabCS`, `.getBytes`, `PDFDocument`, `.add`, `ColorSpace`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `TemplateNamespace` connect `XFAObject` to `.get`, `pdf.worker.min.mjs`, `getStringOption`, `ContentObject`, `.success`, `ExclGroup`, `StringObject`, `PDFImage`, `reloadAfterAction`, `ConfigNamespace`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `vitest` connect `prisma.ts` to `rect-structure.ts`, `delivery-schedule-pdf-html.ts`, `invoice-pdf-data.ts`, `QuoteForm`, `drill-sheet-detail.ts`, `receiving-utils.ts`, `galley-actions.ts`, `ring-builder-modal.tsx`, `drain-ring-matrix-utils.ts`, `rect-structure-import.ts`, `casting-ticket-lines.ts`, `returnActionError`, `money-rules.ts`, `withDatabaseRetry`, `drill-sheet.ts`, `job-sheet-import-actions.ts`, `auth/constants.ts`, `customer-mapper.ts`, `structures/actions.ts`, `package.json`, `quote-mapper.ts`, `delivery-tickets/actions.ts`, `custom-structure-import.ts`, `date-only.ts`, `quote-pdf-line-items.ts`, `job-detail-mapper.ts`, `delivery-ticket-pdf-fill.ts`, `rect-pdf-set-service.ts`, `delivery-fulfillment.ts`, `generate-circular-import-template.mjs`, `invoicing-service.ts`, `quotes/actions.ts`, `rect-bulk-grid.tsx`, `sheet-pdfs/actions.ts`, `price-list-service.ts`, `send-actions.ts`, `reloadAfterAction`, `windows-explorer.ts`, `app_generated_prisma_client`, `drill-sheets/pdf-actions.ts`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **What connects `dynamic`, `RouteContext`, `RouteContext` to the rest of the system?**
  _1362 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app/products/actions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06010230179028133 - nodes in this community are weakly interconnected._
- **Should `rect-structure.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `pdf.worker.min.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.009088209088209087 - nodes in this community are weakly interconnected._