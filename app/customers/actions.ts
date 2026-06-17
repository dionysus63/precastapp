"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CustomerStatus,
  CustomerType,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function parseCustomerFormData(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("Customer name is required.");
  }

  const customerType = String(
    formData.get("customerType") ?? CustomerType.CONTRACTOR,
  ) as CustomerType;

  const status = String(
    formData.get("status") ?? CustomerStatus.ACTIVE,
  ) as CustomerStatus;

  const primaryContactName =
    String(formData.get("primaryContactName") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const billingAddress =
    String(formData.get("billingAddress") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  return {
    name,
    customerType,
    status,
    primaryContactName,
    phone,
    email,
    billingAddress,
    notes,
  };
}

export async function createCustomer(formData: FormData) {
  const data = parseCustomerFormData(formData);

  await prisma.customer.create({ data });

  revalidatePath("/customers");
  redirect("/customers");
}

export async function updateCustomer(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    throw new Error("Customer id is required.");
  }

  const data = parseCustomerFormData(formData);

  await prisma.customer.update({
    where: { id },
    data,
  });

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}

export async function deleteCustomer(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) {
    throw new Error("Customer id is required.");
  }

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      _count: {
        select: { jobs: true },
      },
    },
  });

  if (!customer) {
    throw new Error("Customer not found.");
  }

  if (customer._count.jobs > 0) {
    throw new Error("Cannot delete a customer that has jobs assigned.");
  }

  await prisma.customer.delete({ where: { id } });

  revalidatePath("/customers");
  redirect("/customers");
}
