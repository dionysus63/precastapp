import { SettingsShell } from "@/components/settings/settings-shell";
import { SectionCard } from "@/components/dashboard/section-card";
import {
  createProductGroupFormAction,
  deleteProductGroupFormAction,
  removeProductGroupMemberFormAction,
  updateProductGroupFormAction,
} from "@/app/settings/product-groups/actions";
import { GroupProductPicker } from "@/components/settings/group-product-picker";
import { withDatabaseRetry } from "@/lib/prisma";
import {
  tableBodyClassName,
  tableCellClassName,
  tableClassName,
  tableFlushWrapperClassName,
  tableHeaderCellClassName,
} from "@/lib/table-styles";

const inputClassName =
  "rounded-lg border border-slate-200 px-2 py-1.5 text-xs";

type GroupWithMembers = {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  members: {
    id: string;
    product: { id: string; productCode: string; name: string };
  }[];
};

function GroupEditor({
  group,
  productOptions,
  isSubGroup = false,
}: {
  group: GroupWithMembers;
  productOptions: { id: string; productCode: string; name: string }[];
  isSubGroup?: boolean;
}) {
  return (
    <div
      className={
        isSubGroup
          ? "rounded-lg border border-slate-200 p-3"
          : undefined
      }
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <form
          action={updateProductGroupFormAction}
          className="flex flex-wrap items-end gap-2"
        >
          <input type="hidden" name="id" value={group.id} />
          <div>
            <label
              htmlFor={`group-name-${group.id}`}
              className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500"
            >
              {isSubGroup ? "Sub-group name" : "Group name"}
            </label>
            <input
              id={`group-name-${group.id}`}
              name="name"
              defaultValue={group.name}
              required
              className={`mt-1 w-48 ${inputClassName}`}
            />
          </div>
          <div>
            <label
              htmlFor={`group-sort-${group.id}`}
              className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500"
            >
              Sort
            </label>
            <input
              id={`group-sort-${group.id}`}
              name="sortOrder"
              type="number"
              step="1"
              defaultValue={group.sortOrder}
              className={`mt-1 w-16 ${inputClassName}`}
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Save
          </button>
        </form>
        <form action={deleteProductGroupFormAction}>
          <input type="hidden" name="id" value={group.id} />
          <button
            type="submit"
            className="text-xs font-medium text-red-700 underline hover:text-red-900"
          >
            {isSubGroup ? "Delete sub-group" : "Delete group"}
          </button>
        </form>
      </div>

      <GroupProductPicker
        groupId={group.id}
        products={productOptions}
        memberProductIds={group.members.map((member) => member.product.id)}
      />

      {group.members.length === 0 ? (
        <p className="mt-2 text-xs text-slate-400">No products yet.</p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {group.members.map((member) => (
            <li
              key={member.id}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-2.5 pr-1 text-xs text-slate-700"
              title={member.product.name}
            >
              <span className="font-medium">{member.product.productCode}</span>
              <form action={removeProductGroupMemberFormAction}>
                <input type="hidden" name="id" value={member.id} />
                <button
                  type="submit"
                  aria-label={`Remove ${member.product.productCode}`}
                  className="rounded-full px-1 text-slate-400 hover:bg-slate-200 hover:text-red-600"
                >
                  ×
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function ProductGroupsPage() {
  const [groups, products] = await Promise.all([
    withDatabaseRetry((prisma) =>
      prisma.productGroup.findMany({
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          members: {
            orderBy: { product: { productCode: "asc" } },
            select: {
              id: true,
              product: {
                select: { id: true, productCode: true, name: true },
              },
            },
          },
        },
      }),
    ),
    withDatabaseRetry((prisma) =>
      prisma.product.findMany({
        where: { status: "ACTIVE" },
        orderBy: { productCode: "asc" },
        select: { id: true, productCode: true, name: true },
      }),
    ),
  ]);

  const topLevel = groups.filter((group) => group.parentId == null);
  const childrenByParent = new Map<string, typeof groups>();
  for (const group of groups) {
    if (group.parentId) {
      const list = childrenByParent.get(group.parentId) ?? [];
      list.push(group);
      childrenByParent.set(group.parentId, list);
    }
  }

  return (
    <SettingsShell
      title="Product Groups"
      subtitle="Custom groupings for the walk-in product picker. A product can belong to any number of groups and sub-groups."
    >
      <SectionCard
        title="New group"
        description="Leave the parent blank for a top-level group, or pick one to create a sub-group inside it."
      >
        <form
          action={createProductGroupFormAction}
          className="flex flex-wrap items-end gap-2"
        >
          <div>
            <label
              htmlFor="newGroupName"
              className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500"
            >
              Name
            </label>
            <input
              id="newGroupName"
              name="name"
              required
              placeholder="e.g. Septic Packages"
              className={`mt-1 w-56 ${inputClassName}`}
            />
          </div>
          <div>
            <label
              htmlFor="newGroupParent"
              className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500"
            >
              Parent group (optional)
            </label>
            <select
              id="newGroupParent"
              name="parentId"
              className={`mt-1 w-56 ${inputClassName}`}
            >
              <option value="">None — top-level group</option>
              {topLevel.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="newGroupSort"
              className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500"
            >
              Sort
            </label>
            <input
              id="newGroupSort"
              name="sortOrder"
              type="number"
              step="1"
              defaultValue={0}
              className={`mt-1 w-16 ${inputClassName}`}
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-medium text-white"
          >
            Create
          </button>
        </form>
      </SectionCard>

      {topLevel.length === 0 ? (
        <SectionCard title="Groups" noPadding>
          <div className={tableFlushWrapperClassName}>
            <table className={tableClassName}>
              <thead>
                <tr>
                  <th className={tableHeaderCellClassName}>Group</th>
                </tr>
              </thead>
              <tbody className={tableBodyClassName}>
                <tr>
                  <td className={`${tableCellClassName} text-slate-500`}>
                    No groups yet — create one above and it appears as a filter
                    on the walk-in screen.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : (
        topLevel.map((group) => {
          const children = childrenByParent.get(group.id) ?? [];
          return (
            <SectionCard
              key={group.id}
              title={group.name}
              description={`${group.members.length} product${
                group.members.length === 1 ? "" : "s"
              } directly in this group · ${children.length} sub-group${
                children.length === 1 ? "" : "s"
              }. Deleting a group removes its sub-groups and assignments, never the products.`}
            >
              <GroupEditor group={group} productOptions={products} />
              {children.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {children.map((child) => (
                    <GroupEditor
                      key={child.id}
                      group={child}
                      productOptions={products}
                      isSubGroup
                    />
                  ))}
                </div>
              ) : null}
            </SectionCard>
          );
        })
      )}
    </SettingsShell>
  );
}
