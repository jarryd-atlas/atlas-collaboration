"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  addSiteContact,
  updateSiteContact,
  deleteSiteContact,
  linkStakeholderToSite,
  createStakeholderAndLinkToSite,
} from "../../lib/actions/assessment";
import { Plus, Trash2, UserCircle, Star, Search, X, UserPlus, Loader2 } from "lucide-react";

interface Stakeholder {
  id: string;
  name: string;
  title?: string | null;
  email?: string | null;
  phone?: string | null;
  department?: string | null;
  stakeholder_role?: string | null;
}

interface SiteContactsSectionProps {
  assessment: any;
  siteContacts: any[];
  siteId: string;
  tenantId: string;
  customerId: string;
  isLocked: boolean;
}

export function SiteContactsSection({
  assessment,
  siteContacts: initialContacts,
  siteId,
  tenantId,
  customerId,
  isLocked,
}: SiteContactsSectionProps) {
  const [contacts, setContacts] = useState(initialContacts);
  const [mode, setMode] = useState<"idle" | "searching" | "creating">("idle");
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Stakeholder[]>([]);
  const [searching, setSearching] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", title: "", email: "", phone: "" });
  const [error, setError] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const assessmentId = assessment?.id;

  // Search stakeholders when query changes
  useEffect(() => {
    if (mode !== "searching") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/contacts/search?customerId=${encodeURIComponent(customerId)}&q=${encodeURIComponent(searchQuery)}`,
        );
        const data = await res.json();
        setSearchResults(data.stakeholders ?? []);
      } catch {
        setSearchResults([]);
      }
      setSearching(false);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, customerId, mode]);

  // Focus search input when entering search mode
  useEffect(() => {
    if (mode === "searching") {
      // Load all stakeholders immediately (empty query)
      searchInputRef.current?.focus();
    }
  }, [mode]);

  const handleLinkStakeholder = useCallback(
    async (stakeholder: Stakeholder) => {
      if (!assessmentId) return;
      setSaving(true);
      setError("");
      const result = await linkStakeholderToSite({
        assessmentId,
        siteId,
        tenantId,
        stakeholderId: stakeholder.id,
      });
      if (result.error) {
        setError(result.error);
      } else if (result.contact) {
        setContacts((prev) => [...prev, result.contact]);
        setMode("idle");
        setSearchQuery("");
        setSearchResults([]);
      }
      setSaving(false);
    },
    [assessmentId, siteId, tenantId],
  );

  const handleCreateNew = useCallback(async () => {
    if (!assessmentId || !newContact.name.trim()) return;
    setSaving(true);
    setError("");
    const result = await createStakeholderAndLinkToSite({
      assessmentId,
      siteId,
      tenantId,
      customerId,
      name: newContact.name.trim(),
      title: newContact.title.trim() || undefined,
      email: newContact.email.trim() || undefined,
      phone: newContact.phone.trim() || undefined,
    });
    if (result.error) {
      setError(result.error);
    } else if (result.contact) {
      setContacts((prev) => [...prev, result.contact]);
      setNewContact({ name: "", title: "", email: "", phone: "" });
      setMode("idle");
    }
    setSaving(false);
  }, [assessmentId, siteId, tenantId, customerId, newContact]);

  const handleUpdate = useCallback(
    async (contactId: string, field: string, value: string) => {
      setSaving(true);
      await updateSiteContact(contactId, { [field]: value });
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, [field]: value } : c)),
      );
      setSaving(false);
    },
    [],
  );

  const handleDelete = useCallback(async (contactId: string) => {
    setSaving(true);
    const result = await deleteSiteContact(contactId);
    if (result.success) {
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
    }
    setSaving(false);
  }, []);

  const cancelAdd = useCallback(() => {
    setMode("idle");
    setSearchQuery("");
    setSearchResults([]);
    setNewContact({ name: "", title: "", email: "", phone: "" });
    setError("");
  }, []);

  const inputCls =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-400";

  if (!assessment) {
    return (
      <p className="text-sm text-gray-400 py-4 text-center">
        Start an assessment to add site contacts.
      </p>
    );
  }

  // Filter out already-linked stakeholders from search results
  const linkedStakeholderIds = new Set(
    contacts.filter((c: any) => c.stakeholder_id).map((c: any) => c.stakeholder_id),
  );
  const filteredResults = searchResults.filter((s) => !linkedStakeholderIds.has(s.id));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCircle className="h-4 w-4 text-gray-400" />
          <h4 className="text-sm font-semibold text-gray-900">Key Site Team Members</h4>
          {saving && <span className="text-xs text-gray-400">Saving...</span>}
        </div>
        {!isLocked && mode === "idle" && (
          <button
            type="button"
            onClick={() => setMode("searching")}
            className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Contact
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</div>
      )}

      {/* Search / Create Contact Panel */}
      {mode === "searching" && (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search company contacts by name, title, or email..."
                className="w-full rounded-lg border border-gray-200 pl-9 pr-8 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
              />
              <button
                onClick={cancelAdd}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Search results */}
          <div className="max-h-60 overflow-y-auto">
            {searching ? (
              <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </div>
            ) : filteredResults.length > 0 ? (
              <ul>
                {filteredResults.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => handleLinkStakeholder(s)}
                      disabled={saving}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-start gap-3 disabled:opacity-50"
                    >
                      <UserCircle className="h-8 w-8 text-gray-300 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900">{s.name}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                          {s.title && <span>{s.title}</span>}
                          {s.email && <span>{s.email}</span>}
                          {s.phone && <span>{s.phone}</span>}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-4 py-3 text-sm text-gray-400">
                {searchQuery
                  ? "No matching contacts found"
                  : "No company contacts yet"}
              </div>
            )}
          </div>

          {/* Create new contact option */}
          <div className="border-t border-gray-100 p-2">
            <button
              type="button"
              onClick={() => {
                setNewContact({ name: searchQuery, title: "", email: "", phone: "" });
                setMode("creating");
              }}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-indigo-50 transition-colors flex items-center gap-2 text-sm text-indigo-600 font-medium"
            >
              <UserPlus className="h-4 w-4" />
              Create new contact{searchQuery ? ` "${searchQuery}"` : ""}
            </button>
          </div>
        </div>
      )}

      {/* Create new contact form */}
      {mode === "creating" && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-indigo-500" />
            <h4 className="text-sm font-medium text-indigo-700">
              New Company Contact
            </h4>
          </div>
          <p className="text-xs text-gray-500">
            This contact will be added to the company directory and linked to this site.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Name *"
              value={newContact.name}
              onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              className={inputCls}
              autoFocus
            />
            <input
              type="text"
              placeholder="Title"
              value={newContact.title}
              onChange={(e) => setNewContact({ ...newContact, title: e.target.value })}
              className={inputCls}
            />
            <input
              type="email"
              placeholder="Email"
              value={newContact.email}
              onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
              className={inputCls}
            />
            <input
              type="text"
              placeholder="Phone"
              value={newContact.phone}
              onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleCreateNew}
              disabled={!newContact.name.trim() || saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Create & Link
            </button>
            <button
              type="button"
              onClick={cancelAdd}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing contacts table */}
      {contacts.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase">
                <th className="text-left py-2 font-medium pl-2">Name</th>
                <th className="text-left py-2 font-medium">Title</th>
                <th className="text-left py-2 font-medium">Email</th>
                <th className="text-left py-2 font-medium">Phone</th>
                {!isLocked && <th className="w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {contacts.map((contact: any) => (
                <tr key={contact.id} className="group">
                  <td className="py-2 pl-2">
                    <div className="flex items-center gap-1.5">
                      {contact.is_primary && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                      {isLocked ? (
                        <span className="text-gray-900 font-medium">{contact.name}</span>
                      ) : (
                        <input
                          type="text"
                          defaultValue={contact.name}
                          className="border-none bg-transparent text-gray-900 font-medium text-sm p-0 focus:ring-0 w-full"
                          onBlur={(e) => {
                            if (e.target.value.trim() !== contact.name) {
                              handleUpdate(contact.id, "name", e.target.value.trim());
                            }
                          }}
                        />
                      )}
                    </div>
                  </td>
                  <td className="py-2">
                    {isLocked ? (
                      <span className="text-gray-600">{contact.title ?? "—"}</span>
                    ) : (
                      <input
                        type="text"
                        defaultValue={contact.title ?? ""}
                        placeholder="Title"
                        className="border-none bg-transparent text-gray-600 text-sm p-0 focus:ring-0 w-full placeholder:text-gray-300"
                        onBlur={(e) => {
                          if (e.target.value.trim() !== (contact.title ?? "")) {
                            handleUpdate(contact.id, "title", e.target.value.trim());
                          }
                        }}
                      />
                    )}
                  </td>
                  <td className="py-2">
                    {isLocked ? (
                      <span className="text-gray-600">{contact.email ?? "—"}</span>
                    ) : (
                      <input
                        type="email"
                        defaultValue={contact.email ?? ""}
                        placeholder="Email"
                        className="border-none bg-transparent text-gray-600 text-sm p-0 focus:ring-0 w-full placeholder:text-gray-300"
                        onBlur={(e) => {
                          if (e.target.value.trim() !== (contact.email ?? "")) {
                            handleUpdate(contact.id, "email", e.target.value.trim());
                          }
                        }}
                      />
                    )}
                  </td>
                  <td className="py-2">
                    {isLocked ? (
                      <span className="text-gray-600">{contact.phone ?? "—"}</span>
                    ) : (
                      <input
                        type="text"
                        defaultValue={contact.phone ?? ""}
                        placeholder="Phone"
                        className="border-none bg-transparent text-gray-600 text-sm p-0 focus:ring-0 w-full placeholder:text-gray-300"
                        onBlur={(e) => {
                          if (e.target.value.trim() !== (contact.phone ?? "")) {
                            handleUpdate(contact.id, "phone", e.target.value.trim());
                          }
                        }}
                      />
                    )}
                  </td>
                  {!isLocked && (
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(contact.id)}
                        className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : mode === "idle" ? (
        <p className="text-sm text-gray-400 py-4 text-center">
          No site contacts added yet. Add key personnel like the Engineering Manager, GM, etc.
        </p>
      ) : null}
    </div>
  );
}
