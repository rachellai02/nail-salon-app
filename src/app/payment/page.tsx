import { getServiceCategories, getCustomers } from "@/lib/actions";
import PaymentClient from "./PaymentClient";

export default async function PaymentPage() {
  const [categories, customers] = await Promise.all([
    getServiceCategories(),
    getCustomers(),
  ]);
  return <PaymentClient categories={categories} customers={customers} />;
}
