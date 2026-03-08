import {
  getArchivedCustomerPackagesByCustomerId,
  getCustomerById,
  getPackagesByCustomerId,
  getPackages,
} from "@/lib/actions";
import { notFound } from "next/navigation";
import CustomerDetailClient from "./CustomerDetailClient";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const { customerId } = await params;

  if (!customerId || !UUID_REGEX.test(customerId)) {
    notFound();
  }

  const [customer, customerPackages, allPackages, archivedCustomerPackages] = await Promise.all([
    getCustomerById(customerId),
    getPackagesByCustomerId(customerId),
    getPackages(),
    getArchivedCustomerPackagesByCustomerId(customerId),
  ]);

  if (!customer) {
    notFound();
  }

  return (
    <CustomerDetailClient
      customer={customer}
      customerPackages={customerPackages}
      allPackages={allPackages}
      archivedCustomerPackages={archivedCustomerPackages}
    />
  );
}
