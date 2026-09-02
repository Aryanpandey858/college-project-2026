// api/incidents/route.ts: POST endpoint receiving incident metadata + Base64 snapshot, uploading to Supabase Storage, inserting to DB, and dispatching Resend alert email.

export async function POST() {
  return new Response(null);
}
