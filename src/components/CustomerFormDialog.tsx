"use client";

import { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { createCustomer, updateCustomer } from "@/lib/actions";
import { Customer } from "@/lib/types";
import { PhoneInput } from "@/components/ui/phone-input";
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
  name: z.string().min(1, "Customer name is required"),
  contact_number: z
    .string()
    .regex(/^\+\d{4,15}$/, "Please enter a complete phone number"),
  birthday: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onCreated?: (customer: Customer) => void;
  editingCustomer?: Customer | null;
  initialPhone?: string;
  allCustomers?: Customer[];
};

export function CustomerFormDialog({ open, onClose, onSuccess, onCreated, editingCustomer, initialPhone, allCustomers }: Props) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!editingCustomer;
  const nameTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Referred-by state
  const [referredBySearch, setReferredBySearch] = useState("");
  const [referredByCustomer, setReferredByCustomer] = useState<Customer | null>(null);
  const [showReferralDropdown, setShowReferralDropdown] = useState(false);
  const referralRef = useRef<HTMLDivElement>(null);

  const referralResults = allCustomers
    ? allCustomers.filter((c) => {
        if (editingCustomer && c.id === editingCustomer.id) return false;
        if (!referredBySearch.trim()) return false;
        const term = referredBySearch.toLowerCase();
        return (
          c.name.toLowerCase().includes(term) ||
          c.customer_code.toLowerCase().includes(term) ||
          c.contact_number.includes(referredBySearch)
        );
      })
    : [];

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const nameField = register("name");
  const watchedName = watch("name");

  function resizeNameTextarea(element: HTMLTextAreaElement) {
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }

  function syncNameTextareaSize() {
    if (!nameTextareaRef.current) return;
    resizeNameTextarea(nameTextareaRef.current);
  }

  useEffect(() => {
    if (editingCustomer) {
      reset({
        name: editingCustomer.name,
        contact_number: editingCustomer.contact_number,
        birthday: editingCustomer.birthday || "",
      });
      // Resolve the referring customer if available
      if (editingCustomer.referred_by_customer_id && allCustomers) {
        const referrer = allCustomers.find((c) => c.id === editingCustomer.referred_by_customer_id);
        setReferredByCustomer(referrer ?? null);
        setReferredBySearch(referrer ? referrer.name : "");
      } else {
        setReferredByCustomer(null);
        setReferredBySearch("");
      }
    } else {
      reset({
        name: "",
        contact_number: initialPhone ?? "",
        birthday: "",
      });
      setReferredByCustomer(null);
      setReferredBySearch("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingCustomer, initialPhone, reset]);

  // Close referral dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (referralRef.current && !referralRef.current.contains(e.target as Node)) {
        setShowReferralDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!open || !nameTextareaRef.current) return;

    // Recalculate once right after value render, then once after dialog open animation/layout settles.
    const rafId = requestAnimationFrame(() => {
      syncNameTextareaSize();
    });
    const timeoutId = window.setTimeout(() => {
      syncNameTextareaSize();
    }, 140);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [open, watchedName]);

  async function onSubmit(data: FormValues) {
    setLoading(true);
    try {
      if (isEditing && editingCustomer) {
        await updateCustomer(editingCustomer.id, {
          ...data,
          birthday: data.birthday?.trim() ? data.birthday : undefined,
          referred_by_customer_id: referredByCustomer?.id ?? null,
        });
        toast.success("Customer updated successfully!");
      } else {
        const newCustomer = await createCustomer({
          ...data,
          birthday: data.birthday?.trim() ? data.birthday : undefined,
          referred_by_customer_id: referredByCustomer?.id ?? null,
        });
        toast.success("Customer registered successfully!");
        onCreated?.(newCustomer);
      }
      reset();
      setReferredByCustomer(null);
      setReferredBySearch("");
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); setReferredByCustomer(null); setReferredBySearch(""); onClose(); } }}>
      <DialogContent className="w-[min(50dvw,calc(100dvw-2rem))] max-w-none max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Customer" : "Register New Customer"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="name">Customer Name</Label>
            <textarea
              id="name"
              placeholder="e.g. Sarah Lim"
              rows={1}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm resize-none overflow-hidden"
              {...nameField}
              ref={(element) => {
                nameField.ref(element);
                nameTextareaRef.current = element;
                if (element) {
                  requestAnimationFrame(() => {
                    resizeNameTextarea(element);
                  });
                }
              }}
              onInput={(event) => {
                resizeNameTextarea(event.currentTarget);
              }}
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>Contact Number</Label>
            <Controller
              name="contact_number"
              control={control}
              render={({ field }) => (
                <PhoneInput
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            {errors.contact_number && <p className="text-xs text-red-500">{errors.contact_number.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="birthday">Birthday (optional)</Label>
            <Input id="birthday" type="date" {...register("birthday")} />
            {errors.birthday && <p className="text-xs text-red-500">{errors.birthday.message}</p>}
          </div>
          {allCustomers && (
            <div className="space-y-1" ref={referralRef}>
              <Label>Referred by (optional)</Label>
              {referredByCustomer ? (
                <div className="flex items-center justify-between border rounded-md px-3 py-2 bg-blue-50 text-sm">
                  <span className="font-medium">{referredByCustomer.name}</span>
                  <span className="text-gray-500 text-xs ml-2">{referredByCustomer.contact_number}</span>
                  <button
                    type="button"
                    className="ml-3 text-gray-400 hover:text-gray-600"
                    onClick={() => { setReferredByCustomer(null); setReferredBySearch(""); }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    placeholder="Search customer name, ID or phone..."
                    value={referredBySearch}
                    onChange={(e) => { setReferredBySearch(e.target.value); setShowReferralDropdown(true); }}
                    onFocus={() => setShowReferralDropdown(true)}
                  />
                  {showReferralDropdown && referralResults.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {referralResults.slice(0, 8).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setReferredByCustomer(c); setReferredBySearch(c.name); setShowReferralDropdown(false); }}
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="text-gray-400 ml-2">{c.contact_number}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { reset(); onClose(); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (isEditing ? "Updating..." : "Registering...") : (isEditing ? "Update Customer" : "Register Customer")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
