import { getArchivedCustomers, getArchivedPackages } from "@/lib/actions";
import ArchiveSwitcher from "./ArchiveSwitcher";

export default async function ArchiveHomePage() {
  const [archivedPackages, archivedCustomers] = await Promise.all([
    getArchivedPackages(),
    getArchivedCustomers(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Archive</h1>
      <p className="text-sm text-gray-600">
        View deleted records. Choose the section you want to inspect.
      </p>
      <ArchiveSwitcher
        archivedPackages={archivedPackages}
        archivedCustomers={archivedCustomers}
      />
      <p className="text-xs text-gray-500">
        Archived customer packages deleted from customer details can be viewed in each customer profile under the expandable "Archived Packages" section.
      </p>
    </div>
  );
}
