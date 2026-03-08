import Link from "next/link";
import { getArchivedPackages, restoreArchivedPackage } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default async function ArchivedPackageTypesPage() {
  const archivedPackages = await getArchivedPackages();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Archived Package Types</h1>
        <Link href="/packages/archive" className="text-sm text-blue-600 hover:underline">
          Back to Archive
        </Link>
      </div>
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Package ID</TableHead>
              <TableHead className="whitespace-normal break-words max-w-[200px]">Package Name</TableHead>
              <TableHead>Use Count</TableHead>
              <TableHead>Price (RM)</TableHead>
              <TableHead>Status Before Delete</TableHead>
              <TableHead>Deleted At</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {archivedPackages.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-400 py-10">
                  No archived package types.
                </TableCell>
              </TableRow>
            )}
            {archivedPackages.map((pkg) => (
              <TableRow key={pkg.id}>
                <TableCell>
                  {pkg.package_code ? String(pkg.package_code).padStart(3, "0") : "-"}
                </TableCell>
                <TableCell className="font-medium whitespace-normal break-words max-w-[200px]">{pkg.name}</TableCell>
                <TableCell>{pkg.total_uses}x</TableCell>
                <TableCell>RM {Number(pkg.price).toFixed(2)}</TableCell>
                <TableCell>{pkg.was_active ? "Active" : "Inactive"}</TableCell>
                <TableCell>{new Date(pkg.deleted_at).toLocaleString("en-MY")}</TableCell>
                <TableCell>
                  <form
                    action={async () => {
                      "use server";
                      await restoreArchivedPackage(pkg.id);
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
