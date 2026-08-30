// Server Supabase client — used in Server Components, Route Handlers, and
// Server Actions. Reads/writes the auth cookie so the user's session
// carries through SSR.
import { createServerClient } from "@supabase/ssr";
import { createClient as createRawClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component that can't set cookies — safe to
            // ignore because middleware refreshes the session on every request.
          }
        },
      },
    }
  );
}

/**
 * Service-role client — bypasses Row Level Security entirely. ONLY use this
 * server-side, and ONLY for the ESP32 ingestion endpoint and the simulation
 * engine, both of which write data on behalf of devices/scenarios that have
 * no Supabase user session of their own. NEVER import this in a Client
 * Component or expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 */
export function createServiceRoleClient() {
  return createRawClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
