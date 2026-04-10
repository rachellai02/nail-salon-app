import { getEmployeeById } from "@/lib/actions";
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
  return <EmployeeDetailClient employee={employee} />;
}
