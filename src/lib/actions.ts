"use server";

import { randomInt } from "crypto";
import { supabase } from "@/lib/supabase";
import {
  Package,
  CustomerPackage,
  Customer,
  ArchivedPackage,
  ArchivedCustomer,
  ArchivedCustomerPackage,
  Appointment,
  PackageItem,
  CustomerPackageItem,
  ServiceCategory,
  Service,
} from "@/lib/types";
import { revalidatePath } from "next/cache";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMissingArchiveTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;

  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  );
}

async function purgeExpiredArchiveRecords(): Promise<void> {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const cutoffIso = cutoff.toISOString();

  const { error: packageError } = await supabase
    .from("archived_packages")
    .delete()
    .lt("deleted_at", cutoffIso);

  if (packageError && !isMissingArchiveTableError(packageError)) {
    throw new Error(packageError.message);
  }

  const { error: customerError } = await supabase
    .from("archived_customers")
    .delete()
    .lt("deleted_at", cutoffIso);

  if (customerError && !isMissingArchiveTableError(customerError)) {
    throw new Error(customerError.message);
  }

  const { error: customerPackageError } = await supabase
    .from("archived_customer_packages")
    .delete()
    .lt("deleted_at", cutoffIso);

  if (customerPackageError && !isMissingArchiveTableError(customerPackageError)) {
    throw new Error(customerPackageError.message);
  }
}

async function generateUniqueCustomerCode(): Promise<string> {
  // Retry a few times to avoid collisions with existing 8-digit IDs.
  for (let i = 0; i < 10; i++) {
    const code = String(randomInt(10000000, 100000000));
    const { data, error } = await supabase
      .from("customers")
      .select("id")
      .eq("customer_code", code)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return code;
  }

  throw new Error("Failed to generate a unique customer ID. Please try again.");
}

// ─────────────────────────────────────────────────────────────
// PACKAGE TYPES (e.g. "Manicure 5x")
// ─────────────────────────────────────────────────────────────

export async function getPackages(): Promise<Package[]> {
  const { data, error } = await supabase
    .from("packages")
    .select("*, items:package_items(*)")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((pkg: any) => ({
    ...pkg,
    items: ((pkg.items ?? []) as PackageItem[]).sort((a, b) => a.sort_order - b.sort_order),
  })) as Package[];
}

export async function createPackage(input: {
  name: string;
  price: number;
  description?: string;
  package_type: 'services' | 'credit';
  items?: { service_name: string; total_uses: number }[];
  total_credits?: number;
}): Promise<void> {
  if (input.package_type === 'services') {
    if (!input.items || input.items.length === 0) throw new Error("At least one service item is required");
    const total_uses = input.items.reduce((sum, item) => sum + item.total_uses, 0);

    const { data: pkg, error } = await supabase
      .from("packages")
      .insert([{ name: input.name, price: input.price, description: input.description, package_type: 'services', total_uses, total_credits: null }])
      .select()
      .single();
    if (error) throw new Error(error.message);

    const { error: itemsError } = await supabase.from("package_items").insert(
      input.items.map((item, idx) => ({
        package_id: pkg.id,
        service_name: item.service_name,
        total_uses: item.total_uses,
        sort_order: idx,
      }))
    );
    if (itemsError) throw new Error(itemsError.message);
  } else {
    if (!input.total_credits || input.total_credits <= 0) throw new Error("Total credits must be greater than 0");
    const { error } = await supabase
      .from("packages")
      .insert([{ name: input.name, price: input.price, description: input.description, package_type: 'credit', total_uses: 0, total_credits: input.total_credits }]);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/packages");
}

export async function updatePackage(
  id: string,
  input: Partial<Pick<Package, "name" | "total_uses" | "price" | "description" | "is_active" | "total_credits">> & {
    items?: { service_name: string; total_uses: number }[];
  }
): Promise<void> {
  const { items, ...packageData } = input;

  if (items !== undefined) {
    packageData.total_uses = items.reduce((sum, item) => sum + item.total_uses, 0);
  }

  if (Object.keys(packageData).length > 0) {
    const { error } = await supabase.from("packages").update(packageData).eq("id", id);
    if (error) throw new Error(error.message);
  }

  if (items !== undefined) {
    await supabase.from("package_items").delete().eq("package_id", id);
    if (items.length > 0) {
      const { error: itemsError } = await supabase.from("package_items").insert(
        items.map((item, idx) => ({
          package_id: id,
          service_name: item.service_name,
          total_uses: item.total_uses,
          sort_order: idx,
        }))
      );
      if (itemsError) throw new Error(itemsError.message);
    }
  }

  revalidatePath("/packages");
}

export async function deletePackage(id: string): Promise<void> {
  const { data: pkg, error: fetchError } = await supabase
    .from("packages")
    .select("*, items:package_items(*)")
    .eq("id", id)
    .single();

  if (fetchError || !pkg) throw new Error("Package not found");
  const pkgItems = ((pkg.items ?? []) as PackageItem[]).sort((a, b) => a.sort_order - b.sort_order);

  // Get all customer packages using this package type
  const { data: customerPackages, error: cpError } = await supabase
    .from("customer_packages")
    .select("*, customer:customers(*), package:packages(*), items:customer_package_items(*)")
    .eq("package_id", id);

  if (cpError) throw new Error(cpError.message);

  // Archive each customer package
  if (customerPackages && customerPackages.length > 0) {
    for (const cp of customerPackages) {
      // Get usage logs for this customer package
      const { data: usageLogs, error: usageLogsError } = await supabase
        .from("package_usage_logs")
        .select("used_at, notes")
        .eq("customer_package_id", cp.id)
        .order("used_at", { ascending: true });

      if (usageLogsError) throw new Error(usageLogsError.message);

      // Archive the customer package
      const { error: archiveCpError } = await supabase
        .from("archived_customer_packages")
        .insert([
          {
            original_customer_package_id: cp.id,
            customer_id: cp.customer?.id ?? null,
            customer_code: cp.customer?.customer_code ?? null,
            customer_name: cp.customer?.name ?? "Unknown Customer",
            contact_number: cp.customer?.contact_number ?? "",
            package_id: cp.package?.id ?? cp.package_id,
            package_code: cp.package?.package_code ?? null,
            package_name: cp.package?.name ?? "Unknown Package",
            package_type: cp.package?.package_type ?? 'services',
            total_uses: cp.package?.total_uses ?? cp.remaining_uses,
            total_credits: cp.package?.total_credits ?? null,
            remaining_uses: cp.remaining_uses,
            remaining_credits: cp.remaining_credits ?? null,
            purchased_at: cp.purchased_at,
            expiry_date: cp.expiry_date,
            notes: cp.notes,
            usage_logs: (usageLogs ?? []).map((log) => ({
              used_at: log.used_at,
              notes: log.notes,
            })),
            items: ((cp.items ?? []) as CustomerPackageItem[]).map((item) => ({
              service_name: item.service_name,
              total_uses: item.total_uses,
              remaining_uses: item.remaining_uses,
              sort_order: item.sort_order,
            })),
          },
        ]);

      if (archiveCpError && !isMissingArchiveTableError(archiveCpError)) {
        throw new Error(archiveCpError.message);
      }

      // Delete usage logs for this customer package
      const { error: deleteLogsError } = await supabase
        .from("package_usage_logs")
        .delete()
        .eq("customer_package_id", cp.id);

      if (deleteLogsError) throw new Error(deleteLogsError.message);

      // Delete the customer package
      const { error: deleteCpError } = await supabase
        .from("customer_packages")
        .delete()
        .eq("id", cp.id);

      if (deleteCpError) throw new Error(deleteCpError.message);
    }
  }

  // Archive the package type
  const { error: archiveError } = await supabase.from("archived_packages").insert([
    {
      original_package_id: pkg.id,
      package_code: pkg.package_code,
      name: pkg.name,
      package_type: pkg.package_type ?? 'services',
      total_uses: pkg.total_uses,
      total_credits: pkg.total_credits ?? null,
      price: pkg.price,
      description: pkg.description,
      was_active: pkg.is_active,
      created_at: pkg.created_at,
      items: pkgItems.map((item) => ({
        service_name: item.service_name,
        total_uses: item.total_uses,
        sort_order: item.sort_order,
      })),
    },
  ]);

  if (archiveError && !isMissingArchiveTableError(archiveError)) {
    throw new Error(archiveError.message);
  }

  // Delete the package type
  const { error } = await supabase.from("packages").delete().eq("id", id);
  if (error) throw new Error(error.message);
  
  revalidatePath("/packages");
  revalidatePath("/packages/customers");
  revalidatePath("/packages/archive");
  revalidatePath("/packages/archive/package-types");
}

export async function getArchivedPackages(): Promise<ArchivedPackage[]> {
  await purgeExpiredArchiveRecords();

  const { data, error } = await supabase
    .from("archived_packages")
    .select("*")
    .order("deleted_at", { ascending: false });

  if (error) {
    if (isMissingArchiveTableError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as ArchivedPackage[];
}

export async function restoreArchivedPackage(archivedPackageId: string): Promise<void> {
  if (!archivedPackageId || !UUID_REGEX.test(archivedPackageId)) {
    throw new Error("Invalid archived package id");
  }

  // Get the archived package
  const { data: archivedPackage, error: archivedError } = await supabase
    .from("archived_packages")
    .select("*")
    .eq("id", archivedPackageId)
    .single();

  if (archivedError || !archivedPackage) {
    if (isMissingArchiveTableError(archivedError)) {
      throw new Error("Archive feature not available");
    }
    throw new Error("Archived package not found");
  }

  // Check if the package already exists (prevent duplicate restore)
  const { data: existingPackage, error: existingError } = await supabase
    .from("packages")
    .select("id")
    .eq("id", archivedPackage.original_package_id)
    .maybeSingle();

  if (existingError) throw new Error(existingError.message);
  if (existingPackage) {
    throw new Error("Package already exists. It may have been restored already.");
  }

  // Restore the package type
  const { error: restorePackageError } = await supabase
    .from("packages")
    .insert([
      {
        id: archivedPackage.original_package_id,
        name: archivedPackage.name,
        package_type: archivedPackage.package_type ?? 'services',
        total_uses: archivedPackage.total_uses,
        total_credits: archivedPackage.total_credits ?? null,
        price: archivedPackage.price,
        description: archivedPackage.description,
        is_active: archivedPackage.was_active,
        created_at: archivedPackage.created_at,
      },
    ]);

  if (restorePackageError) throw new Error(restorePackageError.message);

  // Restore package items from snapshot
  const archivedPkgItems = Array.isArray(archivedPackage.items) ? archivedPackage.items : [];
  if (archivedPkgItems.length > 0) {
    await supabase.from("package_items").insert(
      archivedPkgItems.map((item: any) => ({
        package_id: archivedPackage.original_package_id,
        service_name: item.service_name,
        total_uses: item.total_uses,
        sort_order: item.sort_order ?? 0,
      }))
    );
    // Ignore errors on item restoration (best-effort)
  }
  // Use a time window because customer packages are archived slightly before the package type
  // (they're archived in a loop, then the package type is archived)
  const packageDeletedAt = new Date(archivedPackage.deleted_at);
  const timeWindowStart = new Date(packageDeletedAt.getTime() - 2 * 60 * 1000); // 2 minutes before
  const timeWindowEnd = new Date(packageDeletedAt.getTime() + 1 * 60 * 1000); // 1 minute after

  const { data: archivedCustomerPackages, error: acpError } = await supabase
    .from("archived_customer_packages")
    .select("*")
    .eq("package_id", archivedPackage.original_package_id)
    .gte("deleted_at", timeWindowStart.toISOString())
    .lte("deleted_at", timeWindowEnd.toISOString());

  if (acpError && !isMissingArchiveTableError(acpError)) {
    throw new Error(acpError.message);
  }

  // Restore each customer package
  if (archivedCustomerPackages && archivedCustomerPackages.length > 0) {
    for (const acp of archivedCustomerPackages) {
      let shouldDeleteArchive = false;

      // Check if customer still exists
      if (acp.customer_id) {
        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .select("id")
          .eq("id", acp.customer_id)
          .maybeSingle();

        if (!customerError && customer) {
          // Check if this customer package was already restored
          const { data: existingCp, error: existingCpError } = await supabase
            .from("customer_packages")
            .select("id")
            .eq("id", acp.original_customer_package_id)
            .maybeSingle();

          if (existingCp) {
            // Already restored, just clean up archive
            shouldDeleteArchive = true;
          } else if (!existingCpError) {
            // Not yet restored, try to restore now
            const { error: restoreCpError } = await supabase
              .from("customer_packages")
              .insert([
                {
                  id: acp.original_customer_package_id,
                  customer_id: acp.customer_id,
                  package_id: archivedPackage.original_package_id,
                  remaining_uses: acp.remaining_uses,
                  remaining_credits: acp.remaining_credits ?? null,
                  purchased_at: acp.purchased_at,
                  expiry_date: acp.expiry_date,
                  notes: acp.notes,
                },
              ]);

            if (!restoreCpError) {
              // Restore customer_package_items from snapshot
              const cpItems = Array.isArray(acp.items) ? acp.items : [];
              if (cpItems.length > 0) {
                await supabase.from("customer_package_items").insert(
                  cpItems.map((item: any) => ({
                    customer_package_id: acp.original_customer_package_id,
                    service_name: item.service_name,
                    total_uses: item.total_uses,
                    remaining_uses: item.remaining_uses,
                    sort_order: item.sort_order ?? 0,
                  }))
                );
              }
              // Successfully restored, now restore usage logs
              if (acp.usage_logs && Array.isArray(acp.usage_logs) && acp.usage_logs.length > 0) {
                const usageLogsToInsert = acp.usage_logs.map((log: any) => ({
                  customer_package_id: acp.original_customer_package_id,
                  used_at: log.used_at,
                  notes: log.notes,
                }));

                await supabase.from("package_usage_logs").insert(usageLogsToInsert);
                // Ignore errors on usage logs restoration
              }
              shouldDeleteArchive = true;
            }
          }
        }
      }

      // Delete the archived customer package record if restoration succeeded or already exists
      if (shouldDeleteArchive) {
        await supabase
          .from("archived_customer_packages")
          .delete()
          .eq("id", acp.id);
      }
    }
  }

  // Delete the archived package record
  const { error: deleteArchivedError } = await supabase
    .from("archived_packages")
    .delete()
    .eq("id", archivedPackageId);

  if (deleteArchivedError) throw new Error(deleteArchivedError.message);

  revalidatePath("/packages");
  revalidatePath("/packages/customers", "layout"); // Revalidates all customer detail pages
  revalidatePath("/packages/archive");
  revalidatePath("/packages/archive/package-types");
}

export async function permanentlyDeleteAllArchivedPackages(): Promise<void> {
  await purgeExpiredArchiveRecords();

  const { data: archivedPackages, error: archivedPackagesError } = await supabase
    .from("archived_packages")
    .select("original_package_id");

  if (archivedPackagesError) {
    if (isMissingArchiveTableError(archivedPackagesError)) return;
    throw new Error(archivedPackagesError.message);
  }

  const originalPackageIds = (archivedPackages ?? [])
    .map((pkg) => pkg.original_package_id)
    .filter(Boolean);

  if (originalPackageIds.length > 0) {
    const { error: deleteArchivedCustomerPackagesError } = await supabase
      .from("archived_customer_packages")
      .delete()
      .in("package_id", originalPackageIds);

    if (
      deleteArchivedCustomerPackagesError &&
      !isMissingArchiveTableError(deleteArchivedCustomerPackagesError)
    ) {
      throw new Error(deleteArchivedCustomerPackagesError.message);
    }
  }

  const { error: deleteArchivedPackagesError } = await supabase
    .from("archived_packages")
    .delete()
    .not("id", "is", null);

  if (deleteArchivedPackagesError && !isMissingArchiveTableError(deleteArchivedPackagesError)) {
    throw new Error(deleteArchivedPackagesError.message);
  }

  revalidatePath("/packages/archive");
  revalidatePath("/packages/archive/package-types");
}

// ─────────────────────────────────────────────────────────────
// CUSTOMERS
// ─────────────────────────────────────────────────────────────

export async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCustomerById(id: string): Promise<Customer | null> {
  if (!id || !UUID_REGEX.test(id)) return null;

  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}

export async function createCustomer(input: {
  name: string;
  contact_number: string;
  birthday?: string;
}): Promise<Customer> {
  if (!/^\+?\d+$/.test(input.contact_number)) {
    throw new Error("Contact number must contain numbers only (with optional + prefix)");
  }

  const customerCode = await generateUniqueCustomerCode();

  const { data, error } = await supabase
    .from("customers")
    .insert([
      {
        ...input,
        birthday: input.birthday?.trim() ? input.birthday : null,
        customer_code: customerCode,
      },
    ])
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/packages/customers");
  return data;
}

export async function updateCustomer(
  id: string,
  input: Partial<Pick<Customer, "name" | "contact_number" | "birthday">>
): Promise<void> {
  if (input.contact_number !== undefined && !/^\+?\d+$/.test(input.contact_number)) {
    throw new Error("Contact number must contain numbers only (with optional + prefix)");
  }

  const normalizedInput = {
    ...input,
    birthday:
      input.birthday === undefined
        ? undefined
        : input.birthday?.trim()
        ? input.birthday
        : null,
  };

  const { error } = await supabase.from("customers").update(normalizedInput).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/packages/customers");
}

export async function deleteCustomer(id: string): Promise<void> {
  if (!id || !UUID_REGEX.test(id)) {
    throw new Error("Invalid customer id");
  }

  const { data: customer, error: customerFetchError } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (customerFetchError || !customer) throw new Error("Customer not found");

  const { error: archiveCustomerError } = await supabase.from("archived_customers").insert([
    {
      original_customer_id: customer.id,
      customer_code: customer.customer_code,
      name: customer.name,
      contact_number: customer.contact_number,
      birthday: customer.birthday,
      created_at: customer.created_at,
    },
  ]);

  if (archiveCustomerError && !isMissingArchiveTableError(archiveCustomerError)) {
    throw new Error(archiveCustomerError.message);
  }

  // Delete dependency chain: usage_logs -> customer_packages -> customer
  const { data: customerPackages, error: fetchPackagesError } = await supabase
    .from("customer_packages")
    .select("*, package:packages(*), items:customer_package_items(*)")
    .eq("customer_id", id);

  if (fetchPackagesError) throw new Error(fetchPackagesError.message);

  const packageIds = (customerPackages ?? []).map((pkg) => pkg.id);

  const { data: usageLogs, error: usageLogsError } = packageIds.length
    ? await supabase
        .from("package_usage_logs")
        .select("customer_package_id, used_at, notes")
        .in("customer_package_id", packageIds)
    : { data: [], error: null as { message?: string } | null };

  if (usageLogsError) throw new Error(usageLogsError.message);

  if ((customerPackages ?? []).length > 0) {
    const archivePayload = (customerPackages ?? []).map((cp) => {
      const cpUsageLogs = (usageLogs ?? [])
        .filter((log) => log.customer_package_id === cp.id)
        .map((log) => ({
          used_at: log.used_at,
          notes: log.notes,
        }));

      return {
        original_customer_package_id: cp.id,
        customer_id: customer.id,
        customer_code: customer.customer_code,
        customer_name: customer.name,
        contact_number: customer.contact_number,
        package_id: cp.package_id,
        package_code: cp.package?.package_code ?? null,
        package_name: cp.package?.name ?? "Unknown Package",
        total_uses: cp.package?.total_uses ?? cp.remaining_uses,
        remaining_uses: cp.remaining_uses,
        purchased_at: cp.purchased_at,
        expiry_date: cp.expiry_date,
        notes: cp.notes,
        usage_logs: cpUsageLogs,
        items: ((cp.items ?? []) as CustomerPackageItem[]).map((item) => ({
          service_name: item.service_name,
          total_uses: item.total_uses,
          remaining_uses: item.remaining_uses,
          sort_order: item.sort_order,
        })),
      };
    });

    const { error: archivePackagesError } = await supabase
      .from("archived_customer_packages")
      .insert(archivePayload);

    if (archivePackagesError && !isMissingArchiveTableError(archivePackagesError)) {
      throw new Error(archivePackagesError.message);
    }
  }

  if (packageIds.length > 0) {
    const { error: deleteLogsError } = await supabase
      .from("package_usage_logs")
      .delete()
      .in("customer_package_id", packageIds);

    if (deleteLogsError) throw new Error(deleteLogsError.message);

    const { error: deletePackagesError } = await supabase
      .from("customer_packages")
      .delete()
      .eq("customer_id", id);

    if (deletePackagesError) throw new Error(deletePackagesError.message);
  }

  const { error: deleteCustomerError } = await supabase
    .from("customers")
    .delete()
    .eq("id", id);

  if (deleteCustomerError) throw new Error(deleteCustomerError.message);
  revalidatePath("/packages/customers");
  revalidatePath("/packages/archive");
}

export async function getArchivedCustomers(): Promise<ArchivedCustomer[]> {
  await purgeExpiredArchiveRecords();

  const { data, error } = await supabase
    .from("archived_customers")
    .select("*")
    .order("deleted_at", { ascending: false });

  if (error) {
    if (isMissingArchiveTableError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as ArchivedCustomer[];
}

export async function restoreArchivedCustomer(archivedCustomerId: string): Promise<void> {
  if (!archivedCustomerId || !UUID_REGEX.test(archivedCustomerId)) {
    throw new Error("Invalid archived customer id");
  }

  const { data: archivedCustomer, error: archivedCustomerError } = await supabase
    .from("archived_customers")
    .select("*")
    .eq("id", archivedCustomerId)
    .single();

  if (archivedCustomerError || !archivedCustomer) {
    if (isMissingArchiveTableError(archivedCustomerError)) {
      throw new Error("Archive table is not available yet");
    }
    throw new Error("Archived customer not found");
  }

  const { data: existingCustomer, error: existingCustomerError } = await supabase
    .from("customers")
    .select("id")
    .eq("id", archivedCustomer.original_customer_id)
    .maybeSingle();

  if (existingCustomerError) throw new Error(existingCustomerError.message);
  if (existingCustomer) throw new Error("This customer was already restored");

  const customerCode = archivedCustomer.customer_code ?? (await generateUniqueCustomerCode());

  const { error: restoreCustomerError } = await supabase.from("customers").insert([
    {
      id: archivedCustomer.original_customer_id,
      customer_code: customerCode,
      name: archivedCustomer.name,
      contact_number: archivedCustomer.contact_number,
      birthday: archivedCustomer.birthday,
      created_at: archivedCustomer.created_at,
    },
  ]);

  if (restoreCustomerError) throw new Error(restoreCustomerError.message);

  const { data: relatedArchivedPackages, error: relatedArchivedPackagesError } = await supabase
    .from("archived_customer_packages")
    .select("*")
    .eq("customer_id", archivedCustomer.original_customer_id)
    .gte("deleted_at", archivedCustomer.deleted_at)
    .order("deleted_at", { ascending: true });

  if (relatedArchivedPackagesError && !isMissingArchiveTableError(relatedArchivedPackagesError)) {
    throw new Error(relatedArchivedPackagesError.message);
  }

  for (const archivedPackage of relatedArchivedPackages ?? []) {
    if (!archivedPackage.package_id) {
      continue;
    }

    const { data: existingPackageType, error: packageTypeError } = await supabase
      .from("packages")
      .select("id")
      .eq("id", archivedPackage.package_id)
      .maybeSingle();

    if (packageTypeError) throw new Error(packageTypeError.message);
    if (!existingPackageType) {
      continue;
    }

    const { data: existingCustomerPackage, error: existingCustomerPackageError } = await supabase
      .from("customer_packages")
      .select("id")
      .eq("id", archivedPackage.original_customer_package_id)
      .maybeSingle();

    if (existingCustomerPackageError) throw new Error(existingCustomerPackageError.message);
    if (existingCustomerPackage) {
      continue;
    }

    const { error: restorePackageError } = await supabase.from("customer_packages").insert([
      {
        id: archivedPackage.original_customer_package_id,
        customer_id: archivedCustomer.original_customer_id,
        package_id: archivedPackage.package_id,
        remaining_uses: archivedPackage.remaining_uses,
        remaining_credits: archivedPackage.remaining_credits ?? null,
        purchased_at: archivedPackage.purchased_at,
        expiry_date: archivedPackage.expiry_date,
        notes: archivedPackage.notes,
      },
    ]);

    if (restorePackageError) throw new Error(restorePackageError.message);

    const restoredLogs: Array<{ used_at: string; notes: string | null }> =
      Array.isArray(archivedPackage.usage_logs) ? archivedPackage.usage_logs : [];
    if (restoredLogs.length > 0) {
      const { error: restoreLogsError } = await supabase.from("package_usage_logs").insert(
        restoredLogs.map((log) => ({
          customer_package_id: archivedPackage.original_customer_package_id,
          used_at: log.used_at,
          notes: log.notes ?? null,
        }))
      );

      if (restoreLogsError) throw new Error(restoreLogsError.message);
    }

    // Only remove package archives that were part of the customer deletion event and restored now.
    const { error: deleteArchivedPackageError } = await supabase
      .from("archived_customer_packages")
      .delete()
      .eq("id", archivedPackage.id);

    if (deleteArchivedPackageError) throw new Error(deleteArchivedPackageError.message);
  }

  const { error: deleteArchivedCustomerError } = await supabase
    .from("archived_customers")
    .delete()
    .eq("id", archivedCustomerId);

  if (deleteArchivedCustomerError) throw new Error(deleteArchivedCustomerError.message);

  revalidatePath("/packages/customers");
  revalidatePath("/packages/archive");
  revalidatePath("/packages/archive/customers");
  revalidatePath(`/packages/customers/${archivedCustomer.original_customer_id}`);
}

export async function permanentlyDeleteAllArchivedCustomers(): Promise<void> {
  await purgeExpiredArchiveRecords();

  const { data: archivedCustomers, error: archivedCustomersError } = await supabase
    .from("archived_customers")
    .select("original_customer_id");

  if (archivedCustomersError) {
    if (isMissingArchiveTableError(archivedCustomersError)) return;
    throw new Error(archivedCustomersError.message);
  }

  const originalCustomerIds = (archivedCustomers ?? [])
    .map((customer) => customer.original_customer_id)
    .filter(Boolean);

  if (originalCustomerIds.length > 0) {
    const { error: deleteArchivedCustomerPackagesError } = await supabase
      .from("archived_customer_packages")
      .delete()
      .in("customer_id", originalCustomerIds);

    if (
      deleteArchivedCustomerPackagesError &&
      !isMissingArchiveTableError(deleteArchivedCustomerPackagesError)
    ) {
      throw new Error(deleteArchivedCustomerPackagesError.message);
    }
  }

  const { error: deleteArchivedCustomersError } = await supabase
    .from("archived_customers")
    .delete()
    .not("id", "is", null);

  if (deleteArchivedCustomersError && !isMissingArchiveTableError(deleteArchivedCustomersError)) {
    throw new Error(deleteArchivedCustomersError.message);
  }

  revalidatePath("/packages/archive");
  revalidatePath("/packages/archive/customers");
}

// ─────────────────────────────────────────────────────────────
// CUSTOMER PACKAGES (purchases)
// ─────────────────────────────────────────────────────────────

export async function getCustomerPackages(): Promise<CustomerPackage[]> {
  const { data, error } = await supabase
    .from("customer_packages")
    .select("*, customer:customers(*), package:packages(*)")
    .order("purchased_at", { ascending: false});

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCustomerPackageById(id: string): Promise<CustomerPackage | null> {
  const { data, error } = await supabase
    .from("customer_packages")
    .select("*, customer:customers(*), package:packages(*)")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}

export async function getPackagesByCustomerId(customerId: string): Promise<CustomerPackage[]> {
  if (!customerId || !UUID_REGEX.test(customerId)) return [];

  const { data, error } = await supabase
    .from("customer_packages")
    .select("*, customer:customers(*), package:packages(*), items:customer_package_items(*)")
    .eq("customer_id", customerId)
    .order("purchased_at", { ascending: false });

  if (error) throw new Error(error.message);

  const packages = (data ?? []) as CustomerPackage[];
  if (packages.length === 0) return [];

  const packageIds = packages.map((pkg) => pkg.id);
  const { data: usageLogs, error: usageLogsError } = await supabase
    .from("package_usage_logs")
    .select("customer_package_id, used_at")
    .in("customer_package_id", packageIds)
    .order("used_at", { ascending: false });

  if (usageLogsError) throw new Error(usageLogsError.message);

  const latestUsedAtByPackageId = new Map<string, string>();
  for (const log of usageLogs ?? []) {
    const packageId = log.customer_package_id as string;
    if (!latestUsedAtByPackageId.has(packageId)) {
      latestUsedAtByPackageId.set(packageId, log.used_at as string);
    }
  }

  return packages.map((pkg) => {
    const isCredit = (pkg.package?.package_type ?? 'services') === 'credit';
    const isDepleted = isCredit
      ? (pkg.remaining_credits ?? 1) <= 0
      : pkg.remaining_uses <= 0;
    return {
      ...pkg,
      items: ((pkg.items ?? []) as CustomerPackageItem[]).sort((a, b) => a.sort_order - b.sort_order),
      completed_at: isDepleted ? latestUsedAtByPackageId.get(pkg.id) ?? null : null,
    };
  });
}

export async function createCustomerPackage(input: {
  package_id: string;
  customer_id: string;
  expiry_date?: string;
  notes?: string;
}): Promise<void> {
  // Fetch the package with its items
  const { data: pkg, error: pkgError } = await supabase
    .from("packages")
    .select("*, items:package_items(*)")
    .eq("id", input.package_id)
    .single();

  if (pkgError || !pkg) throw new Error("Package not found");

  const isCredit = (pkg.package_type ?? 'services') === 'credit';
  const items = ((pkg.items ?? []) as PackageItem[]).sort((a, b) => a.sort_order - b.sort_order);
  const total_uses = isCredit ? 0 : (items.length > 0
    ? items.reduce((sum, item) => sum + item.total_uses, 0)
    : pkg.total_uses);
  const remaining_credits = isCredit ? (pkg.total_credits ?? 0) : null;

  const { data: customerPackage, error } = await supabase
    .from("customer_packages")
    .insert([{ ...input, remaining_uses: total_uses, remaining_credits }])
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (!isCredit && items.length > 0) {
    const { error: itemsError } = await supabase.from("customer_package_items").insert(
      items.map((item) => ({
        customer_package_id: customerPackage.id,
        service_name: item.service_name,
        total_uses: item.total_uses,
        remaining_uses: item.total_uses,
        sort_order: item.sort_order,
      }))
    );
    if (itemsError) throw new Error(itemsError.message);
  }

  revalidatePath("/packages/customers");
}

export async function deleteCustomerPackage(customerPackageId: string): Promise<void> {
  if (!customerPackageId || !UUID_REGEX.test(customerPackageId)) {
    throw new Error("Invalid customer package id");
  }

  const { data: cp, error: fetchCpError } = await supabase
    .from("customer_packages")
    .select("*, customer:customers(*), package:packages(*), items:customer_package_items(*)")
    .eq("id", customerPackageId)
    .single();

  if (fetchCpError || !cp) throw new Error("Customer package not found");

  const { data: usageLogs, error: usageLogsError } = await supabase
    .from("package_usage_logs")
    .select("used_at, notes")
    .eq("customer_package_id", customerPackageId)
    .order("used_at", { ascending: true });

  if (usageLogsError) throw new Error(usageLogsError.message);

  const { error: archiveError } = await supabase
    .from("archived_customer_packages")
    .insert([
      {
        original_customer_package_id: cp.id,
        customer_id: cp.customer?.id ?? null,
        customer_code: cp.customer?.customer_code ?? null,
        customer_name: cp.customer?.name ?? "Unknown Customer",
        contact_number: cp.customer?.contact_number ?? "",
        package_id: cp.package?.id ?? cp.package_id,
        package_code: cp.package?.package_code ?? null,
        package_name: cp.package?.name ?? "Unknown Package",
        package_type: cp.package?.package_type ?? 'services',
        total_uses: cp.package?.total_uses ?? cp.remaining_uses,
        total_credits: cp.package?.total_credits ?? null,
        remaining_uses: cp.remaining_uses,
        remaining_credits: cp.remaining_credits ?? null,
        purchased_at: cp.purchased_at,
        expiry_date: cp.expiry_date,
        notes: cp.notes,
        usage_logs: (usageLogs ?? []).map((log) => ({
          used_at: log.used_at,
          notes: log.notes,
        })),
        items: ((cp.items ?? []) as CustomerPackageItem[]).map((item) => ({
          service_name: item.service_name,
          total_uses: item.total_uses,
          remaining_uses: item.remaining_uses,
          sort_order: item.sort_order,
        })),
      },
    ]);

  if (archiveError && !isMissingArchiveTableError(archiveError)) {
    throw new Error(archiveError.message);
  }

  const { error: deleteLogsError } = await supabase
    .from("package_usage_logs")
    .delete()
    .eq("customer_package_id", customerPackageId);

  if (deleteLogsError) throw new Error(deleteLogsError.message);

  const { error: deletePackageError } = await supabase
    .from("customer_packages")
    .delete()
    .eq("id", customerPackageId);

  if (deletePackageError) throw new Error(deletePackageError.message);

  revalidatePath("/packages/customers");
  revalidatePath("/packages/archive");
}

export async function getArchivedCustomerPackagesByCustomerId(
  customerId: string
): Promise<ArchivedCustomerPackage[]> {
  if (!customerId || !UUID_REGEX.test(customerId)) return [];

  const { data, error } = await supabase
    .from("archived_customer_packages")
    .select("*")
    .eq("customer_id", customerId)
    .order("deleted_at", { ascending: false });

  if (error) {
    if (isMissingArchiveTableError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as ArchivedCustomerPackage[];
}

export async function restoreArchivedCustomerPackage(archivedCustomerPackageId: string): Promise<void> {
  if (!archivedCustomerPackageId || !UUID_REGEX.test(archivedCustomerPackageId)) {
    throw new Error("Invalid archived package id");
  }

  const { data: archived, error: archivedError } = await supabase
    .from("archived_customer_packages")
    .select("*")
    .eq("id", archivedCustomerPackageId)
    .single();

  if (archivedError || !archived) {
    if (isMissingArchiveTableError(archivedError)) {
      throw new Error("Archive table is not available yet");
    }
    throw new Error("Archived package not found");
  }

  if (!archived.customer_id || !archived.package_id) {
    throw new Error("This archived package cannot be restored due to missing references");
  }

  const { data: existingCustomer, error: customerError } = await supabase
    .from("customers")
    .select("id")
    .eq("id", archived.customer_id)
    .maybeSingle();

  if (customerError) throw new Error(customerError.message);
  if (!existingCustomer) throw new Error("Cannot restore because customer no longer exists");

  const { data: existingPackageType, error: packageTypeError } = await supabase
    .from("packages")
    .select("id")
    .eq("id", archived.package_id)
    .maybeSingle();

  if (packageTypeError) throw new Error(packageTypeError.message);
  if (!existingPackageType) {
    throw new Error("Unable to restore: This package type has been deleted. Please restore the package type first from the Archive page.");
  }

  const { data: existingCustomerPackage, error: existingCpError } = await supabase
    .from("customer_packages")
    .select("id")
    .eq("id", archived.original_customer_package_id)
    .maybeSingle();

  if (existingCpError) throw new Error(existingCpError.message);
  if (existingCustomerPackage) throw new Error("This package was already restored");

  const { error: restoreError } = await supabase.from("customer_packages").insert([
    {
      id: archived.original_customer_package_id,
      customer_id: archived.customer_id,
      package_id: archived.package_id,
      remaining_uses: archived.remaining_uses,
      remaining_credits: archived.remaining_credits ?? null,
      purchased_at: archived.purchased_at,
      expiry_date: archived.expiry_date,
      notes: archived.notes,
    },
  ]);

  if (restoreError) throw new Error(restoreError.message);

  // Restore customer_package_items from snapshot
  const archivedItems = Array.isArray(archived.items) ? archived.items : [];
  if (archivedItems.length > 0) {
    await supabase.from("customer_package_items").insert(
      archivedItems.map((item: any) => ({
        customer_package_id: archived.original_customer_package_id,
        service_name: item.service_name,
        total_uses: item.total_uses,
        remaining_uses: item.remaining_uses,
        sort_order: item.sort_order ?? 0,
      }))
    );
    // Ignore errors on item restoration (best-effort)
  }

  const restoredLogs: Array<{ used_at: string; notes: string | null }> =
    Array.isArray(archived.usage_logs) ? archived.usage_logs : [];
  if (restoredLogs.length > 0) {
    const { error: restoreLogsError } = await supabase.from("package_usage_logs").insert(
      restoredLogs.map((log) => ({
        customer_package_id: archived.original_customer_package_id,
        used_at: log.used_at,
        notes: log.notes ?? null,
      }))
    );

    if (restoreLogsError) throw new Error(restoreLogsError.message);
  }

  const { error: deleteArchivedError } = await supabase
    .from("archived_customer_packages")
    .delete()
    .eq("id", archivedCustomerPackageId);

  if (deleteArchivedError) throw new Error(deleteArchivedError.message);

  revalidatePath("/packages/customers");
  revalidatePath("/packages/archive");
}

export async function permanentlyDeleteArchivedCustomerPackage(archivedCustomerPackageId: string): Promise<void> {
  if (!archivedCustomerPackageId || !UUID_REGEX.test(archivedCustomerPackageId)) {
    throw new Error("Invalid archived package id");
  }

  const { data: archived, error: archivedError } = await supabase
    .from("archived_customer_packages")
    .select("*")
    .eq("id", archivedCustomerPackageId)
    .single();

  if (archivedError || !archived) {
    if (isMissingArchiveTableError(archivedError)) {
      throw new Error("Archive table is not available yet");
    }
    throw new Error("Archived package not found");
  }

  const { error: deleteError } = await supabase
    .from("archived_customer_packages")
    .delete()
    .eq("id", archivedCustomerPackageId);

  if (deleteError) throw new Error(deleteError.message);

  revalidatePath("/packages/customers");
  revalidatePath("/packages/archive");
}

export async function deductPackageUse(
  customerPackageId: string,
  customerPackageItemId: string | null,
  notes?: string,
  usedAt?: string,
  creditsUsed?: number,
  creditServices?: { service_name: string; price: number }[],
): Promise<void> {
  if (creditServices && creditServices.length > 0) {
    // Credit-type package deduction with per-service breakdown
    const totalCredits = creditServices.reduce((sum, s) => sum + s.price, 0);
    if (totalCredits <= 0) throw new Error("Total credits must be greater than 0");

    const { data: cp, error: fetchError } = await supabase
      .from("customer_packages")
      .select("remaining_credits")
      .eq("id", customerPackageId)
      .single();

    if (fetchError || !cp) throw new Error("Customer package not found");
    const currentCredits = cp.remaining_credits ?? 0;
    if (currentCredits <= 0) throw new Error("No remaining credits");

    const cashTopup = Math.max(0, totalCredits - currentCredits);
    const newCredits = Math.max(0, currentCredits - totalCredits);
    const { error: updateError } = await supabase
      .from("customer_packages")
      .update({ remaining_credits: newCredits })
      .eq("id", customerPackageId);
    if (updateError) throw new Error(updateError.message);

    const timestamp = usedAt ?? new Date().toISOString();
    const logRows = creditServices.map((s, idx) => ({
      customer_package_id: customerPackageId,
      customer_package_item_id: null,
      service_name: s.service_name,
      credits_used: s.price,
      cash_topup: idx === 0 && cashTopup > 0 ? cashTopup : null,
      used_at: timestamp,
      notes: notes ?? null,
    }));
    const { error: logError } = await supabase.from("package_usage_logs").insert(logRows);
    if (logError) throw new Error(logError.message);
  } else if (creditsUsed !== undefined) {
    // Credit-type package deduction (legacy — no service breakdown)
    if (creditsUsed <= 0) throw new Error("Credits used must be greater than 0");

    const { data: cp, error: fetchError } = await supabase
      .from("customer_packages")
      .select("remaining_credits")
      .eq("id", customerPackageId)
      .single();

    if (fetchError || !cp) throw new Error("Customer package not found");
    const currentCredits = cp.remaining_credits ?? 0;
    if (currentCredits <= 0) throw new Error("No remaining credits");
    if (creditsUsed > currentCredits) throw new Error(`Only ${currentCredits} credits remaining`);

    const newCredits = Math.max(0, currentCredits - creditsUsed);
    const { error: updateError } = await supabase
      .from("customer_packages")
      .update({ remaining_credits: newCredits })
      .eq("id", customerPackageId);
    if (updateError) throw new Error(updateError.message);

    const { error: logError } = await supabase.from("package_usage_logs").insert([{
      customer_package_id: customerPackageId,
      customer_package_item_id: null,
      service_name: null,
      credits_used: creditsUsed,
      used_at: usedAt ?? new Date().toISOString(),
      notes: notes ?? null,
    }]);
    if (logError) throw new Error(logError.message);
  } else if (customerPackageItemId) {
    // Item-based deduction (new packages with items)
    const { data: item, error: fetchItemError } = await supabase
      .from("customer_package_items")
      .select("remaining_uses, service_name")
      .eq("id", customerPackageItemId)
      .single();

    if (fetchItemError || !item) throw new Error("Package item not found");
    if (item.remaining_uses <= 0) throw new Error(`No remaining uses for "${item.service_name}"`);

    const { error: updateItemError } = await supabase
      .from("customer_package_items")
      .update({ remaining_uses: item.remaining_uses - 1 })
      .eq("id", customerPackageItemId);

    if (updateItemError) throw new Error(updateItemError.message);

    // Recompute and sync customer_packages.remaining_uses
    const { data: allItems } = await supabase
      .from("customer_package_items")
      .select("remaining_uses")
      .eq("customer_package_id", customerPackageId);
    const newTotal = (allItems ?? []).reduce((sum: number, i: any) => sum + i.remaining_uses, 0);
    await supabase.from("customer_packages").update({ remaining_uses: newTotal }).eq("id", customerPackageId);

    const { error: logError } = await supabase.from("package_usage_logs").insert([{
      customer_package_id: customerPackageId,
      customer_package_item_id: customerPackageItemId,
      service_name: item.service_name,
      used_at: usedAt ?? new Date().toISOString(),
      notes: notes ?? null,
    }]);
    if (logError) throw new Error(logError.message);
  } else {
    // Legacy: deduct from the whole package (packages without items)
    const { data: cp, error: fetchError } = await supabase
      .from("customer_packages")
      .select("remaining_uses")
      .eq("id", customerPackageId)
      .single();

    if (fetchError || !cp) throw new Error("Customer package not found");
    if (cp.remaining_uses <= 0) throw new Error("No remaining uses left");

    const { error: updateError } = await supabase
      .from("customer_packages")
      .update({ remaining_uses: cp.remaining_uses - 1 })
      .eq("id", customerPackageId);

    if (updateError) throw new Error(updateError.message);

    const { error: logError } = await supabase.from("package_usage_logs").insert([{
      customer_package_id: customerPackageId,
      customer_package_item_id: null,
      service_name: null,
      used_at: usedAt ?? new Date().toISOString(),
      notes: notes ?? null,
    }]);
    if (logError) throw new Error(logError.message);
  }

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

// ─────────────────────────────────────────────────────────────
// APPOINTMENTS
// ─────────────────────────────────────────────────────────────

export async function getAppointmentsForRange(
  from: string,
  to: string
): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .gte("appointment_date", from)
    .lte("appointment_date", to)
    .order("start_time", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createAppointment(input: {
  customer_name: string;
  contact_number: string | null;
  service: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  num_persons?: number;
  has_package?: boolean;
  status?: string;
}): Promise<void> {
  const { error } = await supabase.from("appointments").insert([{
    ...input,
    status: input.status ?? "confirmed",
  }]);
  if (error) throw new Error(error.message);
  revalidatePath("/appointments");
}

export async function updateAppointment(
  id: string,
  input: Partial<{
    customer_name: string;
    contact_number: string | null;
    service: string;
    appointment_date: string;
    start_time: string;
    end_time: string;
    notes: string | null;
    num_persons: number;
    has_package: boolean;
    status: string;
  }>
): Promise<void> {
  const { error } = await supabase
    .from("appointments")
    .update(input)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/appointments");
}

export async function deleteAppointment(id: string): Promise<void> {
  const { error } = await supabase
    .from("appointments")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/appointments");
}

// -------------------------------------------------------
// SERVICE CATEGORIES & SERVICES
// -------------------------------------------------------

export async function getServiceCategories(): Promise<ServiceCategory[]> {
  const { data: categories, error: catError } = await supabase
    .from("service_categories")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (catError) throw new Error(catError.message);

  const { data: services, error: svcError } = await supabase
    .from("services")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (svcError) throw new Error(svcError.message);

  return (categories ?? []).map((cat) => ({
    ...cat,
    services: (services ?? []).filter((s: Service) => s.category_id === cat.id),
  }));
}

export async function createServiceCategory(name: string): Promise<ServiceCategory> {
  const { data, error } = await supabase
    .from("service_categories")
    .insert([{ name: name.trim() }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/services");
  return data;
}

export async function updateServiceCategory(id: string, name: string): Promise<void> {
  const { error } = await supabase
    .from("service_categories")
    .update({ name: name.trim() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/services");
}

export async function deleteServiceCategory(id: string): Promise<void> {
  const { error } = await supabase
    .from("service_categories")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/services");
}

export async function createService(input: {
  category_id: string;
  name: string;
  price: number | null;
}): Promise<Service> {
  const { data, error } = await supabase
    .from("services")
    .insert([{ category_id: input.category_id, name: input.name.trim(), price: input.price }])
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/services");
  return data;
}

export async function updateService(id: string, input: {
  name?: string;
  price?: number | null;
}): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name.trim();
  if (input.price !== undefined) payload.price = input.price;
  const { error } = await supabase
    .from("services")
    .update(payload)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/services");
}

export async function deleteService(id: string): Promise<void> {
  const { error } = await supabase
    .from("services")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/services");
}

export async function reorderServiceCategories(orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("service_categories")
      .update({ sort_order: i })
      .eq("id", orderedIds[i]);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/services");
}

export async function reorderServices(orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from("services")
      .update({ sort_order: i })
      .eq("id", orderedIds[i]);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/services");
}
