import { requireSession } from "../../../lib/supabase/server";
import { getAllSiteContacts } from "../../../lib/data/queries";
import { redirect } from "next/navigation";
import { ContactsClient } from "./contacts-client";

export default async function ContactsPage() {
  const { claims } = await requireSession();
  if (claims.tenantType !== "internal") {
    redirect("/");
  }

  const contacts = await getAllSiteContacts();

  return <ContactsClient contacts={contacts} />;
}
