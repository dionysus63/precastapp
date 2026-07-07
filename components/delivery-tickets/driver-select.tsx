"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateTicketDriver } from "@/app/delivery-tickets/actions";

type DriverSelectProps = {
  ticketId: string;
  driver: string | null;
  drivers: string[];
};

export function DriverSelect({ ticketId, driver, drivers }: DriverSelectProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const current = driver ?? "";
  const options = drivers.includes(current) || !current
    ? drivers
    : [current, ...drivers];

  function handleChange(value: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateTicketDriver(ticketId, value || null);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <select
        value={current}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value)}
        aria-label="Assign driver"
        className="block w-32 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm disabled:opacity-50"
      >
        <option value="">Unassigned</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error ? (
        <p className="mt-1 max-w-[12rem] text-[10px] text-red-600">{error}</p>
      ) : null}
    </div>
  );
}
