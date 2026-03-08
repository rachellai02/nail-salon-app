"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createCustomerPackage } from "@/lib/actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const schema = z.object({
  package_id: z.string().min(1, "Please select a package"),
  customer_name: z.string().min(1, "Customer name is required"),
  contact_number: z.string().min(1, "Contact number is required"),
  notes: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
  packages: Package[];
};

export function SellPackageDialog({ open, onClose, packages }: Props) {
  const [loading, setLoading] = useState(false);
  const activePackages = packages.filter((p) => p.is_active);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormValues) {
    setLoading(true);
    try {
      await createCustomerPackage(data);
      toast.success("Package sold and recorded successfully!");
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
          <DialogTitle>Sell Package to Customer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label>Package</Label>
            <Select onValueChange={(val) => setValue("package_id", val as string)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a package..." />
              </SelectTrigger>
              <SelectContent>
                {activePackages.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.name} — {pkg.total_uses}x — RM {Number(pkg.price).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.package_id && <p className="text-xs text-red-500">{errors.package_id.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="customer_name">Customer Name</Label>
            <Input id="customer_name" placeholder="e.g. Sarah Lim" {...register("customer_name")} />
            {errors.customer_name && <p className="text-xs text-red-500">{errors.customer_name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="contact_number">Contact Number</Label>
            <Input id="contact_number" placeholder="e.g. 012-3456789" {...register("contact_number")} />
            {errors.contact_number && <p className="text-xs text-red-500">{errors.contact_number.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" placeholder="Any additional notes" {...register("notes")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Confirm Sale"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
