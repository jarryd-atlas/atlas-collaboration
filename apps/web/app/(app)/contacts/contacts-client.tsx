"use client";

import { useState, useMemo } from "react";
import { Search, Mail, Phone, Star, Building2, MapPin } from "lucide-react";
import Link from "next/link";

interface SiteContact {
  id: string;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  sites?: {
    name: string;
    slug: string;
    customer_id: string;
    customers?: { name: string; slug: string };
  };
}

interface ContactsClientProps {
  contacts: SiteContact[];
}

type SortField = "name" | "title" | "company" | "site";
type SortDir = "asc" | "desc";

export function ContactsClient({ contacts }: ContactsClientProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [companyFilter, setCompanyFilter] = useState<string>("all");

  // Get unique companies for filter
  const companies = useMemo(() => {
    const set = new Set<string>();
    for (const c of contacts) {
      const name = c.sites?.customers?.name;
      if (name) set.add(name);
    }
    return Array.from(set).sort();
  }, [contacts]);

  // Filter and sort
  const filtered = useMemo(() => {
    let result = contacts;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.title?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.sites?.name?.toLowerCase().includes(q) ||
          c.sites?.customers?.name?.toLowerCase().includes(q)
      );
    }

    // Company filter
    if (companyFilter !== "all") {
      result = result.filter((c) => c.sites?.customers?.name === companyFilter);
    }

    // Sort
    return [...result].sort((a, b) => {
      let aVal = "";
      let bVal = "";
      switch (sortField) {
        case "name":
          aVal = (a.name ?? "").toLowerCase();
          bVal = (b.name ?? "").toLowerCase();
          break;
        case "title":
          aVal = (a.title ?? "").toLowerCase();
          bVal = (b.title ?? "").toLowerCase();
          break;
        case "company":
          aVal = (a.sites?.customers?.name ?? "").toLowerCase();
          bVal = (b.sites?.customers?.name ?? "").toLowerCase();
          break;
        case "site":
          aVal = (a.sites?.name ?? "").toLowerCase();
          bVal = (b.sites?.name ?? "").toLowerCase();
          break;
      }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [contacts, search, companyFilter, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
        <p className="text-gray-500 mt-1">
          {contacts.length} contact{contacts.length !== 1 ? "s" : ""} across all sites
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts by name, title, email, phone, site..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-green"
          />
        </div>
        {companies.length > 1 && (
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-brand-green"
          >
            <option value="all">All Companies ({contacts.length})</option>
            {companies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <SortHeader label="Name" field="name" current={sortField} dir={sortDir} onSort={toggleSort} />
                <SortHeader label="Title" field="title" current={sortField} dir={sortDir} onSort={toggleSort} />
                <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
                <SortHeader label="Company" field="company" current={sortField} dir={sortDir} onSort={toggleSort} />
                <SortHeader label="Site" field="site" current={sortField} dir={sortDir} onSort={toggleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    {contacts.length === 0 ? "No contacts yet." : "No contacts match your search."}
                  </td>
                </tr>
              ) : (
                filtered.map((contact) => (
                  <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                          <span className="text-xs font-medium text-gray-500">
                            {(contact.name ?? "?").charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">{contact.name}</span>
                          {contact.is_primary && (
                            <Star className="inline-block h-3 w-3 text-amber-400 fill-amber-400 ml-1" />
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{contact.title ?? "--"}</td>
                    <td className="px-4 py-3">
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </a>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {contact.phone ? (
                        <a
                          href={`tel:${contact.phone}`}
                          className="text-gray-700 hover:text-gray-900 flex items-center gap-1"
                        >
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </a>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {contact.sites?.customers ? (
                        <Link
                          href={`/customers/${contact.sites.customers.slug}`}
                          className="text-gray-700 hover:text-gray-900 flex items-center gap-1"
                        >
                          <Building2 className="h-3 w-3 text-gray-400" />
                          {contact.sites.customers.name}
                        </Link>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {contact.sites ? (
                        <Link
                          href={`/customers/${contact.sites.customers?.slug}/sites/${contact.sites.slug}`}
                          className="text-gray-700 hover:text-gray-900 flex items-center gap-1"
                        >
                          <MapPin className="h-3 w-3 text-gray-400" />
                          {contact.sites.name}
                        </Link>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      {filtered.length !== contacts.length && (
        <p className="text-xs text-gray-400">
          Showing {filtered.length} of {contacts.length} contacts
        </p>
      )}
    </div>
  );
}

function SortHeader({
  label,
  field,
  current,
  dir,
  onSort,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (field: SortField) => void;
}) {
  return (
    <th className="text-left px-4 py-3 font-medium text-gray-600">
      <button
        className="flex items-center gap-1 hover:text-gray-900 transition-colors"
        onClick={() => onSort(field)}
      >
        {label}
        {current === field && (
          <span className="text-[10px] text-gray-400">{dir === "asc" ? "\u2191" : "\u2193"}</span>
        )}
      </button>
    </th>
  );
}
