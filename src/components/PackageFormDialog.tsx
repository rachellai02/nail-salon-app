"use client";

import { useState } from "react";
import { useForm, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { createPackage, updatePackage } from "@/lib/actions";
import { Package } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const schema = z.object({
  name: z.string().min(1, "Package name is required"),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

type ServiceItem = { service_name: string; total_uses: number };

type Props = {
  open: boolean;
  onClose: () => void;
  editingPackage?: Package | null;
};

export function PackageFormDialog({ open, onClose, editingPackage }: Props) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ServiceItem[]>(() => {
    if (editingPackage?.items && editingPackage.items.length > 0) {
      return editingPackage.items.map((i) => ({ service_name: i.service_name, total_uses: i.total_uses }));
    }
    return [{ service_name: "", total_uses: 1 }];
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    values: editingPackage
      ? {
          name: editingPackage.name,
          price: editingPackage.price,
          description: editingPackage.description ?? "",
        }
      : undefined,
  });

  function addItem() {
    setItems((prev) => [...prev, { service_name: "", total_uses: 1 }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof ServiceItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  async function onSubmit(data: FormValues) {
    const validItems = items.filter((i) => i.service_name.trim() !== "");
    if (validItems.length === 0) {
      toast.error("Add at least one service item");
      return;
    }
    for (const item of validItems) {
      if (item.total_uses < 1) {
        toast.error("Each service item must have at least 1 use");
        return;
      }
    }
    setLoading(true);
    try {
      if (editingPackage) {
        await updatePackage(editingPackage.id, {
          name: data.name,
          price: data.price,
          description: data.description,
          items: validItems,
        });
        toast.success("Package updated successfully");
      } else {
        await createPackage({ ...data, items: validItems });
        toast.success("Package created successfully");
      }
      reset();
      setItems([{ service_name: "", total_uses: 1 }]);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    reset();
    setItems(
      editingPackage?.items && editingPackage.items.length > 0
        ? editingPackage.items.map((i) => ({ service_name: i.service_name, total_uses: i.total_uses }))
        : [{ service_name: "", total_uses: 1 }]
    );
    onClose();
  }

  const totalUses = items.filter((i) => i.service_name.trim()).reduce((s, i) => s + (i.total_uses || 0), 0);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="w-[min(560px,calc(100dvw-2rem))] max-w-none overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{editingPackage ? "Edit Package" : "Create New Package"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Package Name</Label>
            <Input id="name" placeholder="e.g. Premium Nail Package" {...register("name")} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="price">Price (RM)</Label>
            <Input id="price" type="number" min={0} step="0.01" placeholder="e.g. 180.00" {...register("price")} />
            {errors.price && <p className="text-xs text-red-500">{errors.price.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Description (optional)</Label>
            <Input id="description" placeholder="e.g. Includes gel top coat" {...register("description")} />
          </div>

          {/* Service items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Service Items</Label>
              {totalUses > 0 && (
                <span className="text-xs text-gray-500">{totalUses} total uses</span>
              )}
            </div>
            {editingPackage && (
              <p className="text-xs text-amber-600">Note: changes to items only affect new sales, not existing customer packages.</p>
            )}
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    placeholder="Service name (e.g. Gel Manicure)"
                    value={item.service_name}
                    onChange={(e) => updateItem(idx, "service_name", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={item.total_uses}
                    onChange={(e) => updateItem(idx, "total_uses", parseInt(e.target.value) || 1)}
                    className="w-20 text-center"
                    title="Number of uses"
                  />
                  <span className="text-xs text-gray-400 whitespace-nowrap">uses</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeItem(idx)}
                    disabled={items.length === 1}
                    className="text-gray-400 hover:text-red-500 flex-shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Service Item
            </Button>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : editingPackage ? "Save Changes" : "Create Package"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
