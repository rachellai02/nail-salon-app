"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Package, Service } from "@/lib/types";
import { updatePackage, deletePackage } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PackageFormDialog } from "@/components/PackageFormDialog";

type Props = {
  initialPackages: Package[];
  services: Service[];
};

export default function PackagesClient({ initialPackages, services }: Props) {
  const [packages, setPackages] = useState<Package[]>(initialPackages);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Package | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(pkg: Package) {
    setEditing(pkg);
    setDialogOpen(true);
  }

  async function toggleActive(pkg: Package) {
    try {
      await updatePackage(pkg.id, { is_active: !pkg.is_active });
      setPackages((prev) =>
        prev.map((p) => (p.id === pkg.id ? { ...p, is_active: !p.is_active } : p))
      );
      toast.success(`Package ${pkg.is_active ? "deactivated" : "activated"}`);
    } catch {
      toast.error("Failed to update package status");
    }
  }

  async function handleDelete(pkg: Package) {
    if (!confirm(`Are you sure you want to delete "${pkg.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await deletePackage(pkg.id);
      setPackages((prev) => prev.filter((p) => p.id !== pkg.id));
      toast.success("Package deleted successfully");
    } catch {
      toast.error("Failed to delete package");
    }
  }

  function handleClose() {
    setDialogOpen(false);
    // Refresh by reloading (simple approach; can be improved with router.refresh())
    window.location.reload();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Package Types</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage the packages your salon offers.
          </p>
        </div>
        <Button onClick={openCreate}>+ New Package</Button>
      </div>

      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Package ID</TableHead>
              <TableHead className="whitespace-normal break-words max-w-[200px]">Package Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="whitespace-normal break-words max-w-[280px]">Services / Credits</TableHead>
              <TableHead>Price (RM)</TableHead>
              <TableHead className="whitespace-normal break-words max-w-[250px]">Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-400 py-10">
                  No packages yet. Click &quot;+ New Package&quot; to create one.
                </TableCell>
              </TableRow>
            )}
            {packages.map((pkg) => (
              <TableRow key={pkg.id} className={!pkg.is_active ? "opacity-50" : ""}>
                <TableCell className="text-gray-500 text-sm font-mono">{String(pkg.package_code).padStart(3, "0")}</TableCell>
                <TableCell className="font-medium whitespace-normal break-words max-w-[200px]">{pkg.name}</TableCell>
                <TableCell>
                  <Badge variant={pkg.package_type === 'credit' ? 'secondary' : 'default'} className="capitalize">
                    {pkg.package_type ?? 'services'}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-normal break-words max-w-[280px]">
                  {pkg.package_type === 'credit' ? (
                    <span className="text-sm text-gray-700">{pkg.total_credits} credits</span>
                  ) : pkg.items && pkg.items.length > 0 ? (
                    <ul className="space-y-0.5 text-sm">
                      {pkg.items.map((item) => (
                        <li key={item.id} className="text-gray-700">
                          <span className="font-medium">{item.total_uses}x</span> {item.service_name}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-gray-500 text-sm">{pkg.total_uses}x</span>
                  )}
                </TableCell>
                <TableCell>RM {Number(pkg.price).toFixed(2)}</TableCell>
                <TableCell className="text-gray-500 text-sm whitespace-normal break-words max-w-[250px]">{pkg.description ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={pkg.is_active ? "default" : "secondary"}>
                    {pkg.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="space-x-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(pkg)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant={pkg.is_active ? "destructive" : "outline"}
                    onClick={() => toggleActive(pkg)}
                  >
                    {pkg.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(pkg)}
                  >
                    Delete
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PackageFormDialog
        open={dialogOpen}
        onClose={handleClose}
        editingPackage={editing}
        services={services}
      />
    </div>
  );
}
