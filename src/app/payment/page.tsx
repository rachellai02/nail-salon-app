import { getServiceCategories, getCustomers, getPackages } from "@/lib/actions";
import PaymentClient from "./PaymentClient";

export default async function PaymentPage() {
  const [categories, customers, packages] = await Promise.all([
    getServiceCategories(),
    getCustomers(),
    getPackages().catch(() => []),
  ]);
  return <PaymentClient categories={categories} customers={customers} packages={packages} />;
}
