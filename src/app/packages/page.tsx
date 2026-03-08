import { getPackages } from "@/lib/actions";
import PackagesClient from "./PackagesClient";

export default async function PackagesPage() {
  const packages = await getPackages();
  return <PackagesClient initialPackages={packages} />;
}
