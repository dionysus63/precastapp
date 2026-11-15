import {
  overviewEmptyCellClassName,
  overviewTableWrapperClassName,
} from "@/components/jobs/overview/overview-styles";
import type { JobOverviewStockItem } from "@/lib/job-overview";
import {
  tableBodyClassName,
  tableCellClassName,
  tableCompactClassName,
  tableHeaderCellClassName,
  tableRowClassName,
} from "@/lib/table-styles";

const COLUMN_COUNT = 5;

/**
 * Awarded stock items that have not all shipped yet, with what is on hand
 * beside what is still owed. An amber In Stock cell means there is not
 * enough on hand to finish the job.
 */
export function JobOverviewStockItems({
  items,
}: {
  items: JobOverviewStockItem[];
}) {
  return (
    <div className={overviewTableWrapperClassName}>
      <table className={tableCompactClassName}>
        <thead>
          <tr>
            <th className={tableHeaderCellClassName}>Item</th>
            <th className={tableHeaderCellClassName}>Awarded</th>
            <th className={tableHeaderCellClassName}>Shipped</th>
            <th className={tableHeaderCellClassName}>Left</th>
            <th className={tableHeaderCellClassName}>In Stock</th>
          </tr>
        </thead>
        <tbody className={tableBodyClassName}>
          {items.length === 0 ? (
            <tr>
              <td colSpan={COLUMN_COUNT} className={overviewEmptyCellClassName}>
                Every stock item on this job has shipped.
              </td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.key} className={tableRowClassName}>
                <td className={`${tableCellClassName} max-w-[18rem] text-slate-900`}>
                  {item.name}
                </td>
                <td className={`${tableCellClassName} tabular-nums text-slate-700`}>
                  {item.awarded}
                </td>
                <td className={`${tableCellClassName} tabular-nums text-slate-700`}>
                  {item.shipped}
                </td>
                <td
                  className={`${tableCellClassName} font-semibold tabular-nums text-slate-900`}
                >
                  {item.left}
                </td>
                <td
                  className={`${tableCellClassName} whitespace-nowrap tabular-nums ${
                    item.short
                      ? "bg-amber-50 font-semibold text-amber-800"
                      : "text-slate-700"
                  }`}
                >
                  {item.inStock}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
