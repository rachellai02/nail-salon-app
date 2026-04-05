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
};

export function CustomerFormDialog({ open, onClose, onSuccess, onCreated, editingCustomer }: Props) {
  const [loading, setLoading] = useState(false);
  const isEditing = !!editingCustomer;
  const nameTextareaRef = useRef<HTMLTextAreaElement | null>(null);

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
    } else {
      reset({
        name: "",
        contact_number: "",
        birthday: "",
      });
    }

  }, [editingCustomer, reset]);

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
        });
        toast.success("Customer updated successfully!");
      } else {
        const newCustomer = await createCustomer({
          ...data,
          birthday: data.birthday?.trim() ? data.birthday : undefined,
        });
        toast.success("Customer registered successfully!");
        onCreated?.(newCustomer);
      }
      reset();
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { reset(); onClose(); } }}>
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
