import { getTransactionsByMonth } from "@/lib/actions";
import SalesClient from "./SalesClient";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const year = params.year ? parseInt(params.year) : now.getFullYear();
  const month = params.month ? parseInt(params.month) : now.getMonth() + 1;
  const transactions = await getTransactionsByMonth(year, month);
  return <SalesClient transactions={transactions} year={year} month={month} />;
}
