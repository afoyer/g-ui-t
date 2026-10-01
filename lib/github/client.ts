import "server-only";
import { Octokit } from "octokit";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** An Octokit acting as the signed-in user, using the token saved at sign-in. */
export async function getOctokit() {
  const supabase = await createClient();
  const { data } = await supabase.from("github_tokens").select("token").maybeSingle();
  if (!data?.token) redirect("/login?reason=github");
  return new Octokit({ auth: data.token });
}
