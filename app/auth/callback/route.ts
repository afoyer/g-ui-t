import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";

/**
 * GitHub → Supabase → here. Supabase only hands us the GitHub token once,
 * so we save it (and the profile) before redirecting into the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const origin = siteOrigin(request);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (!code) return NextResponse.redirect(`${origin}/login?error=missing_code`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) return NextResponse.redirect(`${origin}/login?error=exchange`);

  const { user, provider_token } = data.session;
  const meta = user.user_metadata ?? {};
  const login: string = meta.user_name ?? meta.preferred_username ?? user.email?.split("@")[0] ?? user.id;

  await supabase.from("profiles").upsert({
    id: user.id,
    github_login: login,
    name: meta.full_name ?? meta.name ?? null,
    avatar_url: meta.avatar_url ?? null,
  });
  if (provider_token) {
    await supabase
      .from("github_tokens")
      .upsert({ user_id: user.id, token: provider_token, updated_at: new Date().toISOString() });
  }

  return NextResponse.redirect(`${origin}${next}`);
}

function safeNext(next: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
