# Job Structure Production Workflow

Job-specific configurable and custom structures follow this lifecycle on `JobStructure.status`:

| Status | Meaning | User action |
|--------|---------|-------------|
| `NOT_SUBMITTED` | Structure defined but not sent for approval | Default when created from quote |
| `SUBMITTED` | Submittal sent to customer/engineer | Optional step before approval |
| `APPROVED` | Approved for production | **Approve for production** button |
| `IN_PRODUCTION` | On the production floor | Appears in **Production** queue; **Start production** |
| `MADE` | Casting complete, ready to ship | **Made** checkbox in production list |
| `SHIPPED` | Delivered on a ticket | Set automatically when delivery ticket → `DELIVERED` |

## Dates

- `approvedDate` — set when status → `APPROVED`
- `productionDate` — set when status → `IN_PRODUCTION`
- `madeDate` — set when status → `MADE`
- `shippedDate` — set when included on a delivered ticket

## Quote → JobStructure linking

When a quote is marked **WON** (`linkJobStructuresFromQuote`):

1. For each line with `lineType` of `CONFIGURABLE_STRUCTURE` or `CUSTOM_STRUCTURE`:
2. Create a `JobStructure` linked to the quote and job (if present).
3. Set `QuoteLineItem.jobStructureId` to the new structure.
4. Map `CONFIGURABLE_STRUCTURE` → `CONFIGURABLE_PRODUCT`, `CUSTOM_STRUCTURE` → `CUSTOM_STRUCTURE`.
5. Stock product lines do **not** create job structures.

## Delivery eligibility

Structure lines can be added to a delivery ticket only when:

- `JobStructure.status = MADE`
- Remaining quote line quantity > 0 (quoted − already delivered)

## Server actions

See `lib/job-structure-workflow.ts` and `app/operations/actions.ts`.
