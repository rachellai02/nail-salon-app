import { getCustomerPackages, getPackages, getCustomers } from "@/lib/actions";
import CustomerPackagesClient from "./CustomerPackagesClient";

export default async function CustomerPackagesPage() {
  const [customerPackages, packages, customers] = await Promise.all([
    getCustomerPackages(),
    getPackages(),
    getCustomers(),
  ]);
  return (
    <CustomerPackagesClient
      initialCustomerPackages={customerPackages}
      packages={packages}
      customers={customers}
    />
  );
}
