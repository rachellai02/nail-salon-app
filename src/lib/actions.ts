"use server";

import { supabase } from "@/lib/supabase";
import { Package, CustomerPackage } from "@/lib/types";
import { revalidatePath } from "next/cache";

// ─────────────────────────────────────────────────────────────
// PACKAGE TYPES (e.g. "Manicure 5x")
// ─────────────────────────────────────────────────────────────

export async function getPackages(): Promise<Package[]> {
  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createPackage(input: {
  name: string;
  total_uses: number;
  price: number;
  description?: string;
}): Promise<void> {
  const { error } = await supabase.from("packages").insert([input]);
  if (error) throw new Error(error.message);
  revalidatePath("/packages");
}

export async function updatePackage(
  id: string,
  input: Partial<Pick<Package, "name" | "total_uses" | "price" | "description" | "is_active">>
): Promise<void> {
  const { error } = await supabase.from("packages").update(input).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/packages");
}

export async function deletePackage(id: string): Promise<void> {
  const { error } = await supabase.from("packages").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/packages");
}

// ─────────────────────────────────────────────────────────────
// CUSTOMER PACKAGES (purchases)
// ─────────────────────────────────────────────────────────────

export async function getCustomerPackages(): Promise<CustomerPackage[]> {
  const { data, error } = await supabase
    .from("customer_packages")
    .select("*, package:packages(*)")
    .order("purchased_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCustomerPackageById(id: string): Promise<CustomerPackage | null> {
  const { data, error } = await supabase
    .from("customer_packages")
    .select("*, package:packages(*)")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}

export async function createCustomerPackage(input: {
  package_id: string;
  customer_name: string;
  contact_number: string;
  notes?: string;
}): Promise<void> {
  // Fetch the package to get total_uses
  const { data: pkg, error: pkgError } = await supabase
    .from("packages")
    .select("total_uses")
    .eq("id", input.package_id)
    .single();

  if (pkgError || !pkg) throw new Error("Package not found");

  const { error } = await supabase.from("customer_packages").insert([
    {
      ...input,
      remaining_uses: pkg.total_uses,
    },
  ]);

  if (error) throw new Error(error.message);
  revalidatePath("/packages/customers");
}

export async function deductPackageUse(
  customerPackageId: string,
  notes?: string
): Promise<void> {
  // Fetch current remaining_uses
  const { data: cp, error: fetchError } = await supabase
    .from("customer_packages")
    .select("remaining_uses")
    .eq("id", customerPackageId)
    .single();

  if (fetchError || !cp) throw new Error("Customer package not found");
  if (cp.remaining_uses <= 0) throw new Error("No remaining uses left");

  // Deduct one use
  const { error: updateError } = await supabase
    .from("customer_packages")
    .update({ remaining_uses: cp.remaining_uses - 1 })
    .eq("id", customerPackageId);

  if (updateError) throw new Error(updateError.message);

  // Log the usage
  const { error: logError } = await supabase.from("package_usage_logs").insert([
    {
      customer_package_id: customerPackageId,
      notes: notes ?? null,
    },
  ]);

  if (logError) throw new Error(logError.message);
  revalidatePath("/packages/customers");
}

export async function getUsageLogs(customerPackageId: string) {
  const { data, error } = await supabase
    .from("package_usage_logs")
    .select("*")
    .eq("customer_package_id", customerPackageId)
    .order("used_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
