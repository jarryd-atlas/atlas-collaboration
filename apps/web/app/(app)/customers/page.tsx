import Link from "next/link";
import { getCustomers } from "../../../lib/mock-data";
import { Building2, ArrowRight } from "lucide-react";
import { AddCustomerButton } from "../../../components/forms/create-customer-dialog";

export default function CustomersListPage() {
  const customers = getCustomers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">{customers.length} customer accounts</p>
        </div>
        <AddCustomerButton />
      </div>

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
                {customer.activeSites} active / {customer.totalSites} sites
              </span>
              <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-brand-green transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
