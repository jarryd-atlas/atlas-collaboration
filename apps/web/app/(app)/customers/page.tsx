import Link from "next/link";
import { getCustomers } from "../../../lib/data/queries";
import { Building2, ArrowRight } from "lucide-react";
import { AddCustomerButton } from "../../../components/forms/create-customer-dialog";

export default async function CustomersListPage() {
  let customers: Awaited<ReturnType<typeof getCustomers>> = [];

  try {
    customers = await getCustomers();
  } catch {
    // Empty state if Supabase not connected
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">{customers.length} customer accounts</p>
        </div>
        <AddCustomerButton />
      </div>

      {customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-900">No customers yet</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-sm">
            Add your first customer to get started.
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((customer) => (
            <Link
              key={customer.slug}
              href={`/customers/${customer.slug}`}
              className="group rounded-xl border border-gray-100 bg-white p-6 shadow-card hover:shadow-card-hover transition-shadow"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-gray-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-brand-dark">{customer.name}</h3>
                  {customer.domain && (
                    <p className="text-xs text-gray-400">{customer.domain}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">
                  {customer.active_sites ?? 0} active / {customer.total_sites ?? 0} sites
                </span>
                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-brand-green transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
