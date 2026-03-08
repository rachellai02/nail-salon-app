import Link from "next/link";
import {
  getArchivedCustomers,
  permanentlyDeleteAllArchivedCustomers,
  restoreArchivedCustomer,
} from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ArchivedCustomersPage() {
  const archivedCustomers = await getArchivedCustomers();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Archived Customers</h1>
        <div className="flex items-center gap-2">
          <form
            action={async () => {
              "use server";
              await permanentlyDeleteAllArchivedCustomers();
            }}
          >
            <Button
              size="sm"
              variant="destructive"
              type="submit"
              disabled={archivedCustomers.length === 0}
            >
              Permanently Delete All
            </Button>
          </form>
          <Link href="/packages/archive" className="text-sm text-blue-600 hover:underline">
            Back to Archive
          </Link>
        </div>
      </div>
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer ID</TableHead>
              <TableHead className="whitespace-normal break-words max-w-[200px]">Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Birthday</TableHead>
              <TableHead>Deleted At</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {archivedCustomers.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-400 py-10">
                  No archived customers.
                </TableCell>
              </TableRow>
            )}
            {archivedCustomers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell>{customer.customer_code ?? "-"}</TableCell>
                <TableCell className="font-medium whitespace-normal break-words max-w-[200px]">{customer.name}</TableCell>
                <TableCell>{customer.contact_number}</TableCell>
                <TableCell>
                  {customer.birthday
                    ? new Date(customer.birthday).toLocaleDateString("en-MY")
                    : "-"}
                </TableCell>
                <TableCell>{new Date(customer.deleted_at).toLocaleString("en-MY")}</TableCell>
                <TableCell>
                  <form
                    action={async () => {
                      "use server";
                      await restoreArchivedCustomer(customer.id);
                    }}
                  >
                    <Button size="sm" variant="outline" type="submit">
                      Restore
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
