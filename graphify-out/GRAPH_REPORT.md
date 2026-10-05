# Graph Report - precastapp  (2026-10-04)

## Corpus Check
- 821 files · ~510,119 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 3, .mdc 2, .example 1)

## Summary
- 9083 nodes · 27823 edges · 222 communities (168 shown, 54 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 282 edges (avg confidence: 0.92)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5656047b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app/products/actions.ts
- rect-structure.ts
- pdf.worker.min.mjs
- LocaleSetNamespace
- XFAObject
- .getOperatorList
- structure-workbook.ts
- rect-structure-workbook.ts
- ContentObject
- rect-template-pdf.ts
- delivery-ticket-editor.tsx
- .parse
- drill-sheet-template-pdf.ts
- QuoteForm
- quote-form.tsx
- company-logo.ts
- drill-sheets/pdf-actions.ts
- auth/constants.ts
- product-form.tsx
- product-kinds.ts
- compilerOptions
- .createDocumentHandler
- ._bindElement
- returnActionError
- OptionObject
- .getTextContent
- print-pdf-url.ts
- galley-service.ts
- delivery-ticket-pdf-line-items.ts
- drain-ring-matrix-utils.ts
- getStringOption
- drill-sheet-preview.tsx
- scripts
- .wrap
- build
- drill-sheet-detail.ts
- jobs/actions.ts
- FormTypeahead
- quote-form-utils.ts
- bulk-attach-board.tsx
- drill-sheet.ts
- .success
- SectionCard
- pipe-modal.tsx
- structure-import.ts
- quote-lines-table.tsx
- shipping/actions.ts
- SimpleDOMNode
- next
- dependencies
- customer-mapper.ts
- structures/actions.ts
- bulk-load-planner.tsx
- postcss.config.mjs
- customer-name-similarity.ts
- job-structure-documents-service.ts
- quote-mapper.ts
- Handy Commands — Precast App
- devDependencies
- delivery-tickets/actions.ts
- delivery-ticket-utils.ts
- PsWasmCompiler
- quote-pdf-line-items.ts
- job-detail-mapper.ts
- delivery-ticket-detail-content.tsx
- files/actions.ts
- delivery-ticket-pdf-fill.ts
- reconcile-day.tsx
- import-rect-sheet-pdfs.ts
- unreachable
- sheet-pdfs/actions.ts
- delivery-fulfillment.ts
- invoicing-service.ts
- date-only.ts
- calibrate-rect-templates.ts
- AGENTS.md
- product-submittals-service.ts
- rect-sheet-preview.tsx
- XhtmlObject
- template_Value
- purchase-order-path.ts
- warn
- withDatabaseRetry
- job-sheet-import.ts
- app-settings.ts
- plan-sheet-actions.ts
- quotes/actions.ts
- AnnotationBorderStyle
- input.tsx
- Precast Ops desktop updates
- .constructor
- XhtmlNamespace
- XmlObject
- quote-pdf-data.ts
- Builder
- structure-workbook.tsx
- product-taxonomy.server.ts
- generate-invoice-templates.ts
- send-actions.ts
- XMLParserBase
- TextMeasure
- react
- navigateAfterAction
- quote-form-data.ts
- windows-explorer.ts
- delivery-ticket-preview-content.tsx
- casting-utils.ts
- shipping-zones/actions.ts
- Office deployment — single Windows server + UNC job folders
- Office rollout checklist
- printPdfUrl
- ProductionBoard
- delivery-tickets/pdf-actions.ts
- job-structure-import-dialog.tsx
- .get
- .getUint16
- format.ts
- app_generated_prisma_client_prismaclient
- Deployment server info checklist
- rect-sheet-detail-view.tsx
- Troubleshooting
- invoice-pdf-fill.ts
- structure-workbook-plan-takeoff.tsx
- Precast Ops
- ring-builder-settings-form.tsx
- electron/package.json
- pdfjs-dist
- .find
- updater.mjs
- calculateSHA512
- MetadataParser
- XFAParser
- render-example-sheets.ts
- ring-builder-modal.tsx
- session-keep-alive.tsx
- delivery-ticket-submittal-preview-content.tsx
- FontSelector
- Job Structure Production Workflow
- casting-ticket-lines.ts
- signature_Signature
- main.mjs
- invoice-draft-editor.tsx
- invoice-mapper.ts
- submittal-package.ts
- PageArea
- copy-pdf-worker.mjs
- TextState
- .push
- ExclGroup
- ChunkedStream
- StringObject
- walk-ins-board.tsx
- outlook-draft.ts
- QuotePreviewContent
- CMap
- Br
- .makeHexColor
- ShippingZonesManager
- NullOptimizer
- Root
- .#Ne
- package.json
- DashboardShell
- .add
- product-export.ts
- test-db.ts
- Button
- [...file]/route.ts
- PageSet
- build-id/route.ts
- Traverse
- custom-structure-import.ts
- B
- Border
- Stylesheet
- reconcile/page.tsx
- Sup
- product-mapper.ts
- prisma.ts
- circular-structure-import.ts
- rect-sheet-form.tsx
- .checkAndRepair
- ConfigNamespace
- CalRGBCS
- xdp_Xdp
- inventory/page.tsx
- Annotation
- SingleIntersector
- process-app-icon.ps1
- Phase 6 — Electron client (staff PCs)
- util_shadow
- allowScripts
- Security posture: internal, trusted-network tool
- util_assert

## God Nodes (most connected - your core abstractions)
1. `withDatabaseRetry()` - 350 edges
2. `requirePermission()` - 337 edges
3. `XFAObject` - 208 edges
4. `SectionCard()` - 207 edges
5. `next` - 204 edges
6. `warn()` - 175 edges
7. `react` - 173 edges
8. `DashboardShell()` - 163 edges
9. `ConfigNamespace` - 141 edges
10. `reloadAfterAction()` - 137 edges

## Surprising Connections (you probably didn't know these)
- `Authentication today` --references--> `signInWithPassword()`  [INFERRED]
  AGENTS.md → app/login/actions.ts
- `Quote → JobStructure linking` --references--> `linkJobStructuresFromQuote()`  [INFERRED]
  docs/STRUCTURE_PRODUCTION_WORKFLOW.md → lib/job-structure-workflow.ts
- `AllDeliveryTicketsPage()` --indirect_call--> `mapDbDeliveryTicketToListRow()`  [INFERRED]
  app/delivery-tickets/all/page.tsx → lib/delivery-ticket-mapper.ts
- `handleGeneratePdf()` --calls--> `generateDeliveryTicketPdf()`  [EXTRACTED]
  components/delivery-tickets/delivery-ticket-preview-content.tsx → app/delivery-tickets/pdf-actions.ts
- `openDialog()` --calls--> `loadJobStructureImportOptions()`  [EXTRACTED]
  components/jobs/job-structure-import-dialog.tsx → app/jobs/structure-import-actions.ts

## Import Cycles
- None detected.

## Communities (222 total, 54 thin omitted)

### Community 0 - "app/products/actions.ts"
Cohesion: 0.08
Nodes (42): assertAllAssemblyComponentCodesExist(), BulkImportRow, bulkImportUpdateData(), collectAssemblyBomImportRows(), collectReferencedComponentCodes(), createFormProfileReader(), importProductsOrThrow(), ImportProductsResult (+34 more)

### Community 1 - "rect-structure.ts"
Cohesion: 0.09
Nodes (38): SumpMode, annotateRectOpeningSections(), ComputedRectSection, computeHorizontalGeometry(), computeRectDefaultSumpFeet(), computeRectPricing(), computeRectStructure(), computeRectWallHeightFeet() (+30 more)

### Community 2 - "pdf.worker.min.mjs"
Cohesion: 0.01
Nodes (237): 14(), 291(), 463(), 750(), 812(), 835(), 837(), 944() (+229 more)

### Community 3 - "LocaleSetNamespace"
Cohesion: 0.03
Nodes (24): CalendarSymbols, CurrencySymbol, CurrencySymbols, DatePattern, DatePatterns, Day, DayNames, Era (+16 more)

### Community 5 - "XFAObject"
Cohesion: 0.01
Nodes (70): Arc, Assist, Barcode, Bind, BindItems, Bookend, Break, BreakBefore (+62 more)

### Community 6 - ".getOperatorList"
Cohesion: 0.03
Nodes (32): addCachedImageOps(), argIsDict(), CheckedOperatorList, CMapFactory, EvalState, fetchBinaryData(), getEncoding(), getStandardFontName() (+24 more)

### Community 7 - "structure-workbook.ts"
Cohesion: 0.11
Nodes (36): lookupPipeOpeningSize(), createRectPenetration(), applyDefaultsToBlankRow(), buildDrillSheetOpeningsInput(), clearWorkbookApplyPayload(), computePenetrationsBootsPrice(), computeWorkbookRowPrice(), createDefaultPenetration() (+28 more)

### Community 9 - "rect-structure-workbook.ts"
Cohesion: 0.07
Nodes (58): completeRectDrillSheets(), CompleteDrillSheetEntry, CompleteDrillSheetsClient(), handleCreate(), CompleteDrillSheetsClientProps, groupToneClasses(), RectDefaultsPanel(), RectStructureWorkbook() (+50 more)

### Community 10 - "ContentObject"
Cohesion: 0.02
Nodes (24): AlwaysEmbed, BehaviorOverride, BooleanElement, ContentObject, DateElement, DateTime, DateTimeSymbols, Decimal (+16 more)

### Community 11 - "rect-template-pdf.ts"
Cohesion: 0.09
Nodes (39): sectionJointHeightsFeet(), baseOffsetText(), BLACK, buildFlaps(), buildRectSheetFieldMap(), CalloutLayout, calloutSlotTops(), consumeMarkerField() (+31 more)

### Community 12 - "delivery-ticket-editor.tsx"
Cohesion: 0.06
Nodes (70): DeliveryTicketLineInput, SaveDeliveryTicketInput, DeliveryTicketEditor(), addExtraCustomLine(), addExtraProduct(), addWalkInLine(), applyPickupListPrices(), buildPayload() (+62 more)

### Community 13 - ".parse"
Cohesion: 0.03
Nodes (23): AlternateCS, CFFCompiler, CFFDict, CFFEncoding, CFFFDSelect, CFFIndex, CFFOffsetTracker, CFFParser (+15 more)

### Community 14 - "drill-sheet-template-pdf.ts"
Cohesion: 0.05
Nodes (70): DrillSheetPreviewMeta, ComputedOpening, DrillSheetResult, appendDrillSheetFillablePage(), BORDER, drawField(), feet(), FieldContext (+62 more)

### Community 15 - "QuoteForm"
Cohesion: 0.08
Nodes (45): getCustomerForQuoteForm(), createBlankLine(), moveLineByStep(), moveLineToIndex(), stagedStockProductsToLineItems(), buildQuoteLineItemsInput(), buildWorkbookReturnPath(), productMeasureInputValue() (+37 more)

### Community 16 - "quote-form.tsx"
Cohesion: 0.04
Nodes (69): QuoteSaveDestination, AddConfigurableStructurePanel(), AddServicePanel(), AddStockProductPanel(), ContactOverride, QuoteJobContactFields(), QuoteMetaFields(), QuotePricingFields() (+61 more)

### Community 17 - "company-logo.ts"
Cohesion: 0.10
Nodes (35): GET(), geistMono, geistSans, generateMetadata(), CompanySettingsPage(), COMPANY_LOGO_FILENAME, companyLogoApiUrl(), DEFAULT_SEED_LOGO_PDF_PATH (+27 more)

### Community 18 - "drill-sheets/pdf-actions.ts"
Cohesion: 0.04
Nodes (95): GET(), parseCopyParam(), RouteContext, GET(), RouteContext, GET(), rectPreviewResponse(), RouteContext (+87 more)

### Community 19 - "auth/constants.ts"
Cohesion: 0.08
Nodes (41): NAV_ICON_PATHS, NavIconId, NavItem, navItems, NavSection, NavSectionId, navSections, PermissionRouteGuard() (+33 more)

### Community 20 - "product-form.tsx"
Cohesion: 0.08
Nodes (24): CastingComponentPickerOption, CastingSupplierOption, drainRingDiameterOptions, ProductFormProps, ProductFormValues, bulkPasteColumnHeaders, bulkPasteExample, BulkProductPasteRow (+16 more)

### Community 21 - "product-kinds.ts"
Cohesion: 0.07
Nodes (42): findExistingProductCodesAction(), BulkPasteForm(), handleParsePreview(), lookUpExistingCodes(), parseBulkPaste(), presetPreviewColumns(), handleRingDiameterChange(), assertSanitaryDrainRingAllowed() (+34 more)

### Community 22 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 23 - ".createDocumentHandler"
Cohesion: 0.03
Nodes (27): handleClear(), AbortException, AnnotationFactory, ARCFourCipher, BasePdfManager, BasePDFStream, calculateMD5(), CipherTransformFactory (+19 more)

### Community 24 - "._bindElement"
Cohesion: 0.04
Nodes (20): Binder, CCITTFaxStream, clearGlobalCaches(), createDataNode(), createText(), DataHandler, JBig2CCITTFaxImage, Jbig2Error (+12 more)

### Community 25 - "returnActionError"
Cohesion: 0.07
Nodes (66): createDrillSheet(), createRectSheet(), updateDrillSheet(), updateRectSheet(), upgradeRectSheetFromPlaceholder(), upgradeRectSheetFromPlaceholderOrThrow(), loadPlaceholder(), NewRectSheetPage() (+58 more)

### Community 26 - "OptionObject"
Cohesion: 0.02
Nodes (36): ADBE_JSConsole, ADBE_JSDebugger, AutoSave, config_Attributes, config_Type, config_Validate, Conformance, Destination (+28 more)

### Community 27 - ".getTextContent"
Cohesion: 0.07
Nodes (19): Intersector, isArrayEqual(), ObjectLoader, Page, addFakeSpaces(), appendEOL(), applyInverseRotation(), buildTextContentItem() (+11 more)

### Community 28 - "print-pdf-url.ts"
Cohesion: 0.22
Nodes (14): listPrintersForClient(), printServerPdfForClient(), ServerPrintResult, attachHiddenIframe(), cleanupAfterPrint(), pickPrinter(), printBlobAsPdfFrame(), printViaServerWithPicker() (+6 more)

### Community 29 - "galley-service.ts"
Cohesion: 0.15
Nodes (21): injectGalleyFamilyOptions(), applyGalleyBreakdown(), BreakdownDialog(), submit(), formatMixSummary(), GalleyBreakdownBanner(), DbClient, findGalleyFamilyMember() (+13 more)

### Community 30 - "delivery-ticket-pdf-line-items.ts"
Cohesion: 0.07
Nodes (51): COL_DESC_WIDTH, COL_DESC_X, COL_ITEM_NUM_WIDTH, COL_ITEM_NUM_X, COL_QTY_WIDTH, COL_QTY_X, DEFAULT_TABLE_LAYOUT, DeliveryTicketTableLayout (+43 more)

### Community 31 - "drain-ring-matrix-utils.ts"
Cohesion: 0.06
Nodes (57): mapFulfillmentToLine(), mergeFulfillmentIntoLine(), structurePieceLineKey(), QuoteLineEditingOptions, useQuoteLineEditing(), applyAutoRingAssignment(), castingPiecesAreEvenSets(), getAdsPipeCount() (+49 more)

### Community 32 - "getStringOption"
Cohesion: 0.07
Nodes (9): getFloat(), getInteger(), getKeyword(), getMeasurement(), getRatio(), getRelevant(), getStringOption(), LockDocument (+1 more)

### Community 33 - "drill-sheet-preview.tsx"
Cohesion: 0.10
Nodes (42): CalcRow(), DrillSheetPreview(), DrillSheetPreviewProps, feet(), HeaderRow(), PlanDiagram(), PreviewPanel(), getCompanyLogoDataUri() (+34 more)

### Community 34 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, build, db:seed, db:sync-files, deploy:build, deploy:check, deploy:start, deploy:update (+11 more)

### Community 35 - ".wrap"
Cohesion: 0.10
Nodes (10): CFF, CFFCharset, CFFHeader, decrypt(), findBlock(), isHexDigit(), isSpecial(), Type1CharString (+2 more)

### Community 36 - "build"
Cohesion: 0.11
Nodes (18): build, appId, directories, extraResources, icon, nsis, productName, publish (+10 more)

### Community 37 - "drill-sheet-detail.ts"
Cohesion: 0.10
Nodes (28): BulkSheetRowInput, BulkSheetRowResult, RectSheetFormValues, circularPayloadFromValues(), rectPayloadFromValues(), CircularGridOptions, JobStructuresBulkEditClient(), JobStructuresBulkEditClientProps (+20 more)

### Community 38 - "jobs/actions.ts"
Cohesion: 0.05
Nodes (52): BulkImportRow, createCustomer(), CUSTOMER_STATUSES, CustomerRecordInput, findSimilarCustomers(), importCustomers(), importCustomersOrThrow(), ImportCustomersResult (+44 more)

### Community 39 - "FormTypeahead"
Cohesion: 0.80
Nodes (5): FormTypeahead(), closeDropdown(), handleContainerBlur(), handleKeyDown(), handleSelect()

### Community 40 - "quote-form-utils.ts"
Cohesion: 0.07
Nodes (63): JobCustomStructureImportCandidate, loadJobCustomStructureImportCandidates(), toPlainNumberString(), CustomStructureCostBreakdown(), addItem(), CustomStructureCostBreakdownProps, CustomStructureDetailBreakdown(), CustomStructurePricingFooter() (+55 more)

### Community 41 - "bulk-attach-board.tsx"
Cohesion: 0.21
Nodes (15): BulkAttachPage(), BulkAttachBoard(), getTile(), handleFiles(), renderTile(), selectMode(), setTile(), tileKey() (+7 more)

### Community 42 - "drill-sheet.ts"
Cohesion: 0.08
Nodes (37): annotateOpeningSections(), buildSolverHoles(), compareCost(), computeBaseTopToOpeningBottomInches(), computeDefaultSumpFeet(), computeDrillSheet(), ComputedSection, ComputedWeights (+29 more)

### Community 43 - ".success"
Cohesion: 0.05
Nodes (42): applyAssist(), ariaLabel(), BreakAfter, Caption, CheckButton, checkDimensions(), ChoiceList, computeBbox() (+34 more)

### Community 44 - "SectionCard"
Cohesion: 0.04
Nodes (125): where, ProductInventoryPage(), ProductInventoryPageProps, CompactTable(), Home(), CastingSuppliersPage(), CastingSuppliersPageProps, PriceListDetailPage() (+117 more)

### Community 45 - "pipe-modal.tsx"
Cohesion: 0.11
Nodes (33): createDefaultQuoteRow(), createRowId(), PipeModal(), handleAddQuoteLines(), handleAddUnitPricesToDescription(), handleClose(), resetModal(), PipeModalMode (+25 more)

### Community 46 - "structure-import.ts"
Cohesion: 0.20
Nodes (20): CONNECTION_ALIASES, isBlank(), numberIssue(), parseBooleanCell(), parseConnectionCell(), parseDiametersCell(), parseSizesCell(), parseStatusCell() (+12 more)

### Community 47 - "quote-lines-table.tsx"
Cohesion: 0.10
Nodes (36): splitStructureForShipping(), unsplitStructure(), DASHBOARD_HEADER_HEIGHT, inlineTableInputClass, loadQuantityInputClass, quoteLineTableCellClassName, quoteTableHeaderCellClassName, buildSplitDraft() (+28 more)

### Community 48 - "shipping/actions.ts"
Cohesion: 0.08
Nodes (41): lookupShippingRate(), lookupShippingRateAtPoint(), resolveShippingRateForPoint(), ShippingLookupResult, ShippingLookupSuccess, suggestShippingAddresses(), ShippingStatus, AddressAutocomplete() (+33 more)

### Community 50 - "SimpleDOMNode"
Cohesion: 0.15
Nodes (3): DatasetXMLParser, SimpleDOMNode, SimpleXMLParser

### Community 51 - "next"
Cohesion: 0.04
Nodes (97): GET(), GET(), RouteContext, DeliveryTicketDetailPage(), DeliveryTicketDetailPageProps, DeliveryTicketPreviewPage(), DeliveryTicketPreviewPageProps, PREVIEW_ORIGINS (+89 more)

### Community 52 - "dependencies"
Cohesion: 0.11
Nodes (19): dependencies, leaflet, next, nodemailer, pdf-lib, @pdf-lib/fontkit, pdf-to-printer, pdfjs-dist (+11 more)

### Community 53 - "customer-mapper.ts"
Cohesion: 0.04
Nodes (66): importContacts(), BulkContactPasteForm(), handleImport(), handleParsePreview(), parseBulkContactPaste(), parseBulkPaste(), ContactFormState, CustomerContactsPanel() (+58 more)

### Community 54 - "structures/actions.ts"
Cohesion: 0.08
Nodes (43): assertDiametersHaveMolds(), createStructureTemplate(), createStructureTemplateOrThrow(), duplicateStructureTemplate(), handlePrismaError(), parseTemplatePayload(), resolvePriceListIdForTemplateSave(), saveRectPriceEntry() (+35 more)

### Community 55 - "bulk-load-planner.tsx"
Cohesion: 0.07
Nodes (51): discardSavedLoadPlan(), PlannedLoadInput, saveLoadPlanForLater(), SavePlannedLoadsInput, buildRows(), BulkLoadPlanner(), addLoad(), autoRingCount() (+43 more)

### Community 57 - "customer-name-similarity.ts"
Cohesion: 0.33
Nodes (12): compactCustomerName(), compactSimilarity(), CustomerNameCandidate, findSimilarCustomers(), getCustomerNameSimilarity(), jaccardSimilarity(), levenshteinDistance(), levenshteinRatio() (+4 more)

### Community 64 - "job-structure-documents-service.ts"
Cohesion: 0.15
Nodes (20): openJobStructureSubmittalsFolderOrThrow(), pathExists(), resolveUniqueFilePath(), assertPathUnderJobFolder(), assertPathUnderRoot(), normalizePath(), pathsEqual(), pathStartsWith() (+12 more)

### Community 65 - "quote-mapper.ts"
Cohesion: 0.11
Nodes (22): formatDrainRingStyleLabel(), deriveOriginalQuoteNumber(), deriveSupersededBy(), formatLineNotes(), formatQuoteDate(), formatQuoteDateLong(), formatQuoteLineTypeLabel(), mapLineTypeLabel() (+14 more)

### Community 66 - "Handy Commands — Precast App"
Cohesion: 0.15
Nodes (13): App (Next.js), Browse data, Daily workflow, Database backups, Electron desktop client, Git / GitHub (optional), Handy Commands — Precast App, Office deployment (Windows server) (+5 more)

### Community 67 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, electron, electron-builder, eslint, eslint-config-next, tailwindcss, @tailwindcss/postcss, tsx (+8 more)

### Community 68 - "delivery-tickets/actions.ts"
Cohesion: 0.08
Nodes (29): assertQuoteLinkable(), buildLineCreates(), buildLinesPayload(), createDeliveryTicket(), DeliveryTicketActionResult, DeliveryTicketJobSearchOption, GenerateTicketSubmittalResult, resolveTicketCustomerId() (+21 more)

### Community 69 - "delivery-ticket-utils.ts"
Cohesion: 0.05
Nodes (63): DeliveryTicketsPage(), deliveryDateFilterOptions, DeliveryFilterOptions, deliveryTicketCustomerOptions, DeliveryTicketDetailLineItem, DeliveryTicketDetailView, deliveryTicketDriverOptions, DeliveryTicketFormLineItem (+55 more)

### Community 70 - "PsWasmCompiler"
Cohesion: 0.05
Nodes (25): ast_Parser, buildPostScriptWasmFunction(), encodeASCIIString(), lexer_Lexer, _nodesEqual(), parsePostScriptFunction(), PsArgNode, PsBinaryNode (+17 more)

### Community 71 - "quote-pdf-line-items.ts"
Cohesion: 0.08
Nodes (45): COL_DESC_WIDTH, COL_DESC_X, COL_ITEM_NUM_WIDTH, COL_ITEM_NUM_X, COL_QTY_WIDTH, COL_QTY_X, COL_TOTAL_WIDTH, COL_TOTAL_X (+37 more)

### Community 72 - "job-detail-mapper.ts"
Cohesion: 0.03
Nodes (140): JobTabContent(), JobTabContentProps, JobDetailPage(), JobDetailPageProps, resolveTab(), VALID_TABS, convertTicketToInvoice(), mapStructure() (+132 more)

### Community 73 - "delivery-ticket-detail-content.tsx"
Cohesion: 0.14
Nodes (20): generateDeliveryTicketSubmittalPackage(), DeliveryTicketDetailContent(), DeliveryTicketDetailContentProps, formatLineType(), isBlank(), OptionalField(), paymentMethodLabel(), PickupInfo (+12 more)

### Community 74 - "files/actions.ts"
Cohesion: 0.16
Nodes (28): ExplorerOpenResult, listJobsMissingFolders(), listRecentFiles(), openJobFolderCategory(), revalidateFilesPaths(), syncAllFiles(), SyncAllFilesResult, syncJobFilesAction() (+20 more)

### Community 75 - "delivery-ticket-pdf-fill.ts"
Cohesion: 0.09
Nodes (48): blankOr(), buildDeliveryTicketFormData(), computeTotalPieces(), DbCustomer, DbDeliveryTicketForPdf, DbJob, DeliveryTicketContentPage, DeliveryTicketCopySettings (+40 more)

### Community 76 - "reconcile-day.tsx"
Cohesion: 0.05
Nodes (49): GlobalError(), isStaleDeploymentError(), RootLayout(), NotFound(), FormTypeaheadProps, DeleteCustomerButtonProps, BULK_DELIVERABLE_STATUSES, formatDateOnly() (+41 more)

### Community 77 - "import-rect-sheet-pdfs.ts"
Cohesion: 0.14
Nodes (23): assertPathUnderRoot(), deleteTemplatePdf(), getStructureTemplatePdfsRoot(), readTemplatePdfBytes(), rectTemplateVariantKey(), StructureTemplatePdfRecord, TemplatePdfVariant, main() (+15 more)

### Community 78 - "unreachable"
Cohesion: 0.04
Nodes (13): addHex(), BasePDFStreamRangeReader, BasePDFStreamReader, BaseStream, BinaryCMapReader, BinaryCMapStream, createBuiltInCMap(), hexToInt() (+5 more)

### Community 79 - "sheet-pdfs/actions.ts"
Cohesion: 0.08
Nodes (39): GET(), RouteContext, saveUploadedPlanPdf(), createSheetPdfSetAction(), deleteSheetPdfSetAction(), deleteSheetPdfSetFileAction(), deleteSheetPdfSetOrThrow(), parseBooleanField() (+31 more)

### Community 80 - "delivery-fulfillment.ts"
Cohesion: 0.09
Nodes (43): getQuoteFulfillmentWithOpenLoads(), refreshFulfillment(), AdsPipeJointType, adsPipeJointTypeFormOptions, adsPipeJointTypeLabels, normalizeAdsPipeJointType(), AdsPipeOption, allLineageIds() (+35 more)

### Community 81 - "invoicing-service.ts"
Cohesion: 0.14
Nodes (17): removeTrailingRingHeightSuffix(), batchConvertDeliveredTicketsToInvoices(), BatchInvoiceConversionResult, CastingSetCharge, castingSetsStarted(), convertDeliveryTicketToInvoice(), InvoiceAlreadyExistsError, invoiceDueDateFromDelivery() (+9 more)

### Community 82 - "date-only.ts"
Cohesion: 0.04
Nodes (103): InventoryProductSearchOption, resolveReceivingCategory(), saveInventoryAdjustment(), savePurchaseReceipt(), searchInventoryProducts(), InventoryReceiptsPage(), InventoryReceiptsPageProps, saveDailyProductionDay() (+95 more)

### Community 83 - "calibrate-rect-templates.ts"
Cohesion: 0.07
Nodes (34): BASE_SLAB_ONLY_FIELDS, RECT_ELEVATION_WALL_MARKER_FIELD, RECT_EXPLODED_CENTER_MARKER_FIELD, RECT_EXPLODED_MARKER_FIELD, RECT_OPENING_ROWS, RECT_SHEET_TEMPLATE_FIELD_NAMES, RECT_TOP_SLAB_MARKER_FIELD, RECT_WEIGHT_PIECE_LINES (+26 more)

### Community 84 - "AGENTS.md"
Cohesion: 0.38
Nodes (4): Codebase exploration: use graphify first, Prisma / Database Rules, Project context, This is NOT the Next.js you know

### Community 85 - "product-submittals-service.ts"
Cohesion: 0.22
Nodes (21): openProductDocumentOrThrow(), getStockSubmittalsRoot(), assertPathUnderStockSubmittalsRoot(), assertProductExists(), collectSubmittalFilesForCode(), deleteProductDocument(), getProductDocumentForOpen(), getProductSubmittalDir() (+13 more)

### Community 86 - "rect-sheet-preview.tsx"
Cohesion: 0.17
Nodes (18): ElevationView(), fmtElevation(), PlanView(), RectSheetPreview(), RectSheetPreviewProps, SummaryPanel(), TopSlabView(), formatFeetInchesShort() (+10 more)

### Community 87 - "XhtmlObject"
Cohesion: 0.12
Nodes (6): Html, $i, li, ol, ul, XhtmlObject

### Community 88 - "template_Value"
Cohesion: 0.11
Nodes (5): Draw, Field, Image, _setValue(), template_Value

### Community 89 - "purchase-order-path.ts"
Cohesion: 0.67
Nodes (3): PURCHASE_ORDER_ROOT_DIR, resolvePurchaseOrderDirectory(), resolveVendorQuotePath()

### Community 90 - "warn"
Cohesion: 0.02
Nodes (54): Ascii85Stream, AsciiHexStream, BrotliStream, bytesToString(), addPageError(), parseOperand(), CipherTransform, Cmd (+46 more)

### Community 91 - "withDatabaseRetry"
Cohesion: 0.03
Nodes (163): deleteCustomer(), updateCustomer(), addCustomerContact(), BulkContactDbState, BulkContactImportRow, checkBulkContactDbState(), CONTACT_ROLES, CustomerContactInput (+155 more)

### Community 92 - "job-sheet-import.ts"
Cohesion: 0.24
Nodes (10): loadJobSheetImportCandidates(), DecimalLike, decimalToInput(), lowestInvertText(), mapCircularSheetToWorkbookRow(), mapRectSheetToWorkbookRow(), StoredSheetForImport, RectWorkbookOpeningRow (+2 more)

### Community 93 - "app-settings.ts"
Cohesion: 0.04
Nodes (107): checkJobsRootReadAccess(), clearAllCustomersFormAction(), clearAllCustomersOrThrow(), clearAllDeliveryTicketsFormAction(), clearAllDeliveryTicketsOrThrow(), clearAllJobsFormAction(), clearAllJobsOrThrow(), clearAllProductsFormAction() (+99 more)

### Community 94 - "plan-sheet-actions.ts"
Cohesion: 0.19
Nodes (16): getPlanSheetForQuote(), listJobConstructionPlanPdfs(), mapPlanSheetRow(), pathExists(), PlanSheetRecord, savePlanSheetMarkup(), selectJobPlanSheet(), selectJobPlanSheetOrThrow() (+8 more)

### Community 95 - "quotes/actions.ts"
Cohesion: 0.05
Nodes (66): assertGalleyFamiliesExist(), computeQuoteFinancials(), createQuote(), CreateQuoteInput, CreateQuoteLineItemInput, DeleteQuoteResult, isQuoteNumberConflict(), parseOptionalDate() (+58 more)

### Community 97 - "input.tsx"
Cohesion: 0.40
Nodes (3): inputClassName, InputProps, textareaClassName

### Community 98 - "Precast Ops desktop updates"
Cohesion: 0.40
Nodes (4): Precast Ops desktop updates, Publish a desktop update (from the dev PC), Verify (from any office PC), Which machine does what

### Community 99 - ".constructor"
Cohesion: 0.19
Nodes (4): getB(), LZWStream, MeshShading, MeshStreamReader

### Community 100 - "XhtmlNamespace"
Cohesion: 0.13
Nodes (5): Body, hl, Span, Sub, XhtmlNamespace

### Community 101 - "XmlObject"
Cohesion: 0.06
Nodes (5): Datasets, datasets_Data, DatasetsNamespace, XFAAttribute, XmlObject

### Community 102 - "quote-pdf-data.ts"
Cohesion: 0.09
Nodes (37): DELIVERY_TICKET_PDF_INCLUDE, CP1252_HIGH, fitPdfFieldFontSize(), isWinAnsi(), lastFontSize(), replaceLastFontSize(), setPdfFieldText(), WINANSI_REPLACEMENTS (+29 more)

### Community 104 - "Builder"
Cohesion: 0.17
Nodes (3): Builder, Empty, UnknownNamespace

### Community 105 - "structure-workbook.tsx"
Cohesion: 0.09
Nodes (42): JobSheetImportCandidate, DrillSheetTemplateOption, JobSheetImportDialog(), JobSheetImportDialogProps, pipeSizesForMaterial(), StructureWorkbookDefaultsPanel(), StructureWorkbookDefaultsPanelProps, uniquePipeMaterials() (+34 more)

### Community 106 - "product-taxonomy.server.ts"
Cohesion: 0.13
Nodes (27): ProductForm(), handleCategoryChange(), handleProductKindChange(), handleProductTypeChange(), ensureTaxonomyForBulkImport(), fetchActiveProductTaxonomy(), resolveTaxonomiesByNamesForImport(), resolveTaxonomyByNamesForImport() (+19 more)

### Community 108 - "generate-invoice-templates.ts"
Cohesion: 0.12
Nodes (25): CONT_TABLE_BOTTOM_Y, MAIN_TABLE_BOTTOM_Y, addTextField(), BLACK, BOTTOM_BOX, buildTemplate(), Ctx, drawBox() (+17 more)

### Community 110 - "send-actions.ts"
Cohesion: 0.06
Nodes (56): findSupersededBy(), getSendQuoteDefaults(), getSendQuoteEmailConfigured(), OpenOutlookDraftResult, openQuoteInOutlook(), sendQuote(), SendQuoteDefaults, SendQuoteInput (+48 more)

### Community 112 - "TextMeasure"
Cohesion: 0.23
Nodes (3): layoutText(), TextMeasure, xhtml_P

### Community 114 - "react"
Cohesion: 0.03
Nodes (150): listJobFilesAction(), uploadJobFileAction(), createJobFolder(), deleteJobStructureDocumentAction(), openJobFolder(), openJobStructureDocument(), openJobStructureSubmittalsFolder(), updateJobStatusAction() (+142 more)

### Community 115 - "navigateAfterAction"
Cohesion: 0.04
Nodes (79): checkBulkCustomerDbDuplicates(), BulkPasteForm(), handleImport(), handleParsePreview(), createRow(), ProductionEntryForm(), addLine(), handleSubmit() (+71 more)

### Community 117 - "quote-form-data.ts"
Cohesion: 0.12
Nodes (24): reloadQuoteFormPriceOptions(), searchProductsForQuoteForm(), collectRingOtherSubcategories(), formatJobAddress(), loadPipeProductsForQuoteForm(), loadQuoteFormPriceOptions(), mapPipeProductToQuoteOption(), mapServiceProductsToOptions() (+16 more)

### Community 118 - "windows-explorer.ts"
Cohesion: 0.07
Nodes (37): openJobFolderOrThrow(), openProductSubmittalsFolderOrThrow(), ClientPathMapping, getClientPathMappings(), stripTrailingSeparators(), toClientOpenPath(), translateToClientPath(), assertDirectoryExists() (+29 more)

### Community 119 - "delivery-ticket-preview-content.tsx"
Cohesion: 0.25
Nodes (11): printInvoiceDirect(), DeliveryTicketPdfCanvasPreview(), DeliveryTicketPdfCanvasPreviewProps, getDeliveryTicketPreviewPrintUrl(), DeliveryTicketPreviewContent(), handleGeneratePdf(), handlePrint(), openPrintWindow() (+3 more)

### Community 120 - "casting-utils.ts"
Cohesion: 0.13
Nodes (12): CastingAssemblyBomImportRow, castingAssemblyBomRoleOrder, castingAssemblyOptionalBomRoles, castingAssemblyRequiredBomRoles, CastingBomRowInput, CastingComponentLookup, CastingComponentOption, castingPieceRoleFormOptions (+4 more)

### Community 121 - "shipping-zones/actions.ts"
Cohesion: 0.30
Nodes (11): createShippingZone(), deleteShippingZone(), revalidateShippingZonePaths(), setYardLocation(), ShippingZoneInput, updateShippingZone(), ValidatedZone, validateZoneInput() (+3 more)

### Community 122 - "Office deployment — single Windows server + UNC job folders"
Cohesion: 0.11
Nodes (18): Architecture, End-to-end smoke test, Firewall, Important behavior, Install prerequisites, Office deployment — single Windows server + UNC job folders, Ongoing maintenance, Phase 1 — Prepare the Windows server (+10 more)

### Community 123 - "Office rollout checklist"
Cohesion: 0.12
Nodes (17): 1. Server URL for the desktop app, 2. First install on each staff PC, 3. Staff expectations, 4. Role walkthrough (recommended), 5. Backups, 6. Support contacts, 7. Post-rollout verification (first week), Database (nightly recommended) (+9 more)

### Community 124 - "printPdfUrl"
Cohesion: 0.31
Nodes (7): DraftBatchPreviewPage(), DraftBatchPreviewContent(), renderPage(), printAllForDay(), handlePrint(), printPdfUrl(), pageCount()

### Community 125 - "ProductionBoard"
Cohesion: 0.25
Nodes (6): groupByJob(), isProductionTabId(), ProductionBoard(), renderActions(), renderDetail(), runAction()

### Community 126 - "delivery-tickets/pdf-actions.ts"
Cohesion: 0.09
Nodes (37): DeliveryTicketPdfPreviewResult, generateDeliveryTicketPdf(), GenerateDeliveryTicketPdfResult, PrintDeliveryTicketDirectResult, saveDeliverySchedulePdf(), SaveDeliverySchedulePdfResult, createJobFolderOrThrow(), SchedulePrintActions() (+29 more)

### Community 127 - "job-structure-import-dialog.tsx"
Cohesion: 0.09
Nodes (31): JobStructureImportEntry, JobStructureImportResult, buildPreview(), Cell, detectShape(), ImportOptions, JobStructureImportButton(), handleFile() (+23 more)

### Community 128 - ".get"
Cohesion: 0.03
Nodes (44): ButtonWidgetAnnotation, addPageDict(), appendIfJavaScriptDict(), parseNestedOrder(), parseOnOff(), parseOrder(), _collectAction(), collectActions() (+36 more)

### Community 129 - ".getUint16"
Cohesion: 0.09
Nodes (23): buildComponentData(), decodeScan(), decodeBlock(), decodeHuffman(), decodeMcu(), readBit(), receive(), receiveAndExtend() (+15 more)

### Community 130 - "format.ts"
Cohesion: 0.14
Nodes (23): DeliveryScheduleTicket, JobDeliverySchedule, buildDeliverySchedulePdfHtml(), DeliveryScheduleVariant, escapeHtml(), formatDeliveryAddress(), formatFriendlyDate(), formatTime12() (+15 more)

### Community 131 - "app_generated_prisma_client_prismaclient"
Cohesion: 0.19
Nodes (15): DEFAULT_APP_SETTINGS_DATA, decodeApiKey(), PrismaDevPayload, resolveDatabaseUrl(), resolvePrismaDevPayload(), resolveShadowDatabaseUrl(), databaseUrl, shadowDatabaseUrl (+7 more)

### Community 134 - "Deployment server info checklist"
Cohesion: 0.22
Nodes (9): Database, Deployment server info checklist, Electron client, File shares (UNC), Network, PDF generation, Post-deploy verification, Server (+1 more)

### Community 136 - "rect-sheet-detail-view.tsx"
Cohesion: 0.29
Nodes (11): aboveFloorText(), fmtElevation(), InfoRow(), placementText(), RectSheetDetailView(), RectSheetDetailViewProps, Stat(), wholeInches() (+3 more)

### Community 137 - "Troubleshooting"
Cohesion: 0.33
Nodes (6): `P1001` — Can't reach database server, Password authentication failed, Port 3000 already in use, Prisma Studio — "Could not load schema metadata", Quote PDF — "Could not find Chrome" / browser not found, Troubleshooting

### Community 138 - "invoice-pdf-fill.ts"
Cohesion: 0.11
Nodes (27): PrintInvoiceDirectResult, removeAdsJointTypeSuffix(), splitMultilineAddress(), blankOr(), buildInvoiceFormData(), DbInvoiceForPdf, formatCustomerAddress(), formatDateForPdf() (+19 more)

### Community 139 - "structure-workbook-plan-takeoff.tsx"
Cohesion: 0.11
Nodes (27): pipeSizesForMaterial(), uniquePipeMaterials(), bearingFromDelta(), commitRow(), DragState, pdfToScreen(), PipePopup(), polarToScreenPoint() (+19 more)

### Community 141 - "Precast Ops"
Cohesion: 0.40
Nodes (5): Desktop shell (optional), Local development, Office deployment, Precast Ops, Project docs

### Community 142 - "ring-builder-settings-form.tsx"
Cohesion: 0.24
Nodes (8): buildEditableFromConfig(), createMappingId(), EditableMapping, parseExtraSubcategoriesText(), RingBuilderSettingsForm(), RingBuilderSettingsFormProps, SubcategoryPicker(), isTopLevelRingStyle()

### Community 150 - "electron/package.json"
Cohesion: 0.20
Nodes (9): author, dependencies, electron-updater, description, main, name, private, productName (+1 more)

### Community 151 - "pdfjs-dist"
Cohesion: 0.15
Nodes (12): renderPage(), renderPage(), DrillSheetPdfCanvasPreview(), loadPdf(), DrillSheetPdfCanvasPreviewProps, DrillSheetPdfPreviewInfo, LoadedPdf, loadDocument() (+4 more)

### Community 152 - ".find"
Cohesion: 0.25
Nodes (3): FontFinder, makeObj(), stripQuotes()

### Community 153 - "updater.mjs"
Cohesion: 0.29
Nodes (5): { contextBridge, ipcRenderer }, getWindow(), initAutoUpdater(), electron, electron-updater

### Community 154 - "calculateSHA512"
Cohesion: 0.07
Nodes (24): AES128Cipher, AES256Cipher, AESBaseCipher, calculate_sha256_ch(), calculate_sha256_littleSigma(), calculate_sha256_littleSigmaPrime(), calculate_sha256_maj(), calculate_sha256_sigma() (+16 more)

### Community 157 - "render-example-sheets.ts"
Cohesion: 0.18
Nodes (12): puppeteer, findBrowser(), HTML_PATH, main(), EXAMPLES, findBrowser(), HTML(), main() (+4 more)

### Community 158 - "ring-builder-modal.tsx"
Cohesion: 0.10
Nodes (44): createDefaultHeightPoolRow(), createRowId(), formatRingBuilderUnitPrice(), HeightPoolRow, initOtherInputs(), OtherProductInput, OtherSection(), RingBuilderModal() (+36 more)

### Community 159 - "session-keep-alive.tsx"
Cohesion: 0.52
Nodes (5): keepSessionAlive(), recordPing(), SessionKeepAlive(), ping(), shouldPing()

### Community 160 - "delivery-ticket-submittal-preview-content.tsx"
Cohesion: 0.38
Nodes (8): printDeliveryTicketSubmittalsDirect(), DeliveryTicketSubmittalPdfCanvasPreview(), DeliveryTicketSubmittalPdfCanvasPreviewProps, getDeliveryTicketSubmittalPreviewPrintUrl(), DeliveryTicketSubmittalPreviewContent(), handlePrint(), openPrintWindow(), DeliveryTicketSubmittalPreviewContentProps

### Community 162 - "Job Structure Production Workflow"
Cohesion: 0.33
Nodes (5): Dates, Delivery eligibility, Job Structure Production Workflow, Quote → JobStructure linking, Server actions

### Community 163 - "casting-ticket-lines.ts"
Cohesion: 0.23
Nodes (8): CastingCollapseMeta, CastingCollapsibleLine, CastingExplodeComponent, CastingExplodedPiece, collapseCastingTicketLines(), perSetByProduct(), setWeightFor(), META

### Community 165 - "main.mjs"
Cohesion: 0.14
Nodes (25): __dirname, getUserConfigPath(), loadConfig(), readJsonFile(), validateServerUrl(), buildApplicationMenu(), checkForNewServerBuild(), clearWebCache() (+17 more)

### Community 166 - "invoice-draft-editor.tsx"
Cohesion: 0.12
Nodes (23): DraftInvoiceLineInput, saveDraftInvoiceAndRedirect(), computePreviewTotals(), EditorLine, formatMoney(), InvoiceDraftEditor(), InvoiceDraftEditorProps, newClientKey() (+15 more)

### Community 167 - "invoice-mapper.ts"
Cohesion: 0.53
Nodes (5): formatDate(), formatMoney(), InvoiceDetailView, mapDbInvoiceToDetailView(), statusVariant()

### Community 168 - "submittal-package.ts"
Cohesion: 0.09
Nodes (33): GenerateQuotePdfResult, generateSubmittalPackage(), GenerateSubmittalPackageResult, getCompanyProfile(), getSubmittalsJobSubfolder(), dedupeSharedPdfObjects(), isSkipped(), rewriteRefs() (+25 more)

### Community 170 - "copy-pdf-worker.mjs"
Cohesion: 0.33
Nodes (4): projectRoot, scriptDir, workerSource, workerTarget

### Community 172 - ".push"
Cohesion: 0.03
Nodes (48): CaretAnnotation, ChoiceWidgetAnnotation, CircleAnnotation, core_utils_numberToString(), createImageDict(), Dict, encodeToXmlString(), ErrorFont (+40 more)

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
Cohesion: 0.24
Nodes (14): MarkPickedUpControl(), handleConfirm(), BadgeVariant, CalledInPickupCard(), CompletedPickupCard(), dateLine(), itemsPaymentLine(), jobNameLine() (+6 more)

### Community 177 - "outlook-draft.ts"
Cohesion: 0.31
Nodes (8): RFC-2047, base64Lines(), buildQuoteDraftEml(), encodeHeaderText(), QuoteDraftEmlInput, sanitizeFilename(), buildSample(), fakePdf

### Community 178 - "QuotePreviewContent"
Cohesion: 0.27
Nodes (8): generateQuotePdf(), getQuotePreviewPrintUrl(), QuotePdfCanvasPreview(), renderPage(), QuotePdfCanvasPreviewProps, QuotePreviewContent(), handleGeneratePdf(), handlePrint()

### Community 182 - "ShippingZonesManager"
Cohesion: 0.29
Nodes (7): emptyForm(), ShippingZonesManager(), handleMapClick(), removeZone(), saveYard(), update(), ZoneMap

### Community 186 - "package.json"
Cohesion: 0.08
Nodes (25): eslintConfig, main, name, postcss, overrides, @hono/node-server, next, private (+17 more)

### Community 187 - "DashboardShell"
Cohesion: 0.03
Nodes (116): BulkCustomersPage(), BulkContactsPage(), EditCustomerPage(), EditCustomerPageProps, CustomerNotFound(), NewCustomerPage(), listStockProductsForTicket(), EDIT_ORIGINS (+108 more)

### Community 188 - ".add"
Cohesion: 0.04
Nodes (21): Commands, compileCharString(), bezierCurveTo(), lineTo(), moveTo(), CompiledFont, compileGlyf(), lineTo() (+13 more)

### Community 189 - "product-export.ts"
Cohesion: 0.11
Nodes (23): GET(), customerStatusFormOptions, buildCustomersExportBuffer(), customerExportHeaders, customerStatusLabels, CustomerWithContacts, mapCustomerToExportRow(), roleContactName() (+15 more)

### Community 190 - "test-db.ts"
Cohesion: 0.46
Nodes (4): globalSetup(), url, assertIsTestDatabaseUrl(), getTestDatabaseUrl()

### Community 192 - "[...file]/route.ts"
Cohesion: 0.33
Nodes (3): CONTENT_TYPES, RouteContext, UPDATES_DIR

### Community 194 - "build-id/route.ts"
Cohesion: 0.67
Nodes (3): dynamic, GET(), readBuildId()

### Community 196 - "custom-structure-import.ts"
Cohesion: 0.17
Nodes (17): JobCustomStructureImportButton(), handleFile(), parseGrid(), Cell, cellText(), ColumnMap, customGridFromTsv(), CustomImportEntry (+9 more)

### Community 204 - "product-mapper.ts"
Cohesion: 0.15
Nodes (18): ProductRow, formatProductKindBadgeLabel(), categoryVariant(), documentTypeLabel(), formatDecimal(), formatDocumentDate(), formatFileSize(), formatYesNo() (+10 more)

### Community 208 - "prisma.ts"
Cohesion: 0.04
Nodes (74): importProducts(), BulkProductsPage(), EditProductPage(), EditProductPageProps, DetailField(), ProductDetailPage(), ProductDetailPageProps, NewProductPage() (+66 more)

### Community 209 - "circular-structure-import.ts"
Cohesion: 0.05
Nodes (48): handleFile(), CircularImportDialog(), handleFile(), handlePasteParse(), CircularImportDialogProps, Cell, cellText(), circularGridFromTsv() (+40 more)

### Community 227 - "rect-sheet-form.tsx"
Cohesion: 0.05
Nodes (61): buildCommittedPreview(), CommittedOpeningNumbers, CommittedPreviewNumbers, connectionOptions, createOpening(), DiameterConfigOption, DrillSheetCastingOption, DrillSheetForm() (+53 more)

### Community 242 - ".checkAndRepair"
Cohesion: 0.04
Nodes (34): adjustWidths(), Ai, amendFallbackToUnicode(), CFFFont, CompositeGlyph, Contour, convertCidString(), createCmapTable() (+26 more)

### Community 243 - "ConfigNamespace"
Cohesion: 0.01
Nodes (74): Acrobat, Acrobat7, AddSilentPrint, AddViewerPreferences, AdjustData, AdobeExtensionLevel, Agent, BatchOutput (+66 more)

### Community 248 - "CalRGBCS"
Cohesion: 0.11
Nodes (4): CalGrayCS, CalRGBCS, DeviceCmykCS, LabCS

### Community 260 - "inventory/page.tsx"
Cohesion: 0.03
Nodes (133): CustomerDetailPage(), CustomerDetailPageProps, AGGREGATE_SORT_COLUMNS, CONTACT_SORT_COLUMNS, ContactSortColumn, CUSTOMER_SORT_FIELDS, CustomerSortColumn, CustomersPage() (+125 more)

### Community 261 - "Annotation"
Cohesion: 0.07
Nodes (3): Annotation, PopupAnnotation, XFAFactory

### Community 311 - "Phase 6 — Electron client (staff PCs)"
Cohesion: 0.25
Nodes (8): A. Server app updates (quotes, jobs, UI — most changes), B. Desktop shell updates (Electron auto-update), Build the installer, C. Server URL change only, Client updates (auto-update from server), Install on each desk PC, Local development with Electron, Phase 6 — Electron client (staff PCs)

### Community 315 - "util_shadow"
Cohesion: 0.04
Nodes (10): AppearanceStreamEvaluator, Catalog, CmykICCBasedCS, FeatureTest, InfoUtils, JpegStream, LocalColorSpaceCache, LocalFunctionCache (+2 more)

### Community 330 - "allowScripts"
Cohesion: 0.25
Nodes (8): allowScripts, electron@35.7.5, esbuild@0.28.1, prisma@7.8.0, @prisma/engines@7.8.0, puppeteer@25.1.0, sharp@0.34.5, unrs-resolver@1.12.2

### Community 333 - "Security posture: internal, trusted-network tool"
Cohesion: 0.67
Nodes (3): Authentication today, Authorization, Security posture: internal, trusted-network tool

### Community 336 - "util_assert"
Cohesion: 0.09
Nodes (10): compileFontInfo(), writeBuffer(), convertBlackAndWhiteToRGBA(), convertToRGBA(), encodeStrings(), ImageResizer, PDFImage, toRomanNumerals() (+2 more)

## Knowledge Gaps
- **1381 isolated node(s):** `dynamic`, `RouteContext`, `RouteContext`, `RouteContext`, `RouteContext` (+1376 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 2432 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **54 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `util_shadow()` connect `util_shadow` to `.get`, `CalRGBCS`, `pdf.worker.min.mjs`, `Annotation`, `.getOperatorList`, `.success`, `.push`, `.parse`, `unreachable`, `XMLParserBase`, `util_assert`, `.checkAndRepair`, `navigateAfterAction`, `.createDocumentHandler`, `._bindElement`, `warn`, `.getTextContent`, `.add`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Why does `vitest` connect `withDatabaseRetry` to `rect-structure.ts`, `format.ts`, `invoice-pdf-fill.ts`, `delivery-ticket-editor.tsx`, `quote-form.tsx`, `auth/constants.ts`, `returnActionError`, `galley-service.ts`, `ring-builder-modal.tsx`, `drain-ring-matrix-utils.ts`, `casting-ticket-lines.ts`, `drill-sheet-detail.ts`, `jobs/actions.ts`, `invoice-draft-editor.tsx`, `submittal-package.ts`, `quote-form-utils.ts`, `drill-sheet.ts`, `quote-lines-table.tsx`, `outlook-draft.ts`, `next`, `customer-mapper.ts`, `structures/actions.ts`, `package.json`, `delivery-tickets/actions.ts`, `custom-structure-import.ts`, `delivery-ticket-utils.ts`, `quote-pdf-line-items.ts`, `job-detail-mapper.ts`, `delivery-ticket-pdf-fill.ts`, `sheet-pdfs/actions.ts`, `prisma.ts`, `invoicing-service.ts`, `delivery-fulfillment.ts`, `date-only.ts`, `circular-structure-import.ts`, `job-sheet-import.ts`, `plan-sheet-actions.ts`, `quotes/actions.ts`, `quote-pdf-data.ts`, `send-actions.ts`, `react`, `windows-explorer.ts`, `delivery-tickets/pdf-actions.ts`, `job-structure-import-dialog.tsx`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `inventory/page.tsx`, `rect-structure-workbook.ts`, `structure-workbook-plan-takeoff.tsx`, `delivery-ticket-editor.tsx`, `ring-builder-settings-form.tsx`, `quote-form.tsx`, `drill-sheets/pdf-actions.ts`, `auth/constants.ts`, `product-form.tsx`, `pdfjs-dist`, `galley-service.ts`, `ring-builder-modal.tsx`, `drain-ring-matrix-utils.ts`, `delivery-ticket-submittal-preview-content.tsx`, `session-keep-alive.tsx`, `drill-sheet-preview.tsx`, `drill-sheet-detail.ts`, `jobs/actions.ts`, `invoice-draft-editor.tsx`, `quote-form-utils.ts`, `bulk-attach-board.tsx`, `SectionCard`, `pipe-modal.tsx`, `quote-lines-table.tsx`, `shipping/actions.ts`, `walk-ins-board.tsx`, `QuotePreviewContent`, `next`, `customer-mapper.ts`, `bulk-load-planner.tsx`, `package.json`, `DashboardShell`, `custom-structure-import.ts`, `delivery-ticket-utils.ts`, `job-detail-mapper.ts`, `delivery-ticket-detail-content.tsx`, `reconcile-day.tsx`, `sheet-pdfs/actions.ts`, `prisma.ts`, `circular-structure-import.ts`, `withDatabaseRetry`, `app-settings.ts`, `plan-sheet-actions.ts`, `rect-sheet-form.tsx`, `structure-workbook.tsx`, `product-taxonomy.server.ts`, `send-actions.ts`, `navigateAfterAction`, `delivery-ticket-preview-content.tsx`, `printPdfUrl`, `delivery-tickets/pdf-actions.ts`, `job-structure-import-dialog.tsx`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **What connects `dynamic`, `RouteContext`, `RouteContext` to the rest of the system?**
  _1381 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app/products/actions.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08181818181818182 - nodes in this community are weakly interconnected._
- **Should `rect-structure.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08686868686868687 - nodes in this community are weakly interconnected._
- **Should `pdf.worker.min.mjs` be split into smaller, more focused modules?**
  _Cohesion score 0.008393866020984665 - nodes in this community are weakly interconnected._