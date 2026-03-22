import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerBySlug } from "../../../../../lib/data/queries";
import { CustomerDocumentsView } from "../../../../../components/documents/customer-documents-view";

interface DocumentsPageProps {
  params: Promise<{ customerSlug: string }>;
}

export default async function DocumentsPage({ params }: DocumentsPageProps) {
  const { customerSlug } = await params;

  let customer: Awaited<ReturnType<typeof getCustomerBySlug>> = null;
  try {
    customer = await getCustomerBySlug(customerSlug);
  } catch {
    return notFound();
  }

  if (!customer) return notFound();

  return (
    <div className="space-y-8">
      {/* Breadcrumb + header */}
      <div>
        <p className="text-sm text-gray-400 mb-1">
          <Link href="/customers" className="hover:text-gray-600">Companies</Link>
          {" / "}
          <Link href={`/customers/${customerSlug}`} className="hover:text-gray-600">{customer.name}</Link>
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="text-gray-500 mt-1">
          All documents for {customer.name} — uploaded at the customer level or to individual sites.
        </p>
      </div>

      <CustomerDocumentsView
        customerId={customer.id}
        tenantId={customer.tenant_id}
      />
    </div>
  );
}
