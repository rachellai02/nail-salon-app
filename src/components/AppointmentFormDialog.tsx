"use client";

import { useState, useEffect, useRef } from "react";
import { format, parse } from "date-fns";
import { useForm, Controller, Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarIcon, Search, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PhoneInput } from "@/components/ui/phone-input";
import {
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getCustomers,
  getPackagesByCustomerId,
  createCustomer,
} from "@/lib/actions";
import { Appointment, Customer } from "@/lib/types";
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

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [customerMode, setCustomerMode] = useState<"new" | "existing">("existing");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch customers once when the dialog opens
  useEffect(() => {
    if (!open) return;
    getCustomers().then(setCustomers).catch(() => {});
  }, [open]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredCustomers = customerSearch.trim() === ""
    ? []
    : customers
        .filter((c) => {
          const q = customerSearch.toLowerCase();
          return c.name.toLowerCase().includes(q) || c.contact_number.includes(q);
        })
        .slice(0, 8);

  async function handleSelectCustomer(c: Customer) {
    setSelectedCustomer(c);
    setValue("customer_name", c.name);
    setValue("contact_number", c.contact_number);
    setCustomerSearch(c.name);
    setShowDropdown(false);
    // Check if the customer has any active packages
    try {
      const pkgs = await getPackagesByCustomerId(c.id);
      const hasActive = pkgs.some(
        (p) => !p.completed_at && (
          p.package?.package_type === "credit"
            ? (p.remaining_credits ?? 0) > 0
            : p.remaining_uses > 0
        )
      );
      setValue("has_package", hasActive);
    } catch {
      // leave has_package unchanged if fetch fails
    }
  }

  const [date, setDate] = useState<Date>(
    editingAppointment
      ? new Date(editingAppointment.appointment_date + "T00:00:00")
      : (defaultDate ?? new Date())
  );
  const [loading,  setLoading]  = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sending,  setSending]  = useState(false);
  const [showReminderPrompt, setShowReminderPrompt] = useState(false);
  const [pendingReminder, setPendingReminder] = useState<{ phone: string; customerName: string; date: string; time: string; pax: number; appointmentId: string } | null>(null);

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
    formState: { errors, isDirty },
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
        if (payload.contact_number) {
          const apptDateObj = new Date(payload.appointment_date + "T00:00:00");
          setPendingReminder({
            phone: payload.contact_number,
            customerName: data.customer_name,
            date: format(apptDateObj, "EEEE, d MMMM yyyy"),
            time: format(parse(data.start_time.slice(0, 5), "HH:mm", new Date()), "h:mm a"),
            pax: data.num_persons,
            appointmentId: editingAppointment.id,
          });
          setShowReminderPrompt(true);
        } else {
          reset();
          onClose();
        }
        return;
      } else {
        // Register new customer in the database when in "new" mode
        if (customerMode === "new") {
          try {
            await createCustomer({
              name: data.customer_name,
              contact_number: data.contact_number,
            });
          } catch {
            // Ignore errors (e.g. duplicate) — appointment still proceeds
          }
        }
        const newApptId = await createAppointment(payload);
        toast.success("Appointment added!");

        // Send immediate reminder if the day-before 10AM window has already passed
        if (payload.contact_number) {
          const now = new Date();
          const apptDateObj = new Date(payload.appointment_date + "T00:00:00");
          const reminderDeadline = new Date(apptDateObj);
          reminderDeadline.setDate(reminderDeadline.getDate() - 1);
          reminderDeadline.setHours(10, 0, 0, 0);
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

          if (now >= reminderDeadline && apptDateObj >= todayStart) {
            try {
              const apptDate = format(apptDateObj, "EEEE, d MMMM yyyy");
              const apptTime = format(parse(data.start_time.slice(0, 5), "HH:mm", new Date()), "h:mm a");
              const res = await fetch("/api/send-reminder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  phone: payload.contact_number,
                  customerName: data.customer_name,
                  date: apptDate,
                  time: apptTime,
                  pax: data.num_persons,
                  appointmentId: newApptId,
                }),
              });
              if (res.ok) toast.success("Reminder sent via WhatsApp!");
            } catch { /* ignore reminder failure */ }
          }
        }
      }
      reset();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function sendPendingReminder() {
    if (!pendingReminder) return;
    setSending(true);
    try {
      const res = await fetch("/api/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingReminder),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to send");
      toast.success("Reminder sent via WhatsApp!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reminder");
    } finally {
      setSending(false);
      setShowReminderPrompt(false);
      setPendingReminder(null);
      reset();
      onClose();
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
    setCustomerSearch("");
    setShowDropdown(false);
    setCustomerMode("existing");
    setSelectedCustomer(null);
    onClose();
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="w-[80dvw] sm:w-[min(50dvw,calc(100dvw-2rem))] max-w-none flex flex-col max-h-[90dvh]">
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
          <div className="grid grid-cols-2 gap-3 min-w-0">
            <div className="space-y-1 min-w-0">
              <Label htmlFor="start_time">Start Time</Label>
              <Input
                id="start_time"
                type="time"
                className="w-full min-w-0"
                {...register("start_time", {
                  onChange: (e) => {
                    const newStart = e.target.value;
                    if (newStart) setValue("end_time", addOneHour(newStart));
                  },
                })}
              />
              {errors.start_time && (
                <p className="text-xs text-red-500">{errors.start_time.message}</p>
              )}
            </div>
            <div className="space-y-1 min-w-0">
              <Label htmlFor="end_time">End Time</Label>
              <Input
                id="end_time"
                type="time"
                className="w-full min-w-0"
                {...register("end_time")}
              />
              {errors.end_time && (
                <p className="text-xs text-red-500">{errors.end_time.message}</p>
              )}
            </div>
          </div>

          {/* Customer mode toggle */}
          {!isEditing && (
            <div className="flex rounded-lg border overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setCustomerMode("existing");
                  setSelectedCustomer(null);
                  setValue("customer_name", "");
                  setValue("contact_number", "");
                  setCustomerSearch("");
                }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${customerMode === "existing" ? "bg-blue-500 text-white" : "hover:bg-gray-50"}`}
              >
                Existing Customer
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomerMode("new");
                  setSelectedCustomer(null);
                  setValue("customer_name", "");
                  setValue("contact_number", "");
                  setValue("has_package", false);
                }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${customerMode === "new" ? "bg-blue-500 text-white" : "hover:bg-gray-50"}`}
              >
                New Customer
              </button>
            </div>
          )}

          {/* New customer: name + phone fields */}
          {(isEditing || customerMode === "new") && (
            <>
              <div className="space-y-1">
                <Label htmlFor="customer_name">Customer Name <span className="text-red-500">*</span></Label>
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
              <div className="space-y-1">
                <Label>Contact Number <span className="text-red-500">*</span></Label>
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
            </>
          )}

          {/* Existing customer: search */}
          {!isEditing && customerMode === "existing" && (
            <div className="space-y-1" ref={searchRef}>
              {!selectedCustomer ? (
                <>
                  <label className="text-sm font-medium leading-none">Search Customer</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search by name or phone…"
                      value={customerSearch}
                      onChange={(e) => { setCustomerSearch(e.target.value); setShowDropdown(true); }}
                      onFocus={() => { if (customerSearch.trim()) setShowDropdown(true); }}
                      className="flex w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                  {showDropdown && filteredCustomers.length > 0 && (
                    <div className="border rounded-md divide-y max-h-40 overflow-y-auto bg-white shadow-md z-50 relative">
                      {filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={() => void handleSelectCustomer(c)}
                          className="w-full text-left px-3 py-2 text-sm flex justify-between hover:bg-gray-50 transition-colors"
                        >
                          <span className="font-medium">{c.name}</span>
                          <span className="text-gray-400">{c.contact_number}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {errors.customer_name && (
                    <p className="text-xs text-red-500">Please select a customer</p>
                  )}
                </>
              ) : (
                <>
                  <label className="text-sm font-medium leading-none">Customer</label>
                  <div className="flex items-center justify-between rounded-md border border-input bg-muted/50 px-3 py-2 text-sm">
                    <span className="font-medium">{selectedCustomer.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{selectedCustomer.contact_number}</span>
                      <button
                        type="button"
                        onClick={() => { setSelectedCustomer(null); setValue("customer_name", ""); setValue("contact_number", ""); setValue("has_package", false); setCustomerSearch(""); }}
                        className="text-muted-foreground hover:text-red-500 transition-colors ml-1"
                        aria-label="Clear customer"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </>
              )}
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

          {/* Service + Persons */}
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="space-y-1">
              <Label htmlFor="service">Service <span className="text-red-500">*</span></Label>
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
            {isEditing && editingAppointment?.contact_number && (
              <Button
                type="button"
                variant="outline"
                disabled={sending || isDirty}
                onClick={async () => {
                  setSending(true);
                  try {
                    const apptDate = format(
                      new Date(editingAppointment.appointment_date + "T00:00:00"),
                      "EEEE, d MMMM yyyy"
                    );
                    const apptTime = format(
                      parse(editingAppointment.start_time.slice(0, 5), "HH:mm", new Date()),
                      "h:mm a"
                    );
                    const res = await fetch("/api/send-reminder", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        phone: editingAppointment.contact_number,
                        customerName: editingAppointment.customer_name,
                        date: apptDate,
                        time: apptTime,
                        pax: editingAppointment.num_persons,
                        appointmentId: editingAppointment.id,
                      }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error ?? "Failed to send");
                    toast.success("Reminder sent via WhatsApp!");
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to send reminder");
                  } finally {
                    setSending(false);
                  }
                }}
              >
                {sending ? "Sending…" : "Send Reminder"}
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

    {/* Resend reminder prompt after saving */}
    <Dialog open={showReminderPrompt} onOpenChange={(open) => {
      if (!open) {
        setShowReminderPrompt(false);
        setPendingReminder(null);
        reset();
        onClose();
      }
    }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Send Reminder?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Appointment updated. Would you like to resend the WhatsApp reminder to the customer?
        </p>
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={() => {
            setShowReminderPrompt(false);
            setPendingReminder(null);
            reset();
            onClose();
          }}>
            No, Skip
          </Button>
          <Button onClick={sendPendingReminder} disabled={sending}>
            {sending ? "Sending…" : "Send Reminder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>  
  );
}
