import postgres from "postgres";

// biome-ignore lint/style/noProcessEnv: migration script reads connection string from env
const connectionString = process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error("POSTGRES_URL is required to apply tree triggers.");
}

const sql = postgres(connectionString, {
  max: 1,
  prepare: false,
});

const triggerSql = `
create or replace function tree_edge_validate_before_fn()
returns trigger
language plpgsql
as $$
declare
  child_user_id text;
  child_node_type tree_node_type;
  parent_user_id text;
  parent_node_type tree_node_type;
  prev_user_id text;
  prev_parent_node_id uuid;
  next_user_id text;
  next_parent_node_id uuid;
begin
  if new.node_id = new.parent_node_id then
    raise exception 'tree_edge: node cannot be its own parent';
  end if;

  select n.user_id, n.node_type
    into child_user_id, child_node_type
  from tree_node n
  where n.id = new.node_id;

  if child_user_id is null then
    raise exception 'tree_edge: node_id does not reference an existing tree_node';
  end if;

  if child_user_id <> new.user_id then
    raise exception 'tree_edge: node user_id mismatch';
  end if;

  if new.parent_node_id is not null then
    select n.user_id, n.node_type
      into parent_user_id, parent_node_type
    from tree_node n
    where n.id = new.parent_node_id;

    if parent_user_id is null then
      raise exception 'tree_edge: parent_node_id does not reference an existing tree_node';
    end if;

    if parent_user_id <> new.user_id then
      raise exception 'tree_edge: parent node user_id mismatch';
    end if;

    if parent_node_type <> 'folder' then
      raise exception 'tree_edge: parent_node_id must reference a folder node';
    end if;
  end if;

  if new.prev_edge_id is not null then
    select e.user_id, e.parent_node_id
      into prev_user_id, prev_parent_node_id
    from tree_edge e
    where e.id = new.prev_edge_id;

    if prev_user_id is null then
      raise exception 'tree_edge: prev_edge_id does not reference an existing edge';
    end if;

    if prev_user_id <> new.user_id then
      raise exception 'tree_edge: prev edge user_id mismatch';
    end if;

    if prev_parent_node_id is distinct from new.parent_node_id then
      raise exception 'tree_edge: prev edge parent mismatch';
    end if;
  end if;

  if new.next_edge_id is not null then
    select e.user_id, e.parent_node_id
      into next_user_id, next_parent_node_id
    from tree_edge e
    where e.id = new.next_edge_id;

    if next_user_id is null then
      raise exception 'tree_edge: next_edge_id does not reference an existing edge';
    end if;

    if next_user_id <> new.user_id then
      raise exception 'tree_edge: next edge user_id mismatch';
    end if;

    if next_parent_node_id is distinct from new.parent_node_id then
      raise exception 'tree_edge: next edge parent mismatch';
    end if;
  end if;

  if child_node_type = 'folder' and new.parent_node_id is not null then
    if exists (
      with recursive ancestors as (
        select e.parent_node_id
        from tree_edge e
        where e.user_id = new.user_id
          and e.node_id = new.parent_node_id

        union all

        select e.parent_node_id
        from tree_edge e
        inner join ancestors a
          on e.node_id = a.parent_node_id
        where e.user_id = new.user_id
          and a.parent_node_id is not null
      )
      select 1
      from ancestors
      where parent_node_id = new.node_id
      limit 1
    ) then
      raise exception 'tree_edge: folder move would create a cycle';
    end if;
  end if;

  return new;
end;
$$;

create or replace function tree_edge_validate_links_deferred_fn()
returns trigger
language plpgsql
as $$
declare
  prev_next_edge_id uuid;
  next_prev_edge_id uuid;
begin
  if new.prev_edge_id is not null then
    select e.next_edge_id
      into prev_next_edge_id
    from tree_edge e
    where e.id = new.prev_edge_id;

    if prev_next_edge_id is distinct from new.id then
      raise exception 'tree_edge: prev edge does not point back via next_edge_id';
    end if;
  end if;

  if new.next_edge_id is not null then
    select e.prev_edge_id
      into next_prev_edge_id
    from tree_edge e
    where e.id = new.next_edge_id;

    if next_prev_edge_id is distinct from new.id then
      raise exception 'tree_edge: next edge does not point back via prev_edge_id';
    end if;
  end if;

  return new;
end;
$$;

create or replace function tree_edge_detach_before_delete_fn()
returns trigger
language plpgsql
as $$
begin
  if old.prev_edge_id is not null then
    update tree_edge
    set next_edge_id = old.next_edge_id
    where id = old.prev_edge_id;
  end if;

  if old.next_edge_id is not null then
    update tree_edge
    set prev_edge_id = old.prev_edge_id
    where id = old.next_edge_id;
  end if;

  return old;
end;
$$;

drop trigger if exists tree_edge_validate_before_trigger on tree_edge;
create trigger tree_edge_validate_before_trigger
before insert or update
on tree_edge
for each row
execute function tree_edge_validate_before_fn();

drop trigger if exists tree_edge_validate_links_deferred_trigger on tree_edge;
create constraint trigger tree_edge_validate_links_deferred_trigger
after insert or update
on tree_edge
deferrable initially deferred
for each row
execute function tree_edge_validate_links_deferred_fn();

drop trigger if exists tree_edge_detach_before_delete_trigger on tree_edge;
create trigger tree_edge_detach_before_delete_trigger
before delete
on tree_edge
for each row
execute function tree_edge_detach_before_delete_fn();
`;

async function main() {
  try {
    await sql.unsafe(triggerSql);
  } finally {
    await sql.end();
  }
}

await main();
