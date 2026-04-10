"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Employee } from "@/lib/types";
import { createEmployee, updateEmployee, deleteEmployee } from "@/lib/actions";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Props = {
  employees: Employee[];
};

export default function EmployeesClient({ employees: initialEmployees }: Props) {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    nickname: "",
    date_of_birth: "",
    start_date: "",
    email: "",
    phone_number: "",
    is_active: true,
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleOpen() {
    setForm({ name: "", nickname: "", date_of_birth: "", start_date: "", email: "", phone_number: "", is_active: true });
    setEditTarget(null);
    setDialogOpen(true);
  }

  function handleEditOpen(emp: Employee, e: React.MouseEvent) {
    e.stopPropagation();
    setForm({
      name: emp.name,
      nickname: emp.nickname ?? "",
      date_of_birth: emp.date_of_birth ?? "",
      start_date: emp.start_date ?? "",
      email: emp.email ?? "",
      phone_number: emp.phone_number ?? "",
      is_active: emp.is_active !== false,
    });
    setEditTarget(emp);
    setDialogOpen(true);
  }

  async function handleDelete(emp: Employee, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`Delete ${emp.name}? This cannot be undone.`)) return;
    try {
      await deleteEmployee(emp.id);
      setEmployees((prev) => prev.filter((x) => x.id !== emp.id));
      toast.success(`${emp.name} deleted.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    setLoading(true);
    try {
      if (editTarget) {
        const updated = await updateEmployee(editTarget.id, {
          name: form.name,
          nickname: form.nickname || null,
          date_of_birth: form.date_of_birth || null,
          start_date: form.start_date || null,
          email: form.email || null,
          phone_number: form.phone_number || null,
          is_active: form.is_active,
        });
        setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
        setDialogOpen(false);
        toast.success(`${updated.name} updated successfully.`);
      } else {
        const created = await createEmployee({
          name: form.name,
          nickname: form.nickname,
          date_of_birth: form.date_of_birth || undefined,
          start_date: form.start_date || undefined,
          email: form.email || undefined,
          phone_number: form.phone_number || undefined,
        });
        setEmployees((prev) => [...prev, created]);
        setDialogOpen(false);
        toast.success(`${created.name} added successfully.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const active = employees.filter((e) => e.is_active !== false);
  const inactive = employees.filter((e) => e.is_active === false);

  function EmployeeTable({ rows, dim }: { rows: Employee[]; dim?: boolean }) {
    return (
      <div className={`bg-white rounded-xl border overflow-hidden${dim ? " opacity-60" : ""}`}>
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50 text-xs text-gray-400 uppercase tracking-wide">
              <TableHead className="font-medium">ID</TableHead>
              <TableHead className="font-medium">Name</TableHead>
              <TableHead className="font-medium">Nickname</TableHead>
              <TableHead className="font-medium">Phone Number</TableHead>
              <TableHead className="font-medium">Email</TableHead>
              <TableHead className="font-medium">Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-400 py-8">
                  No employees in this group.
                </TableCell>
              </TableRow>
            )}
            {rows.map((emp) => (
              <TableRow
                key={emp.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => router.push(`/employees/${emp.id}`)}
              >
                <TableCell>
                  <code className="text-xs bg-blue-50 px-2 py-1 rounded font-semibold">
                    {String(emp.employee_code).padStart(3, "0")}
                  </code>
                </TableCell>
                <TableCell className="font-medium">{emp.name}</TableCell>
                <TableCell className="text-gray-500">{emp.nickname ?? "—"}</TableCell>
                <TableCell className="text-gray-500">{emp.phone_number ?? "—"}</TableCell>
                <TableCell className="text-gray-500">{emp.email ?? "—"}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                    emp.is_active !== false
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    {emp.is_active !== false ? "Active" : "Inactive"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={(e) => handleEditOpen(emp, e)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={(e) => handleDelete(emp, e)}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Employees</h1>
        <Button onClick={handleOpen}>+ Add Employee</Button>
      </div>

      <EmployeeTable rows={active} />

      {inactive.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Inactive</h2>
          <EmployeeTable rows={inactive} dim />
        </div>
      )}

      {/* Add / Edit Employee Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTarget ? "Edit Employee" : "Add Employee"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-1">
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input
                name="name"
                placeholder="Full name"
                value={form.name}
                onChange={handleChange}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Nickname</Label>
              <Input
                name="nickname"
                placeholder="e.g. Amy"
                value={form.nickname}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-1">
              <Label>Date of Birth</Label>
              <Input
                name="date_of_birth"
                type="date"
                value={form.date_of_birth}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-1">
              <Label>Joined Since</Label>
              <Input
                name="start_date"
                type="date"
                value={form.start_date}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                name="email"
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-1">
              <Label>Phone Number</Label>
              <Input
                name="phone_number"
                placeholder="+601XXXXXXXX"
                value={form.phone_number}
                onChange={handleChange}
              />
            </div>
            {editTarget && (
              <div className="flex items-center gap-3">
                <Label htmlFor="edit-is-active">Status</Label>
                <button
                  id="edit-is-active"
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
            )}
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving…" : editTarget ? "Save Changes" : "Add Employee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
