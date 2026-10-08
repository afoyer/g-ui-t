# G-ui-t

Design together without learning Git. A proof-of-concept built from the G-ui-t mockups (directions 1a + 1b).

| G-ui-t says | Git does |
|---|---|
| Current | `main` (the default branch) |
| Start Change | create a branch |
| Checkpoint (auto-saved after 20s idle) | commit |
| Share for Review | open a pull request |
| Approve / Request changes | pull-request review |
| Add to Current | merge the pull request |
| Restore | new commit with an older tree (history kept) |

Every project is a private GitHub repo under the creator's account. Supabase stores app data (projects, Changes, pinned comments, reviews, activity) and pushes live updates. Sandpack runs the editor and live preview in the browser.

## Setup

1. **Supabase.** Create a project, then copy `.env.local.example` to `.env.local` and fill in the project URL and anon key.
2. **Database.** In the Supabase SQL editor, run `supabase/migrations/0001_init.sql`, then `0002_member_management.sql`, in that order.
3. **GitHub OAuth app.** Go to GitHub, then Settings → Developer settings → OAuth Apps → New.
   - Homepage URL: `http://localhost:3000`
   - Callback URL: `https://<your-project>.supabase.co/auth/v1/callback`
4. **Enable GitHub sign-in.** In Supabase, open Authentication → Sign In / Providers → GitHub, enable it, and paste the client ID and secret.
5. **Allow the redirect.** In Supabase, open Authentication → URL Configuration. Set **Site URL** to where the app lives (for example `https://g-ui-t.vercel.app`), and add `<that URL>/auth/callback` plus `http://localhost:3000/auth/callback` to **Redirect URLs**. If the URL isn't on that list, Supabase quietly sends people to the Site URL instead. When deployed, also set `NEXT_PUBLIC_SITE_URL` on your host.
6. Run `npm install && npm run dev`.

To try collaboration, you need a second GitHub account, for example in a private window.

## Scripts

- `npm run dev` starts the dev server.
- `npm test` runs the unit tests (Vitest).
- `npm run lint` and `npm run build`.
- `npm run link` starts the local companion (see below).

## Local folder + Claude Code (experimental)

You can open a Change as a real folder on your computer and run [Claude Code](https://docs.claude.com/en/docs/claude-code) in a terminal inside the workspace. It only works locally. The companion app lives in `link/`, is not published, and runs from this repo.

1. Install the companion once: `npm install --prefix link`.
2. Make sure your machine can clone the project's repo (for example `gh auth login`), and that the `claude` CLI is installed.
3. Start it with `npm run dev` and, in a second terminal, `npm run link`. It prints a pairing code.
4. In a Change, click **Open on my computer** and paste the code.

- Each Change gets its own clone in `~/G-ui-t/<repo>@<branch>`.
- Edits sync both ways: browser edits are written to disk, and edits from VS Code or Claude show up in the editor and preview. Either way, they become Checkpoints through the usual autosave. After each save, the clone's HEAD is moved to the new commit, so `git status` stays clean.
- The **Claude** tab next to **Code** opens a shell in that folder and starts `claude`. If `claude` isn't installed, you still get a plain shell.
- The companion only listens on `127.0.0.1:47321`. It only accepts connections from `http://localhost:3000` (add more with `npm run link -- --origin <url>`) that also carry the pairing code.
- The link is hidden in production builds unless `NEXT_PUBLIC_LOCAL_LINK=1` is set.
- Running Claude in the cloud (no install) is coming soon.
- Files deleted on disk disappear from the editor, but the deletion isn't committed yet.

## Layout

- `app/(shell)` holds the sidebar screens: Home, Projects, Reviews, Activity, and Project Overview / Changes / People / History.
- `app/(focus)` holds the full-window screens: New Project, Join, the Change workspace, Review, Preview and Compare.
- `lib/github/repo.ts` contains all GitHub operations.
- `lib/overlap.ts` detects when two people are editing the same component.
- `templates/` has the starter files for Prototype, Website and Blank.
- `supabase/migrations` has the schema and row-level security.

## Known limits

- GitHub events that happen outside the app, such as a direct `git push`, show up on the next page load, not live.
- There is no merge-conflict UI. Conflicts show a message that points to GitHub.
- Web app and Component library project types are not supported yet, because Sandpack can't run Next.js or Storybook.
