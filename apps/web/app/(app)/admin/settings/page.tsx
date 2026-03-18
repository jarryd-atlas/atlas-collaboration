import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import { Save, Globe, Bell, Shield, Palette } from "lucide-react";

export default function AdminSettingsPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage organization and application settings.</p>
      </div>

      {/* Organization */}
      <SettingsSection
        icon={<Globe className="h-5 w-5" />}
        title="Organization"
        description="General organization settings."
      >
        <Input id="org-name" label="Organization Name" defaultValue="CrossnoKaye" />
        <Input id="org-domain" label="Primary Domain" defaultValue="crossnokaye.com" disabled />
        <Input
          id="app-url"
          label="Application URL"
          defaultValue="collaboration.crossnokaye.com"
          disabled
        />
      </SettingsSection>

      {/* Branding */}
      <SettingsSection
        icon={<Palette className="h-5 w-5" />}
        title="Branding"
        description="Customize the look of customer portals."
      >
        <Input id="brand-logo" label="Logo URL" placeholder="https://..." />
        <div className="grid grid-cols-2 gap-4">
          <Input id="brand-primary" label="Primary Color" type="color" defaultValue="#91E100" />
          <Input id="brand-dark" label="Dark Color" type="color" defaultValue="#222222" />
        </div>
      </SettingsSection>

      {/* Notifications */}
      <SettingsSection
        icon={<Bell className="h-5 w-5" />}
        title="Notifications"
        description="Configure email notification defaults."
      >
        <div className="space-y-3">
          <ToggleSetting label="Email on new flagged issues" defaultChecked />
          <ToggleSetting label="Email on milestone completion" defaultChecked />
          <ToggleSetting label="Email on comment mentions" defaultChecked />
          <ToggleSetting label="Weekly digest for customers" />
        </div>
      </SettingsSection>

      {/* Security */}
      <SettingsSection
        icon={<Shield className="h-5 w-5" />}
        title="Security"
        description="Authentication and access control."
      >
        <div className="space-y-3">
          <ToggleSetting label="Require Google OAuth for CK team" defaultChecked />
          <ToggleSetting label="Auto-approve users from known customer domains" />
          <ToggleSetting label="Allow customer admins to invite their team" defaultChecked />
        </div>
      </SettingsSection>

      {/* Save */}
      <div className="flex justify-end pt-4 border-t border-gray-100">
        <Button>
          <Save className="h-4 w-4" /> Save Changes
        </Button>
      </div>
    </div>
  );
}

function SettingsSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card p-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-gray-400">{icon}</span>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      </div>
      <p className="text-sm text-gray-500 mb-5">{description}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ToggleSetting({
  label,
  defaultChecked,
}: {
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-gray-300 text-brand-green focus:ring-brand-green"
      />
    </label>
  );
}
