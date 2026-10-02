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
5. **Allow the redirect.** In Supabase, open Authentication → URL Configuration and add `http://localhost:3000/auth/callback` to the redirect URLs.
6. Run `npm install && npm run dev`.

To try collaboration, you need a second GitHub account, for example in a private window.

## Scripts

- `npm run dev` starts the dev server.
- `npm test` runs the unit tests (Vitest).
- `npm run lint` and `npm run build`.

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
