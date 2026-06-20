"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  CustomerStatus,
  CustomerType,
} from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const CUSTOMER_TYPES = Object.values(CustomerType);
const CUSTOMER_STATUSES = Object.values(CustomerStatus);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseCustomerFormData(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    throw new Error("Customer name is required.");
  }

  const customerTypeRaw = String(formData.get("customerType") ?? "").trim();
  if (
    !customerTypeRaw ||
    !CUSTOMER_TYPES.includes(customerTypeRaw as CustomerType)
  ) {
    throw new Error("Customer type is required.");
  }
  const customerType = customerTypeRaw as CustomerType;

  const statusRaw = String(formData.get("status") ?? "").trim();
  if (!statusRaw || !CUSTOMER_STATUSES.includes(statusRaw as CustomerStatus)) {
    throw new Error("Status is required.");
  }
  const status = statusRaw as CustomerStatus;

  const primaryContactName =
    String(formData.get("primaryContactName") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const emailRaw = String(formData.get("email") ?? "").trim();
  if (emailRaw && !EMAIL_PATTERN.test(emailRaw)) {
    throw new Error("Email must be a valid email address.");
  }
  const email = emailRaw || null;
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
