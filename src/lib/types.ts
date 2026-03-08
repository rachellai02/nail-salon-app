// Types matching the Supabase database schema

export type Package = {
  id: string;
  package_code: number;
  name: string;
  total_uses: number;
  price: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type CustomerPackage = {
  id: string;               // Shareable Package ID
  package_id: string;
  customer_name: string;
  contact_number: string;
  remaining_uses: number;
  purchased_at: string;
  notes: string | null;
  // Joined field from packages table
  package?: Package;
};

export type PackageUsageLog = {
  id: string;
  customer_package_id: string;
  used_at: string;
  notes: string | null;
};
