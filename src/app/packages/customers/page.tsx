import { getCustomerPackages, getPackages } from "@/lib/actions";
import CustomerPackagesClient from "./CustomerPackagesClient";

export default async function CustomerPackagesPage() {
  const [customerPackages, packages] = await Promise.all([
    getCustomerPackages(),
    getPackages(),
  ]);
  return (
    <CustomerPackagesClient
      initialCustomerPackages={customerPackages}
      packages={packages}
    />
  );
}
