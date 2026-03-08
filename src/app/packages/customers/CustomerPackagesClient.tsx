"use client";

import { useState } from "react";
import { CustomerPackage, Package } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SellPackageDialog } from "@/components/SellPackageDialog";
import { DeductUseDialog } from "@/components/DeductUseDialog";

type Props = {
  initialCustomerPackages: CustomerPackage[];
  packages: Package[];
};

export default function CustomerPackagesClient({
  initialCustomerPackages,
  packages,
}: Props) {
  const [search, setSearch] = useState("");
  const [sellOpen, setSellOpen] = useState(false);
  const [deductTarget, setDeductTarget] = useState<CustomerPackage | null>(null);

  const filtered = initialCustomerPackages.filter((cp) => {
    const term = search.toLowerCase();
    return (
      cp.customer_name.toLowerCase().includes(term) ||
      cp.contact_number.includes(term) ||
      cp.id.toLowerCase().includes(term)
    );
  });

  function handleClose() {
    setSellOpen(false);
    window.location.reload();
  }

  function handleDeductClose() {
    setDeductTarget(null);
    window.location.reload();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Customer Packages</h1>
          <p className="text-gray-500 text-sm mt-1">
            Record a new package sale, look up customers, and deduct sessions.
          </p>
        </div>
        <Button onClick={() => setSellOpen(true)}>+ Sell Package</Button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder="Search by name, contact number, or package ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Remaining</TableHead>
              <TableHead>Package ID</TableHead>
              <TableHead>Purchased</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-400 py-10">
                  {search ? "No results found." : "No customer packages yet."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((cp) => (
              <TableRow key={cp.id}>
                <TableCell className="font-medium">{cp.customer_name}</TableCell>
                <TableCell>{cp.contact_number}</TableCell>
                <TableCell>{cp.package?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      cp.remaining_uses === 0
                        ? "destructive"
                        : cp.remaining_uses <= 1
                        ? "secondary"
                        : "default"
                    }
                  >
                    {cp.remaining_uses} left
                  </Badge>
                </TableCell>
                <TableCell>
                  <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {cp.id.slice(0, 8).toUpperCase()}
                  </code>
                  <span className="text-gray-400 text-xs ml-1">(click to copy)</span>
                  <button
                    className="ml-1 text-xs text-blue-500 hover:underline"
                    onClick={() => {
                      navigator.clipboard.writeText(cp.id);
                    }}
                  >
                    Copy full ID
                  </button>
                </TableCell>
                <TableCell className="text-gray-500 text-sm">
                  {new Date(cp.purchased_at).toLocaleDateString("en-MY")}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    disabled={cp.remaining_uses <= 0}
                    onClick={() => setDeductTarget(cp)}
                  >
                    Use 1 Session
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <SellPackageDialog
        open={sellOpen}
        onClose={handleClose}
        packages={packages}
      />
      <DeductUseDialog
        open={!!deductTarget}
        onClose={handleDeductClose}
        customerPackage={deductTarget}
      />
    </div>
  );
}
