"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  updateTicketDriver,
  updateTicketTrailer,
  type UpdateTicketDriverResult,
} from "@/app/delivery-tickets/actions";

type FleetAssignSelectProps = {
  ticketId: string;
  assigned: string | null;
  options: string[];
  unassignedLabel: string;
  ariaLabel: string;
  action: (ticketId: string, value: string | null) => Promise<UpdateTicketDriverResult>;
};

/**
 * Dispatch quick-assign dropdown. Optimistic: the picked value shows
 * immediately and the control stays clickable while the server action and
 * router refresh run in the background; on error it reverts and explains.
 */
function FleetAssignSelect({
  ticketId,
  assigned,
  options,
  unassignedLabel,
  ariaLabel,
  action,
}: FleetAssignSelectProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [value, setValue] = useState(assigned ?? "");

  // Adopt server refreshes (e.g. edits from another screen) during render.
  const [prevAssigned, setPrevAssigned] = useState(assigned);
  if (assigned !== prevAssigned) {
    setPrevAssigned(assigned);
    setValue(assigned ?? "");
  }

  const optionList =
    options.includes(value) || !value ? options : [value, ...options];

  function handleChange(next: string) {
    const previous = value;
    setValue(next);
    setError(null);
    startTransition(async () => {
      const result = await action(ticketId, next || null);
      if ("error" in result) {
        setError(result.error);
        setValue(previous);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div>
      <select
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        aria-label={ariaLabel}
        className={`block w-32 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900 shadow-sm ${
          pending ? "opacity-60" : ""
        }`}
      >
        <option value="">{unassignedLabel}</option>
        {optionList.map((option) => (
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

export function DriverSelect({
  ticketId,
  driver,
  drivers,
}: {
  ticketId: string;
  driver: string | null;
  drivers: string[];
}) {
  return (
    <FleetAssignSelect
      ticketId={ticketId}
      assigned={driver}
      options={drivers}
      unassignedLabel="Unassigned"
      ariaLabel="Assign driver"
      action={updateTicketDriver}
    />
  );
}

export function TrailerSelect({
  ticketId,
  trailer,
  trailers,
}: {
  ticketId: string;
  trailer: string | null;
  trailers: string[];
}) {
  return (
    <FleetAssignSelect
      ticketId={ticketId}
      assigned={trailer}
      options={trailers}
      unassignedLabel="No trailer"
      ariaLabel="Assign trailer"
      action={updateTicketTrailer}
    />
  );
}
