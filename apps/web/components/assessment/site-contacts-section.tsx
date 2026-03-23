"use client";

import { useState, useCallback } from "react";
import { addSiteContact, updateSiteContact, deleteSiteContact } from "../../lib/actions/assessment";
import { Plus, Trash2, UserCircle, Star } from "lucide-react";

interface SiteContactsSectionProps {
  assessment: any;
  siteContacts: any[];
  siteId: string;
  tenantId: string;
  isLocked: boolean;
}

export function SiteContactsSection({
  assessment,
  siteContacts: initialContacts,
  siteId,
  tenantId,
  isLocked,
}: SiteContactsSectionProps) {
  const [contacts, setContacts] = useState(initialContacts);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", title: "", email: "", phone: "" });

  const assessmentId = assessment?.id;

  const handleAdd = useCallback(async () => {
    if (!assessmentId || !newContact.name.trim()) return;
    setSaving(true);
    const result = await addSiteContact({
      assessmentId,
      siteId,
      tenantId,
      name: newContact.name.trim(),
      title: newContact.title.trim() || undefined,
      email: newContact.email.trim() || undefined,
      phone: newContact.phone.trim() || undefined,
    });
    if (result.contact) {
      setContacts((prev) => [...prev, result.contact]);
      setNewContact({ name: "", title: "", email: "", phone: "" });
      setAdding(false);
    }
    setSaving(false);
  }, [assessmentId, siteId, tenantId, newContact]);

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

  const inputCls =
    "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400 disabled:bg-gray-50 disabled:text-gray-400";

  if (!assessment) {
    return (
      <p className="text-sm text-gray-400 py-4 text-center">
        Start an assessment to add site contacts.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCircle className="h-4 w-4 text-gray-400" />
          <h4 className="text-sm font-semibold text-gray-900">Key Site Team Members</h4>
          {saving && <span className="text-xs text-gray-400">Saving...</span>}
        </div>
        {!isLocked && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Contact
          </button>
        )}
      </div>

      {contacts.length > 0 || adding ? (
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

              {/* Add row */}
              {adding && (
                <tr className="bg-gray-50/50">
                  <td className="py-2 pl-2">
                    <input type="text" placeholder="Name *" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} className={inputCls} autoFocus />
                  </td>
                  <td className="py-2 px-1">
                    <input type="text" placeholder="Title" value={newContact.title} onChange={(e) => setNewContact({ ...newContact, title: e.target.value })} className={inputCls} />
                  </td>
                  <td className="py-2 px-1">
                    <input type="email" placeholder="Email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} className={inputCls} />
                  </td>
                  <td className="py-2 px-1">
                    <input type="text" placeholder="Phone" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} className={inputCls} />
                  </td>
                  <td className="py-2 text-right px-1">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={handleAdd} disabled={!newContact.name.trim() || saving} className="rounded bg-gray-900 px-2 py-1 text-xs text-white hover:bg-gray-800 disabled:opacity-50">
                        Save
                      </button>
                      <button type="button" onClick={() => { setAdding(false); setNewContact({ name: "", title: "", email: "", phone: "" }); }} className="rounded px-2 py-1 text-xs text-gray-500 hover:text-gray-700">
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-400 py-4 text-center">
          No site contacts added yet. Add key personnel like the Engineering Manager, GM, etc.
        </p>
      )}
    </div>
  );
}
