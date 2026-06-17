"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CustomerStatus,
  CustomerType,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export async function createCustomer(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("Customer name is required.");
  }

  const customerType = String(
    formData.get("customerType") ?? CustomerType.COMMERCIAL,
  ) as CustomerType;

  const status = String(
    formData.get("status") ?? CustomerStatus.ACTIVE,
  ) as CustomerStatus;

  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const billingAddress =
    String(formData.get("billingAddress") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await prisma.customer.create({
    data: {
      name,
      customerType,
      status,
      phone,
      email,
      billingAddress,
      notes,
    },
  });

  revalidatePath("/customers");
  redirect("/customers");
}
