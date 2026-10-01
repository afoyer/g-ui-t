import { SignInButton } from "./sign-in-button";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, reason, error } = await searchParams;
  return (
    <main className="flex h-full items-center justify-center bg-[#ecebe8] px-4">
      <div className="w-full max-w-[380px] rounded-[10px] border border-[#d6d6d3] bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,.05),0_14px_36px_rgba(0,0,0,.08)]">
        <div className="mb-6 flex items-center gap-2">
          <span className="h-[22px] w-[22px] rounded-[6px] bg-ink" />
          <b className="text-[15px] font-semibold">G-ui-t</b>
        </div>
        <h1 className="text-[20px] font-semibold tracking-[-0.01em]">Design together, without the Git</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">
          Work on your own copy, share it for review, and add it to the version everyone shares. We handle the
          GitHub part.
        </p>
        {(reason || error) && (
          <p className="mt-4 rounded-[6px] bg-note px-3 py-2 text-[12px] text-note-ink">
            {reason === "github"
              ? "Please sign in again so we can reach GitHub for you."
              : "Sign-in didn't finish. Please try again."}
          </p>
        )}
        <SignInButton next={typeof next === "string" ? next : "/"} />
        <p className="mt-4 text-center">
          <span className="git-hint">OAuth scopes: repo, read:user, user:email</span>
        </p>
      </div>
    </main>
  );
}
