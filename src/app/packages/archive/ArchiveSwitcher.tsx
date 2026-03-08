"use client";

import { useState } from "react";
import {
  permanentlyDeleteAllArchivedCustomers,
  permanentlyDeleteAllArchivedPackages,
  restoreArchivedCustomer,
  restoreArchivedPackage,
} from "@/lib/actions";
import type { ArchivedCustomer, ArchivedPackage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { formatDateMY, formatDateTimeMY } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ArchiveSection = "package-types" | "customers";

type Props = {
  archivedPackages: ArchivedPackage[];
  archivedCustomers: ArchivedCustomer[];
};

export default function ArchiveSwitcher({ archivedPackages, archivedCustomers }: Props) {
  const [activeSection, setActiveSection] = useState<ArchiveSection>("package-types");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={activeSection === "package-types" ? "default" : "outline"}
          onClick={() => setActiveSection("package-types")}
        >
          Archived Package Types
        </Button>
        <Button
          type="button"
          variant={activeSection === "customers" ? "default" : "outline"}
          onClick={() => setActiveSection("customers")}
        >
          Archived Customers
        </Button>
      </div>

      <div>
        {activeSection === "package-types" ? (
          <form action={permanentlyDeleteAllArchivedPackages}>
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={archivedPackages.length === 0}
            >
              Permanently Delete All
            </Button>
          </form>
        ) : (
          <form action={permanentlyDeleteAllArchivedCustomers}>
            <Button
              type="submit"
              size="sm"
              variant="destructive"
              disabled={archivedCustomers.length === 0}
            >
              Permanently Delete All
            </Button>
          </form>
        )}
      </div>

      {activeSection === "package-types" ? (
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
                  <TableCell className="font-medium whitespace-normal break-words max-w-[200px]">
                    {pkg.name}
                  </TableCell>
                  <TableCell>{pkg.total_uses}x</TableCell>
                  <TableCell>RM {Number(pkg.price).toFixed(2)}</TableCell>
                  <TableCell>{pkg.was_active ? "Active" : "Inactive"}</TableCell>
                  <TableCell>{formatDateTimeMY(pkg.deleted_at)}</TableCell>
                  <TableCell>
                    <form action={restoreArchivedPackage.bind(null, pkg.id)}>
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
      ) : (
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
                  <TableCell className="font-medium whitespace-normal break-words max-w-[200px]">
                    {customer.name}
                  </TableCell>
                  <TableCell>{customer.contact_number}</TableCell>
                  <TableCell>{customer.birthday ? formatDateMY(customer.birthday) : "-"}</TableCell>
                  <TableCell>{formatDateTimeMY(customer.deleted_at)}</TableCell>
                  <TableCell>
                    <form action={restoreArchivedCustomer.bind(null, customer.id)}>
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
      )}
    </div>
  );
}
