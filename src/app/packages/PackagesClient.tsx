"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Package } from "@/lib/types";
import { updatePackage } from "@/lib/actions";
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
};

export default function PackagesClient({ initialPackages }: Props) {
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
            Manage the packages your salon offers (e.g. Manicure 5x)
          </p>
        </div>
        <Button onClick={openCreate}>+ New Package</Button>
      </div>

      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Package Name</TableHead>
              <TableHead>Uses</TableHead>
              <TableHead>Price (RM)</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-400 py-10">
                  No packages yet. Click &quot;+ New Package&quot; to create one.
                </TableCell>
              </TableRow>
            )}
            {packages.map((pkg) => (
              <TableRow key={pkg.id} className={!pkg.is_active ? "opacity-50" : ""}>
                <TableCell className="font-medium">{pkg.name}</TableCell>
                <TableCell>{pkg.total_uses}x</TableCell>
                <TableCell>RM {Number(pkg.price).toFixed(2)}</TableCell>
                <TableCell className="text-gray-500 text-sm">{pkg.description ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={pkg.is_active ? "default" : "secondary"}>
                    {pkg.is_active ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
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
      />
    </div>
  );
}
