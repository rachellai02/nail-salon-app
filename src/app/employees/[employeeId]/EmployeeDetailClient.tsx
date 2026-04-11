"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Employee } from "@/lib/types";
import { updateEmployee, deleteEmployee } from "@/lib/actions";
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
import { useMemo } from "react";
import SalesSummaryClient from "@/app/sales/SalesSummaryClient";

type Props = {
  employee: Employee;
  salesTransactions: { transacted_at: string; total: number }[];
};

export default function EmployeeDetailClient({ employee, salesTransactions }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: employee.name,
    nickname: employee.nickname ?? "",
    date_of_birth: employee.date_of_birth ?? "",
    start_date: employee.start_date ?? "",
    email: employee.email ?? "",
    phone_number: employee.phone_number ?? "",
    is_active: employee.is_active !== false,
  });

  const employeeId = String(employee.employee_code).padStart(3, "0");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    try {
      await updateEmployee(employee.id, {
        name: form.name.trim(),
        nickname: form.nickname || null,
        date_of_birth: form.date_of_birth || null,
        start_date: form.start_date || null,
        email: form.email || null,
        phone_number: form.phone_number || null,
        is_active: form.is_active,
      });
      toast.success("Employee updated.");
      setEditOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update employee.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    try {
      await deleteEmployee(employee.id);
      toast.success("Employee deleted.");
      router.push("/employees");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete employee.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            type="button"
            className="text-sm text-gray-400 hover:text-gray-600 mb-1"
            onClick={() => router.push("/employees")}
          >
            ← Back to Employees
          </button>
          <div className="mt-3">
          <h1 className="text-2xl font-bold">{employee.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">Employee ID: {employeeId}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        </div>
      </div>

      {/* Details card */}
      <div className="bg-white rounded-xl border p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Name</p>
            <p className="font-medium">{employee.name}</p>
          </div>
          <div>
            <p className="text-gray-400">Nickname</p>
            <p className="font-medium">{employee.nickname ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-400">Date of Birth</p>
            <p className="font-medium">{employee.date_of_birth ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-400">Email</p>
            <p className="font-medium">{employee.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-400">Phone Number</p>
            <p className="font-medium">{employee.phone_number ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-400">Status</p>
            <p className="font-medium">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                employee.is_active !== false
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-500"
              }`}>
                {employee.is_active !== false ? "Active" : "Inactive"}
              </span>
            </p>
          </div>
          <div>
            <p className="text-gray-400">Joined Since</p>
            <p className="font-medium">{employee.start_date ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* Sales section */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold">Sales</h2>
        <SalesSummaryClient transactions={salesTransactions} />
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-nickname">Nickname</Label>
              <Input
                id="edit-nickname"
                name="nickname"
                placeholder="e.g. Amy"
                value={form.nickname}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-dob">Date of Birth</Label>
              <Input
                id="edit-dob"
                name="date_of_birth"
                type="date"
                value={form.date_of_birth}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-start-date">Joined Since</Label>
              <Input
                id="edit-start-date"
                name="start_date"
                type="date"
                value={form.start_date}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-phone">Phone Number</Label>
              <Input
                id="edit-phone"
                name="phone_number"
                value={form.phone_number}
                onChange={handleChange}
              />
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="detail-is-active">Status</Label>
              <button
                id="detail-is-active"
                type="button"
                role="switch"
                aria-checked={form.is_active}
                onClick={() => setForm((prev) => ({ ...prev, is_active: !prev.is_active }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.is_active ? "bg-green-500" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.is_active ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className={`text-sm ${form.is_active ? "text-green-600" : "text-gray-400"}`}>
                {form.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="destructive"
                className="mr-auto"
                onClick={() => { setEditOpen(false); setDeleteOpen(true); }}
              >
                Delete
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Employee</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{employee.name}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>
              {loading ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
