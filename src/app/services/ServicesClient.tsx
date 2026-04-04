"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
  createService,
  updateService,
  deleteService,
  reorderServiceCategories,
  reorderServices,
} from "@/lib/actions";
import { ChevronUp, ChevronDown } from "lucide-react";
import { ServiceCategory, Service } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type Props = {
  initialCategories: ServiceCategory[];
};

export default function ServicesClient({ initialCategories }: Props) {
  const [categories, setCategories] = useState<ServiceCategory[]>(initialCategories);

  // Category dialog state
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ServiceCategory | null>(null);
  const [catName, setCatName] = useState("");
  const [catLoading, setCatLoading] = useState(false);

  // Service dialog state
  const [svcDialogOpen, setSvcDialogOpen] = useState(false);
  const [editingSvc, setEditingSvc] = useState<Service | null>(null);
  const [svcCategoryId, setSvcCategoryId] = useState("");
  const [svcName, setSvcName] = useState("");
  const [svcPrice, setSvcPrice] = useState("");
  const [svcLoading, setSvcLoading] = useState(false);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<
    { type: "category"; item: ServiceCategory } | { type: "service"; item: Service } | null
  >(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Reorder mode
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderSaving, setReorderSaving] = useState(false);

  // ---- Category dialog ----
  function openCreateCat() {
    setEditingCat(null);
    setCatName("");
    setCatDialogOpen(true);
  }

  function openEditCat(cat: ServiceCategory) {
    setEditingCat(cat);
    setCatName(cat.name);
    setCatDialogOpen(true);
  }

  async function handleSaveCat() {
    if (!catName.trim()) return;
    setCatLoading(true);
    try {
      if (editingCat) {
        await updateServiceCategory(editingCat.id, catName);
        setCategories((prev) =>
          prev.map((c) => (c.id === editingCat.id ? { ...c, name: catName.trim() } : c))
        );
        toast.success("Category updated.");
      } else {
        const created = await createServiceCategory(catName);
        setCategories((prev) => [...prev, { ...created, services: [] }]);
        toast.success("Category added.");
      }
      setCatDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save category");
    } finally {
      setCatLoading(false);
    }
  }

  // ---- Service dialog ----
  function openCreateSvc(categoryId: string) {
    setEditingSvc(null);
    setSvcCategoryId(categoryId);
    setSvcName("");
    setSvcPrice("");
    setSvcDialogOpen(true);
  }

  function openEditSvc(svc: Service) {
    setEditingSvc(svc);
    setSvcCategoryId(svc.category_id);
    setSvcName(svc.name);
    setSvcPrice(svc.price != null ? String(svc.price) : "");
    setSvcDialogOpen(true);
  }

  async function handleSaveSvc() {
    if (!svcName.trim()) return;
    const price = svcPrice !== "" ? parseFloat(svcPrice) : null;
    setSvcLoading(true);
    try {
      if (editingSvc) {
        await updateService(editingSvc.id, { name: svcName, price });
        setCategories((prev) =>
          prev.map((c) => ({
            ...c,
            services: (c.services ?? []).map((s) =>
              s.id === editingSvc.id ? { ...s, name: svcName.trim(), price } : s
            ),
          }))
        );
        toast.success("Service updated.");
      } else {
        const created = await createService({ category_id: svcCategoryId, name: svcName, price });
        setCategories((prev) =>
          prev.map((c) =>
            c.id === svcCategoryId
              ? { ...c, services: [...(c.services ?? []), created] }
              : c
          )
        );
        toast.success("Service added.");
      }
      setSvcDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save service");
    } finally {
      setSvcLoading(false);
    }
  }

  // ---- Reorder ----
  function moveCat(idx: number, dir: -1 | 1) {
    setCategories((prev) => {
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  function moveSvc(catId: string, idx: number, dir: -1 | 1) {
    setCategories((prev) =>
      prev.map((c) => {
        if (c.id !== catId) return c;
        const svcs = [...(c.services ?? [])];
        const swap = idx + dir;
        if (swap < 0 || swap >= svcs.length) return c;
        [svcs[idx], svcs[swap]] = [svcs[swap], svcs[idx]];
        return { ...c, services: svcs };
      })
    );
  }

  async function saveReorder() {
    setReorderSaving(true);
    try {
      await reorderServiceCategories(categories.map((c) => c.id));
      for (const cat of categories) {
        if ((cat.services ?? []).length > 0) {
          await reorderServices((cat.services ?? []).map((s) => s.id));
        }
      }
      toast.success("Order saved.");
      setReorderMode(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save order");
    } finally {
      setReorderSaving(false);
    }
  }

  // ---- Delete ----
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      if (deleteTarget.type === "category") {
        await deleteServiceCategory(deleteTarget.item.id);
        setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.item.id));
        toast.success("Category deleted.");
      } else {
        await deleteService(deleteTarget.item.id);
        setCategories((prev) =>
          prev.map((c) => ({
            ...c,
            services: (c.services ?? []).filter((s) => s.id !== deleteTarget.item.id),
          }))
        );
        toast.success("Service deleted.");
      }
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Services</h1>
        <div className="flex gap-2">
          {reorderMode ? (
            <>
              <Button variant="outline" onClick={() => setReorderMode(false)} disabled={reorderSaving}>
                Cancel
              </Button>
              <Button onClick={saveReorder} disabled={reorderSaving}>
                {reorderSaving ? "Saving..." : "Save Order"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setReorderMode(true)}>Reorder</Button>
              <Button onClick={openCreateCat}>+ Add Category</Button>
            </>
          )}
        </div>
      </div>

      {categories.length === 0 && (
        <p className="text-gray-500 text-sm">No categories yet. Add one to get started.</p>
      )}

      {categories.map((cat, catIdx) => (
        <div key={cat.id} className="border rounded-lg overflow-hidden">
          {/* Category header */}
          <div className="flex items-center justify-between bg-gray-50 px-4 py-3 border-b">
            <div className="flex items-center gap-2">
              {reorderMode && (
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={() => moveCat(catIdx, -1)}
                    disabled={catIdx === 0}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCat(catIdx, 1)}
                    disabled={catIdx === categories.length - 1}
                    className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              )}
              <h2 className="font-semibold text-base">{cat.name}</h2>
            </div>
            {!reorderMode && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openCreateSvc(cat.id)}>
                  + Add Service
                </Button>
                <Button size="sm" variant="outline" onClick={() => openEditCat(cat)}>
                  Rename
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:text-red-700 hover:border-red-300"
                  onClick={() => setDeleteTarget({ type: "category", item: cat })}
                >
                  Delete
                </Button>
              </div>
            )}
          </div>

          {/* Services table */}
          <Table className="[&_th]:px-4 [&_td]:px-4 table-fixed w-full">
            <colgroup>
              {reorderMode && <col className="w-10" />}
              <col className="w-75" />
              <col className="w-40" />
              {!reorderMode && <col className="w-32" />}
            </colgroup>
            <TableHeader>
              <TableRow>
                {reorderMode && <TableHead className="w-10"></TableHead>}
                <TableHead className="font-bold">Service</TableHead>
                <TableHead className="font-bold">Price</TableHead>
                {!reorderMode && <TableHead className="w-24"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(cat.services ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={reorderMode ? 3 : 3} className="text-gray-400 text-sm py-4 text-center">
                    No services yet.
                  </TableCell>
                </TableRow>
              ) : (
                (cat.services ?? []).map((svc, svcIdx) => (
                  <TableRow key={svc.id}>
                    {reorderMode && (
                      <TableCell className="w-10">
                        <div className="flex flex-col">
                          <button
                            type="button"
                            onClick={() => moveSvc(cat.id, svcIdx, -1)}
                            disabled={svcIdx === 0}
                            className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none"
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveSvc(cat.id, svcIdx, 1)}
                            disabled={svcIdx === (cat.services ?? []).length - 1}
                            className="text-gray-400 hover:text-gray-700 disabled:opacity-20 leading-none"
                          >
                            <ChevronDown size={16} />
                          </button>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-sm">{svc.name}</TableCell>
                    <TableCell className="text-sm">
                      {svc.price != null ? svc.price.toFixed(2) : <span className="text-gray-400 text-xs">N/A</span>}
                    </TableCell>
                    {!reorderMode && (
                      <TableCell>
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="outline" onClick={() => openEditSvc(svc)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:border-red-300"
                            onClick={() => setDeleteTarget({ type: "service", item: svc })}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ))}

      {/* Category dialog */}
      <Dialog open={catDialogOpen} onOpenChange={(v) => { if (!v) setCatDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCat ? "Rename Category" : "Add Category"}</DialogTitle>
            <DialogDescription>Enter a name for the service category.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cat-name">Category Name <span className="text-red-500">*</span></Label>
            <Input
              id="cat-name"
              placeholder="e.g. Classic"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void handleSaveCat(); }}
            />
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCat} disabled={catLoading || !catName.trim()}>
              {catLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Service dialog */}
      <Dialog open={svcDialogOpen} onOpenChange={(v) => { if (!v) setSvcDialogOpen(false); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingSvc ? "Edit Service" : "Add Service"}</DialogTitle>
            <DialogDescription>
              {editingSvc ? "Update service details." : `Add a service to "${categories.find((c) => c.id === svcCategoryId)?.name ?? ""}".`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="svc-name">Service Name <span className="text-red-500">*</span></Label>
              <Input
                id="svc-name"
                placeholder="e.g. Gel Manicure"
                value={svcName}
                onChange={(e) => setSvcName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="svc-price">Price <span className="text-gray-400 font-normal text-xs">(leave empty to set at payment)</span></Label>
              <Input
                id="svc-price"
                type="number"
                min={0}
                step="0.01"
                placeholder="Leave empty if varies"
                value={svcPrice}
                onChange={(e) => setSvcPrice(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setSvcDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSvc} disabled={svcLoading || !svcName.trim()}>
              {svcLoading ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === "category"
                ? `Delete category "${deleteTarget.item.name}" and all its services? This cannot be undone.`
                : `Delete service "${deleteTarget?.item.name}"? This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
              {deleteLoading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
