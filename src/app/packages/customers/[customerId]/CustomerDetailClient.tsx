"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArchivedCustomerPackage,
  Customer,
  CustomerPackage,
  Package,
  PackageUsageLog,
} from "@/lib/types";
import {
  deleteCustomer,
  deleteCustomerPackage,
  getUsageLogs,
  permanentlyDeleteArchivedCustomerPackage,
  restoreArchivedCustomerPackage,
} from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDownIcon, Trash2Icon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeductUseDialog } from "@/components/DeductUseDialog";
import { SellPackageDialog } from "@/components/SellPackageDialog";
import { CustomerFormDialog } from "@/components/CustomerFormDialog";
import { formatDateMY, formatDateTimeMY } from "@/lib/utils";

type Props = {
  customer: Customer;
  customerPackages: CustomerPackage[];
  allPackages: Package[];
  archivedCustomerPackages: ArchivedCustomerPackage[];
};

export default function CustomerDetailClient({
  customer,
  customerPackages,
  allPackages,
  archivedCustomerPackages,
}: Props) {
  const [deductTarget, setDeductTarget] = useState<CustomerPackage | null>(null);
  const [historyTarget, setHistoryTarget] = useState<CustomerPackage | null>(null);
  const [historyLogs, setHistoryLogs] = useState<PackageUsageLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sellOpen, setSellOpen] = useState(false);
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingPackageId, setDeletingPackageId] = useState<string | null>(null);
  const [restoringArchivedPackageId, setRestoringArchivedPackageId] = useState<string | null>(null);
  const [deletingArchivedPackageId, setDeletingArchivedPackageId] = useState<string | null>(null);
  const router = useRouter();

  const today = new Date();
  const todayLocal = new Date(today.getTime() - today.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  const activeCustomerPackages = customerPackages.filter((cp) => {
    const isCredit = cp.package?.package_type === 'credit';
    return isCredit ? (cp.remaining_credits ?? 1) > 0 : cp.remaining_uses > 0;
  });
  const completedCustomerPackages = customerPackages.filter((cp) => {
    const isCredit = cp.package?.package_type === 'credit';
    return isCredit ? (cp.remaining_credits ?? 1) <= 0 : cp.remaining_uses <= 0;
  });

  function handleDeductClose() {
    setDeductTarget(null);
    window.location.reload();
  }

  function handleSellClose() {
    setSellOpen(false);
    window.location.reload();
  }

  function handleEditCustomerClose() {
    setEditCustomerOpen(false);
    window.location.reload();
  }

  async function handleOpenHistory(cp: CustomerPackage) {
    setHistoryTarget(cp);
    setLoadingHistory(true);
    try {
      const logs = await getUsageLogs(cp.id);
      setHistoryLogs(logs);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load usage history");
      setHistoryLogs([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  function handleCloseHistory() {
    setHistoryTarget(null);
    setHistoryLogs([]);
    setLoadingHistory(false);
  }

  async function handleDeleteCustomerPackage(cp: CustomerPackage) {
    const confirmed = confirm(
      `Delete package ${cp.id.slice(0, 8).toUpperCase()} for ${customer.name}? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingPackageId(cp.id);
    try {
      await deleteCustomerPackage(cp.id);
      toast.success("Package deleted successfully");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete package");
      setDeletingPackageId(null);
    }
  }

  async function handleRestoreArchivedPackage(archivedPackage: ArchivedCustomerPackage) {
    const confirmed = confirm(
      `Restore archived package ${archivedPackage.original_customer_package_id
        .slice(0, 8)
        .toUpperCase()} for ${customer.name}?`
    );

    if (!confirmed) return;

    setRestoringArchivedPackageId(archivedPackage.id);
    try {
      await restoreArchivedCustomerPackage(archivedPackage.id);
      toast.success("Archived package restored successfully");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore archived package");
      setRestoringArchivedPackageId(null);
    }
  }

  async function handlePermanentlyDeleteArchivedPackage(archivedPackage: ArchivedCustomerPackage) {
    const confirmed = confirm(
      `Permanently delete archived package ${archivedPackage.original_customer_package_id
        .slice(0, 8)
        .toUpperCase()} for ${customer.name}? This action cannot be undone and the package cannot be recovered.`
    );

    if (!confirmed) return;

    setDeletingArchivedPackageId(archivedPackage.id);
    try {
      await permanentlyDeleteArchivedCustomerPackage(archivedPackage.id);
      toast.success("Archived package permanently deleted");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete archived package");
      setDeletingArchivedPackageId(null);
    }
  }

  async function handleDeleteCustomer() {
    const confirmed = confirm(
      `Delete customer \"${customer.name}\" and all package history? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteCustomer(customer.id);
      toast.success("Customer deleted successfully");
      router.push("/packages/customers");
    } catch {
      toast.error("Failed to delete customer");
      setDeleting(false);
    }
  }

  return (
    <div>
      {/* Breadcrumb / Back button */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => router.push("/packages/customers")}
          className="mb-4"
        >
          ← Back to Customers
        </Button>
        
        {/* Customer Info Card */}
        <div className="bg-white rounded-lg border p-6 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">{customer.name}</h1>
              <div className="space-y-1 text-gray-600">
                <p>
                  <span className="font-medium">Customer ID:</span> {customer.customer_code}
                  <button
                    className="ml-2 text-xs text-blue-500 hover:underline"
                    onClick={() => {
                      navigator.clipboard.writeText(customer.customer_code);
                    }}
                  >
                    Copy
                  </button>
                </p>
                <p>
                  <span className="font-medium">Contact:</span> {customer.contact_number}
                </p>
                {customer.birthday && (
                  <p>
                    <span className="font-medium">Birthday:</span>{" "}
                    {formatDateMY(customer.birthday)}
                  </p>
                )}
                <p>
                  <span className="font-medium">Total Packages:</span> {customerPackages.length}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setSellOpen(true)}>+ Sell Package</Button>
              <Button variant="outline" onClick={() => setEditCustomerOpen(true)}>Edit Customer</Button>
              <Button
                variant="destructive"
                onClick={handleDeleteCustomer}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Customer"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Packages Table */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Packages</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer Package ID</TableHead>
              <TableHead>Package ID</TableHead>
              <TableHead className="whitespace-normal break-words max-w-[220px]">Package Name</TableHead>
              <TableHead className="whitespace-normal break-words max-w-[240px]">Services Remaining</TableHead>
              <TableHead>Purchase Date</TableHead>
              <TableHead>Expiry Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Use History</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeCustomerPackages.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-gray-400 py-10">
                  No active packages.
                </TableCell>
              </TableRow>
            )}
            {activeCustomerPackages.map((cp) => {
              const isExpired = !cp.expiry_date || todayLocal >= cp.expiry_date;
              return (
                <TableRow key={cp.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                      onClick={() => void handleOpenHistory(cp)}
                    >
                      {cp.id.slice(0, 8).toUpperCase()}
                    </button>
                    <button
                      className="ml-2 text-xs text-blue-500 hover:underline"
                      onClick={() => {
                        navigator.clipboard.writeText(cp.id);
                      }}
                    >
                      Copy
                    </button>
                  </TableCell>
                  <TableCell>
                    {cp.package?.package_code ? (
                      <code className="text-xs bg-blue-50 px-2 py-1 rounded font-semibold">
                        {String(cp.package.package_code).padStart(3, '0')}
                      </code>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="font-medium whitespace-normal break-words max-w-[220px]">{cp.package?.name ?? "—"}</TableCell>
                  <TableCell className="whitespace-normal break-words max-w-[240px]">
                    {cp.package?.package_type === 'credit' ? (
                      <Badge
                        variant={
                          (cp.remaining_credits ?? 0) <= 0 ? "destructive" : (cp.remaining_credits ?? 0) <= (cp.package?.total_credits ?? 0) * 0.25 ? "secondary" : "default"
                        }
                      >
                        {cp.remaining_credits} / {cp.package?.total_credits} credits
                      </Badge>
                    ) : cp.items && cp.items.length > 0 ? (
                      <ul className="space-y-0.5 text-sm">
                        {cp.items.map((item) => (
                          <li key={item.id} className="flex items-center gap-1.5">
                            <Badge
                              variant={
                                item.remaining_uses === 0 ? "destructive" : item.remaining_uses <= 1 ? "secondary" : "default"
                              }
                              className="text-xs"
                            >
                              {item.remaining_uses}/{item.total_uses}
                            </Badge>
                            <span className="text-gray-700">{item.service_name}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <Badge
                        variant={
                          cp.remaining_uses === 0 ? "destructive" : cp.remaining_uses <= 1 ? "secondary" : "default"
                        }
                      >
                        {cp.remaining_uses} left
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {formatDateMY(cp.purchased_at)}
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {cp.expiry_date ? formatDateMY(cp.expiry_date) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={isExpired ? "destructive" : "default"}>
                      {isExpired ? "Expired" : "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleOpenHistory(cp)}
                    >
                      View History
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        disabled={(
                          cp.package?.package_type === 'credit'
                            ? (cp.remaining_credits ?? 0) <= 0
                            : cp.remaining_uses <= 0
                        ) || Boolean(isExpired)}
                        onClick={() => setDeductTarget(cp)}
                      >
                        Deduct Use
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="destructive"
                        aria-label="Delete package"
                        disabled={deletingPackageId === cp.id}
                        onClick={() => void handleDeleteCustomerPackage(cp)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="bg-white rounded-lg border mt-6">
        <details>
          <summary className="cursor-pointer list-none p-4 border-b font-semibold flex items-center justify-between">
            <span>Completed Packages ({completedCustomerPackages.length})</span>
            <ChevronDownIcon className="size-4 text-gray-500" />
          </summary>
          <div className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Package ID</TableHead>
                  <TableHead>Package ID</TableHead>
                  <TableHead className="whitespace-normal break-words max-w-[220px]">Package Name</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead>Completed Date</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Use History</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedCustomerPackages.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-gray-400 py-8">
                      No completed packages for this customer.
                    </TableCell>
                  </TableRow>
                )}
                {completedCustomerPackages.map((cp) => {
                  const isExpired = !cp.expiry_date || todayLocal >= cp.expiry_date;
                  return (
                    <TableRow key={cp.id}>
                      <TableCell>
                        <button
                          type="button"
                          className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                          onClick={() => void handleOpenHistory(cp)}
                        >
                          {cp.id.slice(0, 8).toUpperCase()}
                        </button>
                        <button
                          className="ml-2 text-xs text-blue-500 hover:underline"
                          onClick={() => {
                            navigator.clipboard.writeText(cp.id);
                          }}
                        >
                          Copy
                        </button>
                      </TableCell>
                      <TableCell>
                        {cp.package?.package_code ? (
                          <code className="text-xs bg-blue-50 px-2 py-1 rounded font-semibold">
                            {String(cp.package.package_code).padStart(3, "0")}
                          </code>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="font-medium whitespace-normal break-words max-w-[220px]">{cp.package?.name ?? "—"}</TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {formatDateMY(cp.purchased_at)}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {cp.completed_at ? formatDateMY(cp.completed_at) : "—"}
                      </TableCell>
                      <TableCell className="text-gray-500 text-sm">
                        {cp.expiry_date ? formatDateMY(cp.expiry_date) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={isExpired ? "destructive" : "secondary"}>
                          Completed
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleOpenHistory(cp)}
                        >
                          View History
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon-sm"
                          variant="destructive"
                          aria-label="Delete package"
                          disabled={deletingPackageId === cp.id}
                          onClick={() => void handleDeleteCustomerPackage(cp)}
                        >
                          <Trash2Icon />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </details>
      </div>

      <div className="bg-white rounded-lg border mt-6">
        <details>
          <summary className="cursor-pointer list-none p-4 border-b font-semibold flex items-center justify-between">
            <span>Archived Packages ({archivedCustomerPackages.length})</span>
            <ChevronDownIcon className="size-4 text-gray-500" />
          </summary>
          <div className="p-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer Package ID</TableHead>
                  <TableHead>Package ID</TableHead>
                  <TableHead className="whitespace-normal break-words max-w-[220px]">Package Name</TableHead>
                  <TableHead>Remaining Uses</TableHead>
                  <TableHead>Purchased At</TableHead>
                  <TableHead>Deleted At</TableHead>
                  <TableHead>Retention Days</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivedCustomerPackages.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-gray-400 py-8">
                      No archived packages for this customer.
                    </TableCell>
                  </TableRow>
                )}
                {archivedCustomerPackages.map((cp) => (
                  <TableRow key={cp.id}>
                    <TableCell className="font-mono text-xs">
                      {cp.original_customer_package_id.slice(0, 8).toUpperCase()}
                    </TableCell>
                    <TableCell>
                      {cp.package_code ? String(cp.package_code).padStart(3, "0") : "-"}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words max-w-[220px]">{cp.package_name}</TableCell>
                    <TableCell>{cp.remaining_uses}</TableCell>
                    <TableCell>{formatDateMY(cp.purchased_at)}</TableCell>
                    <TableCell>{formatDateTimeMY(cp.deleted_at)}</TableCell>
                    <TableCell>
                      {Math.max(
                        0,
                        Math.ceil(
                          (new Date(cp.deleted_at).getTime() + 365 * 24 * 60 * 60 * 1000 - Date.now()) /
                            (24 * 60 * 60 * 1000)
                        )
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={restoringArchivedPackageId === cp.id || deletingArchivedPackageId === cp.id}
                          onClick={() => void handleRestoreArchivedPackage(cp)}
                        >
                          {restoringArchivedPackageId === cp.id ? "Restoring..." : "Restore"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={restoringArchivedPackageId === cp.id || deletingArchivedPackageId === cp.id}
                          onClick={() => void handlePermanentlyDeleteArchivedPackage(cp)}
                        >
                          {deletingArchivedPackageId === cp.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>
      </div>

      <DeductUseDialog
        open={!!deductTarget}
        onClose={handleDeductClose}
        customerPackage={deductTarget}
      />
      <Dialog open={!!historyTarget} onOpenChange={(v) => { if (!v) handleCloseHistory(); }}>
        <DialogContent className="w-[min(50dvw,calc(100dvw-2rem))] max-w-none">
          <DialogHeader>
            <DialogTitle>Use History</DialogTitle>
            <DialogDescription className="whitespace-normal break-all">
              {historyTarget
                ? `Package ${historyTarget.id.slice(0, 8).toUpperCase()} - ${historyTarget.package?.name ?? "Package"}`
                : "View date/time and notes for each usage."}
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Used Date & Time</TableHead>
                <TableHead className="whitespace-normal break-words">Service</TableHead>
                <TableHead className="whitespace-normal break-words max-w-[280px]">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingHistory && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-gray-400 py-8">
                    Loading usage history...
                  </TableCell>
                </TableRow>
              )}
              {!loadingHistory && historyLogs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={2} className="text-center text-gray-400 py-8">
                    No usage history yet for this package.
                  </TableCell>
                </TableRow>
              )}
              {!loadingHistory && (() => {
                // Group logs by exact used_at timestamp (same deduction session)
                const groups: {
                  used_at: string;
                  serviceItems: { name: string; price: number | null }[];
                  legacyCredits: number | null;
                  cashTopup: number | null;
                  notes: string;
                }[] = [];
                for (const log of historyLogs) {
                  const existing = groups.find((g) => g.used_at === log.used_at);
                  if (existing) {
                    if (log.service_name && !existing.serviceItems.some((s) => s.name === log.service_name)) {
                      existing.serviceItems.push({ name: log.service_name, price: log.credits_used ?? null });
                    }
                    if (log.cash_topup != null && existing.cashTopup == null) {
                      existing.cashTopup = log.cash_topup;
                    }
                  } else {
                    groups.push({
                      used_at: log.used_at,
                      serviceItems: log.service_name
                        ? [{ name: log.service_name, price: log.credits_used ?? null }]
                        : [],
                      legacyCredits: !log.service_name && log.credits_used != null ? log.credits_used : null,
                      cashTopup: log.cash_topup ?? null,
                      notes: log.notes?.trim() ?? "",
                    });
                  }
                }
                return groups.map((group, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm text-gray-700">
                      {formatDateTimeMY(group.used_at)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700 whitespace-normal break-words">
                      {group.serviceItems.length > 0
                        ? <div className="flex flex-col gap-0.5">
                            {group.serviceItems.map((s, j) => (
                              <span key={j}>{s.price != null ? `${s.name}: ${s.price}` : s.name}</span>
                            ))}
                            {group.cashTopup != null && group.cashTopup > 0 && (
                              <span className="text-amber-700 font-medium">Cash top-up: {group.cashTopup}</span>
                            )}
                          </div>
                        : group.legacyCredits != null
                        ? `${group.legacyCredits} credits`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700 whitespace-normal break-words max-w-[280px]">
                      {group.notes || "-"}
                    </TableCell>
                  </TableRow>
                ));
              })()}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
      <SellPackageDialog
        open={sellOpen}
        onClose={handleSellClose}
        packages={allPackages}
        customers={[customer]}
        defaultCustomerId={customer.id}
      />
      <CustomerFormDialog
        open={editCustomerOpen}
        onClose={handleEditCustomerClose}
        editingCustomer={customer}
      />
    </div>
  );
}
