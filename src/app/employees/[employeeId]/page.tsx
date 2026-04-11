import { getEmployeeById, getEmployeeSplitTransactions } from "@/lib/actions";
import { notFound } from "next/navigation";
import EmployeeDetailClient from "./EmployeeDetailClient";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const employee = await getEmployeeById(employeeId);
  if (!employee) notFound();
  const salesTransactions = await getEmployeeSplitTransactions(employee.id);
  return <EmployeeDetailClient employee={employee} salesTransactions={salesTransactions} />;
}
