-- Let the project owner manage the team: change roles, remove people,
-- and withdraw invites. Anyone can leave a project themselves.

create function public.is_owner(p uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from projects where id = p and owner_id = auth.uid())
$$;

create policy "owner changes roles" on public.project_members for update to authenticated
  using (is_owner(project_id)) with check (is_owner(project_id));

create policy "owner removes members, members leave" on public.project_members for delete to authenticated
  using ((is_owner(project_id) and user_id <> auth.uid()) or (user_id = auth.uid() and not is_owner(project_id)));

create policy "owner withdraws invites" on public.invites for delete to authenticated
  using (is_owner(project_id));
