import { getPackages, getServiceCategories } from "@/lib/actions";
import { Service } from "@/lib/types";
import PackagesClient from "./PackagesClient";

export default async function PackagesPage() {
  const [packages, categories] = await Promise.all([
    getPackages().catch(() => [] as import("@/lib/types").Package[]),
    getServiceCategories().catch(() => []),
  ]);
  const services: Service[] = categories.flatMap((c) => c.services ?? []);
  return <PackagesClient initialPackages={packages} services={services} />;
}
