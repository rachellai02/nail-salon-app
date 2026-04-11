"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Employee } from "@/lib/types";
import { createEmployee } from "@/lib/actions";
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
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    setLoading(true);
    try {
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
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-400 py-8">
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
                <TableCell className="font-medium text-blue-600 underline">{emp.name}</TableCell>
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

      {/* Add Employee Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) setDialogOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
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
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving…" : "Add Employee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
