"use client";

import { useState } from "react";
import { useForm, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
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
  total_uses: z.coerce.number().int().min(1, "Must be at least 1 use"),
  price: z.coerce.number().min(0, "Price must be 0 or more"),
  description: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
  editingPackage?: Package | null;
};

export function PackageFormDialog({ open, onClose, editingPackage }: Props) {
  const [loading, setLoading] = useState(false);

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
          total_uses: editingPackage.total_uses,
          price: editingPackage.price,
          description: editingPackage.description ?? "",
        }
      : undefined,
  });

  async function onSubmit(data: FormValues) {
    setLoading(true);
    try {
      if (editingPackage) {
        await updatePackage(editingPackage.id, data);
        toast.success("Package updated successfully");
      } else {
        await createPackage(data);
        toast.success("Package created successfully");
      }
      reset();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingPackage ? "Edit Package" : "Create New Package"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Package Name</Label>
            <Input id="name" placeholder="e.g. Manicure 5x Package" {...register("name")} />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="total_uses">Number of Uses</Label>
            <Input id="total_uses" type="number" min={1} placeholder="e.g. 5" {...register("total_uses")} />
            {errors.total_uses && <p className="text-xs text-red-500">{errors.total_uses.message}</p>}
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : editingPackage ? "Save Changes" : "Create Package"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
