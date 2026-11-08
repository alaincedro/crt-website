// Supabase Edge Function "inbox": lets signed-in CRT team members read the
// hello@crt.rw / alain@crt.rw mailbox (Zoho Mail) from the admin dashboard.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN
//   ZOHO_ACCOUNTS_URL  (optional, default https://accounts.zoho.com)
//   ZOHO_MAIL_URL      (optional, default https://mail.zoho.com)
//
// Requests (POST, JSON, with the user's Supabase session token):
//   {action:"list", limit?:number, start?:number}   → recent inbox messages
//   {action:"read", folderId, messageId}            → one message's HTML content
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const ACCOUNTS = Deno.env.get("ZOHO_ACCOUNTS_URL") ?? "https://accounts.zoho.com";
const MAIL = Deno.env.get("ZOHO_MAIL_URL") ?? "https://mail.zoho.com";
let token: { value: string; expires: number } | null = null;
let accountId: string | null = null;
let inboxId: string | null = null;

async function zohoToken(): Promise<string> {
  if (token && Date.now() < token.expires) return token.value;
  const p = new URLSearchParams({
    refresh_token: Deno.env.get("ZOHO_REFRESH_TOKEN") ?? "",
    client_id: Deno.env.get("ZOHO_CLIENT_ID") ?? "",
    client_secret: Deno.env.get("ZOHO_CLIENT_SECRET") ?? "",
    grant_type: "refresh_token",
  });
  const r = await fetch(`${ACCOUNTS}/oauth/v2/token?${p}`, { method: "POST" });
  const d = await r.json();
  if (!d.access_token) throw new Error("Zoho sign-in failed: " + (d.error ?? r.status));
  token = { value: d.access_token, expires: Date.now() + ((d.expires_in ?? 3600) - 120) * 1000 };
  return token.value;
}

async function zoho(path: string) {
  const r = await fetch(`${MAIL}${path}`, { headers: { Authorization: `Zoho-oauthtoken ${await zohoToken()}` } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = d?.data?.errorCode ?? d?.status?.description ?? r.statusText;
    throw new Error(`Zoho Mail API ${r.status}: ${msg}`);
  }
  return d.data;
}

async function ids() {
  if (!accountId) {
    const accounts = await zoho("/api/accounts");
    accountId = String(accounts?.[0]?.accountId ?? "");
    if (!accountId) throw new Error("No Zoho mail account found");
  }
  if (!inboxId) {
    const folders = await zoho(`/api/accounts/${accountId}/folders`);
    const inbox = (folders ?? []).find((f: any) => (f.folderType ?? f.folderName)?.toLowerCase() === "inbox");
    inboxId = String(inbox?.folderId ?? "");
  }
  return { accountId, inboxId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Only signed-in members of the CRT team may read mail.
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return json({ error: "Not signed in" }, 401);
  const { data: member } = await sb.from("team").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!member) return json({ error: "Not on the team list" }, 403);

  if (!Deno.env.get("ZOHO_REFRESH_TOKEN")) return json({ error: "not_connected" }, 503);

  try {
    const body = await req.json().catch(() => ({}));
    const { accountId, inboxId } = await ids();
    if (body.action === "read") {
      const folderId = String(body.folderId ?? "").replace(/\D/g, "");
      const messageId = String(body.messageId ?? "").replace(/\D/g, "");
      if (!folderId || !messageId) return json({ error: "Missing message" }, 400);
      const content = await zoho(`/api/accounts/${accountId}/folders/${folderId}/messages/${messageId}/content`);
      return json({ html: content?.content ?? "" });
    }
    const limit = Math.min(Math.max(Number(body.limit) || 50, 1), 100);
    const start = Math.max(Number(body.start) || 1, 1);
    const q = new URLSearchParams({ limit: String(limit), start: String(start), sortorder: "false" });
    if (inboxId) q.set("folderId", inboxId);
    const list = await zoho(`/api/accounts/${accountId}/messages/view?${q}`);
    const messages = (list ?? []).map((m: any) => ({
      messageId: String(m.messageId), folderId: String(m.folderId),
      from: m.sender ?? m.fromAddress ?? "", fromAddress: m.fromAddress ?? "",
      to: m.toAddress ?? "", subject: m.subject ?? "(no subject)", summary: m.summary ?? "",
      received: Number(m.receivedTime) || null, unread: String(m.status) === "0",
      hasAttachment: String(m.hasAttachment) === "1",
    }));
    return json({ messages });
  } catch (e) {
    return json({ error: String((e as Error).message ?? e) }, 502);
  }
});
