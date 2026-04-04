import { getServiceCategories } from "@/lib/actions";
import ServicesClient from "./ServicesClient";

export default async function ServicesPage() {
  const categories = await getServiceCategories();
  return <ServicesClient initialCategories={categories} />;
}
