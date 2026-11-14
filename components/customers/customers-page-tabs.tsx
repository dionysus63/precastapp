"use client";

import { useListQuery } from "@/components/common/use-list-query";
import { Tab, TabBar } from "@/components/ui/tabs";

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
    <TabBar label="Customers and contacts">
      {tabs.map((tab) => (
        <Tab
          key={tab.label}
          active={tab.isActive}
          count={tab.count}
          onClick={tab.select}
        >
          {tab.label}
        </Tab>
      ))}
    </TabBar>
  );
}
