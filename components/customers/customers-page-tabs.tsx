"use client";

import { useListQuery } from "@/components/common/use-list-query";

export type CustomersPageTabCounts = {
  active: number;
  prospect: number;
  inactive: number;
  all: number;
  contacts: number;
};

type CustomersPageTabsProps = {
  view: "customers" | "contacts";
  /** Current status param — only meaningful on the customers view. */
  status: string;
  counts: CustomersPageTabCounts;
};

/**
 * Tab bar shared by the customer list and the contacts directory: the four
 * status tabs plus a Contacts tab (every person across every company).
 */
export function CustomersPageTabs({ view, status, counts }: CustomersPageTabsProps) {
  const { setParams } = useListQuery();

  const tabs = [
    {
      label: "Active",
      count: counts.active,
      isActive: view === "customers" && (status === "" || status === "ACTIVE"),
      select: () =>
        setParams({ view: null, status: "", page: null, sort: null, dir: null, company: null }),
    },
    {
      label: "Prospects",
      count: counts.prospect,
      isActive: view === "customers" && status === "PROSPECT",
      select: () =>
        setParams({ view: null, status: "PROSPECT", page: null, sort: null, dir: null, company: null }),
    },
    {
      label: "Inactive",
      count: counts.inactive,
      isActive: view === "customers" && status === "INACTIVE",
      select: () =>
        setParams({ view: null, status: "INACTIVE", page: null, sort: null, dir: null, company: null }),
    },
    {
      label: "All",
      count: counts.all,
      isActive: view === "customers" && (status === "ALL" || status === "All"),
      select: () =>
        setParams({ view: null, status: "ALL", page: null, sort: null, dir: null, company: null }),
    },
    {
      label: "Contacts",
      count: counts.contacts,
      isActive: view === "contacts",
      select: () =>
        setParams({ view: "contacts", status: null, page: null, sort: null, dir: null }),
    },
  ];

  return (
    <div className="border-b border-slate-200">
      <div className="-mb-px flex flex-wrap items-center gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            type="button"
            onClick={tab.select}
            className={`border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
              tab.isActive
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
            }`}
          >
            {tab.label}
            <span
              className={`ml-1.5 ${tab.isActive ? "text-slate-500" : "text-slate-400"}`}
            >
              {tab.count.toLocaleString()}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
