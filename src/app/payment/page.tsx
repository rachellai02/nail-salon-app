import { getServiceCategories, getCustomers, getPackages, getEmployees } from "@/lib/actions";
import PaymentClient from "./PaymentClient";

export default async function PaymentPage() {
  const [categories, customers, packages, employees] = await Promise.all([
    getServiceCategories(),
    getCustomers(),
    getPackages().catch(() => []),
    getEmployees().catch(() => []),
  ]);
  return <PaymentClient categories={categories} customers={customers} packages={packages} employees={employees} />;
}
