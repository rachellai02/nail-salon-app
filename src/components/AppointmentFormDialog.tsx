"use client";

import { useState } from "react";
import { useForm, Controller, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarIcon, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  createAppointment,
  updateAppointment,
  deleteAppointment,
} from "@/lib/actions";
import { Appointment } from "@/lib/types";
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
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ─── Time helpers ─────────────────────────────────────────────
function addOneHour(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const total  = Math.min(h * 60 + m + 60, 24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// ─── Schema ───────────────────────────────────────────────────
const schema = z
  .object({
    customer_name:  z.string().min(1, "Customer name is required"),
    contact_number: z
      .string()
      .regex(/^\+\d{4,15}$/, "Please enter a complete phone number"),
    service:        z.string().min(1, "Service is required"),
    num_persons:    z.coerce.number().int().min(1, "At least 1 person").default(1),
    start_time:     z.string().min(1, "Start time is required"),
    end_time:       z.string().min(1, "End time is required"),
    notes:          z.string().optional(),
    has_package:    z.boolean().default(false),
    status: z
      .enum(["confirmed", "completed", "cancelled"])
      .default("confirmed"),
  })
  .refine((d) => d.end_time > d.start_time, {
    message: "End time must be after start time",
    path: ["end_time"],
  });

type FormValues = z.infer<typeof schema>;

// ─── Props ────────────────────────────────────────────────────
type Props = {
  open: boolean;
  onClose: () => void;
  defaultDate?: Date;
  defaultStartTime?: string;
  editingAppointment?: Appointment;
};

// ─── Component ────────────────────────────────────────────────
export function AppointmentFormDialog({
  open,
  onClose,
  defaultDate,
  defaultStartTime,
  editingAppointment,
}: Props) {
  const isEditing = !!editingAppointment;

  const [date, setDate] = useState<Date>(
    editingAppointment
      ? new Date(editingAppointment.appointment_date + "T00:00:00")
      : (defaultDate ?? new Date())
  );
  const [loading,  setLoading]  = useState(false);
  const [deleting, setDeleting] = useState(false);

  const defaultStart = editingAppointment
    ? editingAppointment.start_time.slice(0, 5)
    : (defaultStartTime ?? "10:00");

  const defaultEnd = editingAppointment
    ? editingAppointment.end_time.slice(0, 5)
    : addOneHour(defaultStart);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      customer_name:  editingAppointment?.customer_name  ?? "",
      contact_number: editingAppointment?.contact_number ?? "",
      service:        editingAppointment?.service        ?? "",
      num_persons:    editingAppointment?.num_persons     ?? 1,
      start_time:     defaultStart,
      end_time:       defaultEnd,
      notes:          editingAppointment?.notes          ?? "",
      has_package:    editingAppointment?.has_package    ?? false,
      status:         editingAppointment?.status         ?? "confirmed",
    },
  });

  async function onSubmit(data: FormValues) {
    setLoading(true);
    try {
      const payload = {
        ...data,
        appointment_date: format(date, "yyyy-MM-dd"),
        contact_number: data.contact_number.trim() || null,
        notes:          data.notes?.trim()         || null,
      };
      if (isEditing) {
        await updateAppointment(editingAppointment.id, payload);
        toast.success("Appointment updated");
      } else {
        await createAppointment(payload);
        toast.success("Appointment added!");
      }
      reset();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!editingAppointment) return;
    setDeleting(true);
    try {
      await deleteAppointment(editingAppointment.id);
      toast.success("Appointment deleted");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md flex flex-col max-h-[90dvh]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Appointment" : "New Appointment"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1 overflow-y-auto pr-1">

          {/* Date picker */}
          <div className="space-y-1">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger
                className={cn(
                  "inline-flex w-full items-center justify-start rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 opacity-60" />
                {date ? format(date, "EEEE, d MMMM yyyy") : "Pick a date"}
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  captionLayout="dropdown"
                  startMonth={new Date(new Date().getFullYear() - 1, 0)}
                  endMonth={new Date(new Date().getFullYear() + 3, 11)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Start + End time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                type="time"
                {...register("start_time")}
              />
              {errors.start_time && (
                <p className="text-xs text-red-500">{errors.start_time.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="end_time">End Time</Label>
              <Input
                id="end_time"
                type="time"
                {...register("end_time")}
              />
              {errors.end_time && (
                <p className="text-xs text-red-500">{errors.end_time.message}</p>
              )}
            </div>
          </div>

          {/* Customer name */}
          <div className="space-y-1">
            <Label htmlFor="customer_name">Customer Name</Label>
            <textarea
              id="customer_name"
              rows={1}
              placeholder="e.g. Sarah Lim"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none overflow-hidden"
              onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
              {...register("customer_name")}
            />
            {errors.customer_name && (
              <p className="text-xs text-red-500">{errors.customer_name.message}</p>
            )}
          </div>

          {/* Contact */}
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
            {errors.contact_number && (
              <p className="text-xs text-red-500">{errors.contact_number.message}</p>
            )}
          </div>

          {/* Service + Persons */}
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="space-y-1">
              <Label htmlFor="service">Service</Label>
              <textarea
                id="service"
                rows={1}
                placeholder="e.g. Manicure + Gel Polish"
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none overflow-hidden"
                onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
                {...register("service")}
              />
              {errors.service && (
                <p className="text-xs text-red-500">{errors.service.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label>Persons</Label>
              <Select
                defaultValue={String(editingAppointment?.num_persons ?? 1)}
                onValueChange={(v) => setValue("num_persons", Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-48 overflow-y-auto">
                  {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.num_persons && (
                <p className="text-xs text-red-500">{errors.num_persons.message}</p>
              )}
            </div>
          </div>

          {/* Status — only shown when editing */}
          {isEditing && (
            <div className="space-y-1">
              <Label>Status</Label>
              <Select
                defaultValue={watch("status")}
                onValueChange={(v) =>
                  setValue("status", v as FormValues["status"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirmed">✅ Confirmed</SelectItem>
                  <SelectItem value="completed">🟢 Completed</SelectItem>
                  <SelectItem value="cancelled">⛔ Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Package */}
          <div className="space-y-1">
            <Label>Package</Label>
            <div className="flex items-center gap-2 rounded-md border border-input px-3 py-2">
              <input
                id="has_package"
                type="checkbox"
                className="h-4 w-4 accent-primary cursor-pointer"
                {...register("has_package")}
              />
              <label htmlFor="has_package" className="text-sm cursor-pointer select-none">
                Customer has a package
              </label>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <Label htmlFor="notes">Notes (optional)</Label>
            <textarea
              id="notes"
              rows={1}
              placeholder="e.g. Prefers no acetone"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none overflow-hidden"
              onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
              {...register("notes")}
            />
          </div>

        </form>

        <DialogFooter className="pt-2 gap-2 flex-shrink-0">
            {isEditing && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)} disabled={loading}>
              {loading
                ? "Saving…"
                : isEditing
                ? "Save Changes"
                : "Add Appointment"}
            </Button>
          </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
