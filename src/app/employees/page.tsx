import { getEmployees } from "@/lib/actions";
import EmployeesClient from "./EmployeesClient";

export default async function EmployeesPage() {
  const employees = await getEmployees();
  return <EmployeesClient employees={employees} />;
}
