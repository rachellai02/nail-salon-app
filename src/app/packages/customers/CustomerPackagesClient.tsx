"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerPackage, Package, Customer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CustomerFormDialog } from "@/components/CustomerFormDialog";
import { formatDateMY } from "@/lib/utils";

type Props = {
  initialCustomerPackages: CustomerPackage[];
  packages: Package[];
  customers: Customer[];
};

type CustomerWithPackages = {
  customer: Customer;
  packages: CustomerPackage[];
};

export default function CustomerPackagesClient({
  initialCustomerPackages,
  packages,
  customers,
}: Props) {
  const [search, setSearch] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const router = useRouter();

  // Group packages by customer
  const customerWithPackages: CustomerWithPackages[] = customers.map((customer) => ({
    customer,
    packages: initialCustomerPackages.filter((cp) => cp.customer_id === customer.id),
  }));

  const filtered = customerWithPackages.filter(({ customer, packages }) => {
    const term = search.toLowerCase();
    return (
      customer.name.toLowerCase().includes(term) ||
      customer.customer_code.toLowerCase().includes(term) ||
      customer.contact_number.includes(term) ||
      packages.some((pkg) => pkg.id.toLowerCase().includes(term))
    );
  });

  function handleRegisterClose() {
    setRegisterOpen(false);
    window.location.reload();
  }

  function navigateToCustomer(customerId: string) {
    router.push(`/packages/customers/${customerId}`);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage customers and their package purchases.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setRegisterOpen(true)}>
            + Register Customer
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder="Search by customer ID, name, or contact number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer ID</TableHead>
              <TableHead className="whitespace-normal break-words max-w-[200px]">Customer Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Birthday</TableHead>
              <TableHead>Total Packages</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-400 py-10">
                  {search ? "No results found." : "No customers yet."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map(({ customer, packages: customerPkgs }) => (
              <TableRow key={customer.id} className="cursor-pointer hover:bg-gray-50">
                <TableCell>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {customer.customer_code}
                  </code>
                </TableCell>
                <TableCell 
                  className="font-medium text-blue-600 hover:underline whitespace-normal break-words max-w-[200px]"
                  onClick={() => navigateToCustomer(customer.id)}
                >
                  {customer.name}
                </TableCell>
                <TableCell>{customer.contact_number}</TableCell>
                <TableCell className="text-gray-500 text-sm">
                  {customer.birthday ? formatDateMY(customer.birthday) : "—"}
                </TableCell>
                <TableCell>{customerPkgs.filter((pkg) => pkg.remaining_uses > 0).length}</TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigateToCustomer(customer.id);
                    }}
                  >
                    View Details
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CustomerFormDialog
        open={registerOpen}
        onClose={handleRegisterClose}
      />
    </div>
  );
}
