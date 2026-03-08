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

export type Customer = {
  id: string;
  customer_code: string;
  name: string;
  contact_number: string;
  birthday: string | null;
  created_at: string;
};

export type CustomerPackage = {
  id: string;               // Shareable Package ID
  customer_id: string;
  package_id: string;
  remaining_uses: number;
  purchased_at: string;
  expiry_date: string | null;
  completed_at?: string | null;
  notes: string | null;
  // Joined fields
  customer?: Customer;
  package?: Package;
};

export type PackageUsageLog = {
  id: string;
  customer_package_id: string;
  used_at: string;
  notes: string | null;
};

export type Appointment = {
  id: string;
  customer_name: string;
  contact_number: string | null;
  service: string;
  appointment_date: string;   // "yyyy-MM-dd"
  start_time: string;          // "HH:MM:SS"
  end_time: string;            // "HH:MM:SS"
  notes: string | null;
  num_persons: number;
  has_package: boolean;
  status: "confirmed" | "completed" | "cancelled";
  created_at: string;
};

export type ArchivedPackage = {
  id: string;
  original_package_id: string;
  package_code: number | null;
  name: string;
  total_uses: number;
  price: number;
  description: string | null;
  was_active: boolean;
  created_at: string;
  deleted_at: string;
};

export type ArchivedCustomer = {
  id: string;
  original_customer_id: string;
  customer_code: string | null;
  name: string;
  contact_number: string;
  birthday: string | null;
  created_at: string;
  deleted_at: string;
};

export type ArchivedCustomerPackage = {
  id: string;
  original_customer_package_id: string;
  customer_id: string | null;
  customer_code: string | null;
  customer_name: string;
  contact_number: string;
  package_id: string | null;
  package_code: number | null;
  package_name: string;
  total_uses: number;
  remaining_uses: number;
  purchased_at: string;
  expiry_date: string | null;
  notes: string | null;
  usage_logs: Array<{
    used_at: string;
    notes: string | null;
  }> | null;
  deleted_at: string;
};
