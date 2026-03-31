import { getCustomersWithAccountData } from "../../../lib/data/queries";
import { getSession } from "../../../lib/supabase/server";
import { Building2 } from "lucide-react";
import { AddCustomerButton } from "../../../components/forms/create-customer-dialog";
import { CompaniesListView } from "../../../components/customers/companies-list-view";
import { BackfillButton } from "../../../components/account-plan/backfill-button";

export default async function CustomersListPage() {
  let customers: Awaited<ReturnType<typeof getCustomersWithAccountData>> = [];
  let isCKInternal = false;

  try {
    const [data, session] = await Promise.all([
      getCustomersWithAccountData(),
      getSession(),
    ]);
    customers = data;
    isCKInternal = session?.claims?.tenantType === "internal";
  } catch {
    // Empty state if Supabase not connected
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Companies</h1>
          <p className="text-gray-500 mt-1">{customers.length} companies</p>
        </div>
        <div className="flex items-center gap-3">
          {isCKInternal && customers.length > 0 && <BackfillButton />}
          <AddCustomerButton />
        </div>
      </div>

      {customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-900">No companies yet</h3>
          <p className="text-sm text-gray-400 mt-1 max-w-sm">
            Add your first company to get started.
          </p>
        </div>
      ) : (
        <CompaniesListView customers={customers} />
      )}
    </div>
  );
}
