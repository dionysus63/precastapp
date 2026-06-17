import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <div className="min-h-full bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-900">Customers</h1>
            <p className="mt-1 text-zinc-600">
              Manage customer records for your precast jobs.
            </p>
          </div>
          <Link
            href="/customers/new"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            New Customer
          </Link>
        </div>

        {customers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 bg-white p-10 text-center">
            <p className="text-zinc-600">No customers yet.</p>
            <Link
              href="/customers/new"
              className="mt-4 inline-block text-sm font-medium text-zinc-900 underline"
            >
              Add your first customer
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
            <table className="min-w-full divide-y divide-zinc-200">
              <thead className="bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Email
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-3 text-sm font-medium text-zinc-900">
                      {customer.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {customer.customerType}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {customer.status}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {customer.phone ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-600">
                      {customer.email ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
