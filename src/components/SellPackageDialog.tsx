"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createCustomerPackage } from "@/lib/actions";
import { Package, Customer } from "@/lib/types";
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
import { CustomerFormDialog } from "@/components/CustomerFormDialog";

const schema = z.object({
  package_id: z.string().min(1, "Please select a package"),
  customer_id: z.string().min(1, "Please select a customer"),
  expiry_years: z.string().min(1, "Please select expiry duration"),
});
type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
  packages: Package[];
  customers: Customer[];
  defaultCustomerId?: string;
};

const wrappingSelectTriggerClass =
  "w-full !h-auto min-h-[40px] py-2 !items-start !whitespace-normal data-[size=default]:h-auto [&_[data-slot=select-value]]:line-clamp-none [&_[data-slot=select-value]]:items-start [&_[data-slot=select-value]]:min-w-0";
const wrappingSelectValueClass = "!line-clamp-none !whitespace-normal !items-start !min-w-0";

export function SellPackageDialog({ open, onClose, packages, customers, defaultCustomerId }: Props) {
  const [loading, setLoading] = useState(false);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");
  const [selectedExpiryYears, setSelectedExpiryYears] = useState<string>("");
  const activePackages = packages.filter((p) => p.is_active);
  
  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);
  const selectedPackage = activePackages.find(p => p.id === selectedPackageId);

  const {
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  // Set default customer when dialog opens
  useEffect(() => {
    if (open && defaultCustomerId) {
      setSelectedCustomerId(defaultCustomerId);
      setValue("customer_id", defaultCustomerId);
    }
  }, [open, defaultCustomerId, setValue]);

  async function onSubmit(data: FormValues) {
    setLoading(true);
    try {
      // Calculate expiry date based on selected years
      const now = new Date();
      const years = parseInt(data.expiry_years, 10);
      const expiryDate = new Date(now);
      expiryDate.setFullYear(now.getFullYear() + years);
      const expiry_date = expiryDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD

      await createCustomerPackage({
        package_id: data.package_id,
        customer_id: data.customer_id,
        expiry_date,
      });
      toast.success("Package sold and recorded successfully!");
      reset();
      setSelectedCustomerId("");
      setSelectedPackageId("");
      setSelectedExpiryYears("");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleCustomerCreated() {
    setCustomerDialogOpen(false);
    // Refresh the page to get updated customer list
    window.location.reload();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); setSelectedCustomerId(""); setSelectedPackageId(""); setSelectedExpiryYears(""); onClose(); } }}>
        <DialogContent className="sm:max-w-lg px-5">
          <DialogHeader>
            <DialogTitle>Sell Package to Customer</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <Label>Customer</Label>
              <div className="w-full">
                <Select 
                  value={selectedCustomerId} 
                  onValueChange={(val) => {
                    if (val) {
                      setSelectedCustomerId(val);
                      setValue("customer_id", val);
                    }
                  }}
                >
                  <SelectTrigger className={wrappingSelectTriggerClass}>
                    <SelectValue className={wrappingSelectValueClass} placeholder="Select a customer...">
                      {selectedCustomer && (
                        <span className="block whitespace-normal break-all text-left">{selectedCustomer.name} — {selectedCustomer.contact_number}</span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem
                        key={customer.id}
                        value={customer.id}
                      >
                        {customer.name} - {customer.contact_number}
                      </SelectItem>
                    ))}
                    {customers.length === 0 && (
                      <div className="px-2 py-1 text-sm text-gray-500">No customers found.</div>
                    )}
                  </SelectContent>
                </Select>
              </div>
              {errors.customer_id && <p className="text-xs text-red-500">{errors.customer_id.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Package</Label>
              <Select 
                value={selectedPackageId}
                onValueChange={(val) => {
                  if (val) {
                    setSelectedPackageId(val);
                    setValue("package_id", val);
                  }
                }}
              >
                <SelectTrigger className={wrappingSelectTriggerClass}>
                  <SelectValue className={wrappingSelectValueClass} placeholder="Select a package...">
                    {selectedPackage && (
                        <span className="block whitespace-normal break-all text-left">{selectedPackage.name}</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {activePackages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      {pkg.name}
                    </SelectItem>
                  ))}
                  {activePackages.length === 0 && (
                    <div className="px-2 py-1 text-sm text-gray-500">No packages found.</div>
                  )}
                </SelectContent>
              </Select>
              {errors.package_id && <p className="text-xs text-red-500">{errors.package_id.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Expiry Duration</Label>
              <Select 
                value={selectedExpiryYears}
                onValueChange={(val) => {
                  if (val) {
                    setSelectedExpiryYears(val);
                    setValue("expiry_years", val);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select duration...">
                    {selectedExpiryYears && (
                      <span>{selectedExpiryYears} {selectedExpiryYears === "1" ? "Year" : "Years"}</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Year</SelectItem>
                  <SelectItem value="2">2 Years</SelectItem>
                  <SelectItem value="3">3 Years</SelectItem>
                  <SelectItem value="4">4 Years</SelectItem>
                  <SelectItem value="5">5 Years</SelectItem>
                </SelectContent>
              </Select>
              {errors.expiry_years && <p className="text-xs text-red-500">{errors.expiry_years.message}</p>}
            </div>
            <DialogFooter className="pt-4 pb-4 pl-0 pr-5 sm:pl-0 sm:pr-5">
              <Button type="button" variant="outline" onClick={() => { reset(); setSelectedCustomerId(""); setSelectedPackageId(""); setSelectedExpiryYears(""); onClose(); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Confirm Sale"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CustomerFormDialog
        open={customerDialogOpen}
        onClose={() => setCustomerDialogOpen(false)}
        onSuccess={handleCustomerCreated}
      />
    </>
  );
}
