"use client";

import { useCallback } from "react";
import type {
  BaselineFormState,
  BaselineFormAction,
  ContactData,
} from "../../../../../../lib/baseline-form/types";
import { emptyContact } from "../../../../../../lib/baseline-form/defaults";
import { upsertBaselineContact, deleteBaselineContact } from "../../../../../../lib/actions/baseline-form";
import { useAutoSave } from "../../../../../../lib/hooks/use-auto-save";
import { Input } from "../../../../../../components/ui/input";
import { Button } from "../../../../../../components/ui/button";

interface SectionProps {
  state: BaselineFormState;
  dispatch: React.Dispatch<BaselineFormAction>;
  token: string;
  profileId: string;
}

export function ContactSection({ state, dispatch, token, profileId }: SectionProps) {
  const { save, status } = useAutoSave(
    async (payload: { index: number; contact: ContactData }) => {
      const result = await upsertBaselineContact(token, profileId, payload.contact);
      if (result && "id" in result && result.id && !payload.contact.id) {
        dispatch({
          type: "UPDATE_CONTACT",
          index: payload.index,
          contact: { ...payload.contact, id: result.id as string },
        });
      }
      if (result && "error" in result) return { error: result.error as string };
    },
    { debounceMs: 600 }
  );

  const handleFieldChange = useCallback(
    (index: number, field: keyof ContactData, value: string) => {
      const updated = { ...state.contacts[index]!, [field]: value };
      dispatch({ type: "UPDATE_CONTACT", index, contact: updated });
      save({ index, contact: updated });
    },
    [state.contacts, dispatch, save]
  );

  const handleAddContact = useCallback(() => {
    dispatch({ type: "ADD_CONTACT" });
  }, [dispatch]);

  const handleRemoveContact = useCallback(
    async (index: number) => {
      const contact = state.contacts[index];
      if (contact?.id) {
        await deleteBaselineContact(token, profileId, contact.id);
      }
      dispatch({ type: "REMOVE_CONTACT", index });
    },
    [state.contacts, token, profileId, dispatch]
  );

  const contacts = state.contacts.length > 0 ? state.contacts : [{ ...emptyContact, is_primary: true }];

  // If state has no contacts, initialize with one
  if (state.contacts.length === 0) {
    dispatch({ type: "ADD_CONTACT" });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Contact Information</h3>
          <p className="text-sm text-gray-500 mt-1">
            Who should we reach out to about this facility?
          </p>
        </div>
        {status === "saving" && (
          <span className="text-xs text-gray-400">Saving...</span>
        )}
        {status === "saved" && (
          <span className="text-xs text-green-600">Saved</span>
        )}
        {status === "error" && (
          <span className="text-xs text-red-600">Save failed</span>
        )}
      </div>

      {contacts.map((contact, index) => (
        <div
          key={contact.id || `new-${index}`}
          className="border border-gray-200 rounded-xl p-5 bg-white space-y-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {index === 0 ? "Primary Contact" : `Contact ${index + 1}`}
            </span>
            {index > 0 && (
              <button
                type="button"
                onClick={() => handleRemoveContact(index)}
                className="text-sm text-gray-400 hover:text-red-600 transition-colors"
              >
                Remove
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              placeholder="Jane Smith"
              value={contact.name}
              onChange={(e) => handleFieldChange(index, "name", e.target.value)}
              onBlur={() => save({ index, contact })}
            />
            <Input
              label="Title / Role"
              placeholder="Refrigeration Manager"
              value={contact.title}
              onChange={(e) => handleFieldChange(index, "title", e.target.value)}
              onBlur={() => save({ index, contact })}
            />
            <Input
              label="Email"
              type="email"
              placeholder="jane@company.com"
              value={contact.email}
              onChange={(e) => handleFieldChange(index, "email", e.target.value)}
              onBlur={() => save({ index, contact })}
            />
            <Input
              label="Phone"
              type="tel"
              placeholder="(555) 123-4567"
              value={contact.phone}
              onChange={(e) => handleFieldChange(index, "phone", e.target.value)}
              onBlur={() => save({ index, contact })}
            />
          </div>
        </div>
      ))}

      <Button
        variant="outline"
        size="md"
        type="button"
        onClick={handleAddContact}
        className="w-full border-dashed"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Contact
      </Button>
    </div>
  );
}
