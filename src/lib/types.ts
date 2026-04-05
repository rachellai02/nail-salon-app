// Types matching the Supabase database schema

export type PackageItem = {
  id: string;
  package_id: string;
  service_name: string;
  total_uses: number;
  sort_order: number;
};

export type CustomerPackageItem = {
  id: string;
  customer_package_id: string;
  service_name: string;
  total_uses: number;
  remaining_uses: number;
  sort_order: number;
};

export type Package = {
  id: string;
  package_code: number;
  name: string;
  package_type: 'services' | 'credit';
  total_uses: number;
  total_credits: number | null;
  price: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  items?: PackageItem[];
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
  remaining_credits: number | null;
  purchased_at: string;
  expiry_date: string | null;
  completed_at?: string | null;
  notes: string | null;
  // Joined fields
  customer?: Customer;
  package?: Package;
  items?: CustomerPackageItem[];
};

export type PackageUsageLog = {
  id: string;
  customer_package_id: string;
  customer_package_item_id: string | null;
  service_name: string | null;
  credits_used: number | null;
  cash_topup: number | null;
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
  package_type: 'services' | 'credit';
  total_uses: number;
  total_credits: number | null;
  price: number;
  description: string | null;
  was_active: boolean;
  created_at: string;
  deleted_at: string;
  items: Array<{ service_name: string; total_uses: number; sort_order: number }>;
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
  package_type: 'services' | 'credit';
  total_uses: number;
  total_credits: number | null;
  remaining_uses: number;
  remaining_credits: number | null;
  purchased_at: string;
  expiry_date: string | null;
  notes: string | null;
  usage_logs: Array<{
    used_at: string;
    notes: string | null;
  }> | null;
  items: Array<{
    service_name: string;
    total_uses: number;
    remaining_uses: number;
    sort_order: number;
  }>;
  deleted_at: string;
};

export type ServiceCategory = {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
  services?: Service[];
};

export type Service = {
  id: string;
  category_id: string;
  name: string;
  price: number | null;
  sort_order: number;
  created_at: string;
};

export type TransactionItem = {
  service_name: string;
  qty: number;
  unit_price: number;
  subtotal: number;
};

export type ReceiptSnapshot = {
  customerPackages?: CustomerPackage[];
  extraPaymentType?: string;
  extraTotal?: number;
  extraCashReceived?: number | null;
  extraChangeGiven?: number | null;
  packageDeductions?: { packageName: string; amount: number }[];
};

export type Transaction = {
  id: string;
  receipt_no: string;
  transacted_at: string;       // ISO timestamptz
  payment_type: string;
  total: number;
  cash_received: number | null;
  change_given: number | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  items: TransactionItem[];    // stored as JSONB
  is_voided: boolean;
  receipt_snapshot?: ReceiptSnapshot | null;
};

export type ArchivedTransaction = {
  id: string;
  receipt_no: string;
  transacted_at: string;
  payment_type: string;
  total: number;
  cash_received: number | null;
  change_given: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  items: TransactionItem[];
  is_voided: boolean;
  deleted_at: string;
};
