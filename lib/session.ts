import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

/** The signed-in user's profile; redirects to /login if there isn't one. */
export const requireUser = cache(async (): Promise<Profile> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
  if (!profile) redirect("/login?reason=profile");
  return profile as Profile;
});
