"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatusBadge } from "@/components/dashboard/status-badge";

type CustomerRow = {
  id: string;
  name: string;
  type: string;
  typeVariant: "info" | "neutral" | "default";
  primaryContact: string;
  phone: string;
  email: string;
  status: string;
  statusVariant: "success" | "warning" | "neutral";
  openQuotes: number;
  balance: string;
  lastActivity: string;
};

const placeholderCustomers: CustomerRow[] = [
  {
    id: "1",
    name: "Riverview Builders",
    type: "Commercial",
    typeVariant: "info",
    primaryContact: "Mike Torres",
    phone: "(555) 401-2201",
    email: "mike@riverviewbuilders.com",
    status: "Active",
    statusVariant: "success",
    openQuotes: 2,
    balance: "$12,900",
    lastActivity: "Jun 16, 2026",
  },
  {
    id: "2",
    name: "Northside Concrete",
    type: "Contractor",
    typeVariant: "default",
    primaryContact: "Sarah Chen",
    phone: "(555) 318-7744",
    email: "sarah@northsideconcrete.com",
    status: "Active",
    statusVariant: "success",
    openQuotes: 1,
    balance: "$5,400",
    lastActivity: "Jun 15, 2026",
  },
  {
    id: "3",
    name: "Summit Development",
    type: "Commercial",
    typeVariant: "info",
    primaryContact: "James Whitfield",
    phone: "(555) 902-1188",
    email: "james@summitdev.com",
    status: "Prospect",
    statusVariant: "warning",
    openQuotes: 3,
    balance: "$0",
    lastActivity: "Jun 14, 2026",
  },
  {
    id: "4",
    name: "Greenfield Homes",
    type: "Residential",
    typeVariant: "neutral",
    primaryContact: "Lisa Nguyen",
    phone: "(555) 667-3302",
    email: "lisa@greenfieldhomes.com",
    status: "Active",
    statusVariant: "success",
    openQuotes: 0,
    balance: "$2,150",
    lastActivity: "Jun 12, 2026",
  },
  {
    id: "5",
    name: "Harbor Point LLC",
    type: "Commercial",
    typeVariant: "info",
    primaryContact: "David Brooks",
    phone: "(555) 244-8890",
    email: "david@harborpointllc.com",
    status: "Inactive",
    statusVariant: "neutral",
    openQuotes: 0,
    balance: "$0",
    lastActivity: "May 28, 2026",
  },
];

const customerTypes = ["All", "Commercial", "Residential", "Contractor", "Other"];
const statusOptions = ["All", "Active", "Inactive", "Prospect"];

export function CustomersList() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");

  const filteredCustomers = useMemo(() => {
    return placeholderCustomers.filter((customer) => {
      const matchesSearch =
        search.trim() === "" ||
        customer.name.toLowerCase().includes(search.toLowerCase()) ||
        customer.primaryContact.toLowerCase().includes(search.toLowerCase()) ||
        customer.email.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "All" || customer.status === statusFilter;

      const matchesType = typeFilter === "All" || customer.type === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [search, statusFilter, typeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row">
          <input
            type="search"
            placeholder="Search customers, contacts, or email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 shadow-sm placeholder:text-slate-400 sm:max-w-xs"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                Status: {status}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm"
          >
            {customerTypes.map((type) => (
              <option key={type} value={type}>
                Type: {type}
              </option>
            ))}
          </select>
        </div>
        <Link
          href="/customers/new"
          className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
        >
          Add Customer
        </Link>
      </div>

      <SectionCard
        title="Customer Directory"
        description={`${filteredCustomers.length} customer${filteredCustomers.length === 1 ? "" : "s"} shown`}
        noPadding
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-semibold">Customer Name</th>
                <th className="px-4 py-2.5 font-semibold">Type</th>
                <th className="px-4 py-2.5 font-semibold">Primary Contact</th>
                <th className="px-4 py-2.5 font-semibold">Phone</th>
                <th className="px-4 py-2.5 font-semibold">Email</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Open Quotes</th>
                <th className="px-4 py-2.5 font-semibold">Balance</th>
                <th className="px-4 py-2.5 font-semibold">Last Activity</th>
                <th className="px-4 py-2.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-4 py-8 text-center text-sm text-slate-500"
                  >
                    No customers match your search or filters.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {customer.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={customer.type}
                        variant={customer.typeVariant}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {customer.primaryContact}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                      {customer.phone}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {customer.email}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge
                        label={customer.status}
                        variant={customer.statusVariant}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-slate-700">
                      {customer.openQuotes}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      {customer.balance}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-slate-600">
                      {customer.lastActivity}
                    </td>
                    <td className="px-4 py-2.5">
                      <button
                        type="button"
                        className="rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
