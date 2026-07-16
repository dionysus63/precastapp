// Change to a UNC path such as "\\\\SERVER\\Jobs" when moving to network storage.
export const JOBS_ROOT = "C:\\PrecastJobs";
export const STOCK_SUBMITTALS_ROOT = "C:\\StockSubmittals";

export const JOB_SUBFOLDERS = [
  "01 Construction Plans",
  "02 Quotes",
  "03 Submittals",
  "04 Invoices",
  "05 Delivery Tickets",
  "06 Photos",
  "07 Purchase Orders",
  "08 Production",
  "09 Cut Sheets",
  "10 Tax Exempt Cert",
  "99 Misc",
] as const;

export const TAX_EXEMPT_CERT_CATEGORY = "10 Tax Exempt Cert";
