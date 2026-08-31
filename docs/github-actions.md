# GitHub Actions

OurFilm uses two workflows to keep application and database changes repeatable.

## Pull request checks

`CI` runs on every pull request, every push to `main`, and on manual dispatch.
It has two independent jobs:

- `Format, lint, test, and build` runs Prettier, TypeScript, ESLint, unit tests,
  and the production build.
- `Migrations, generated types, and DB tests` starts an isolated local Supabase
  stack, rebuilds the database from every committed migration, compares the
  generated TypeScript types with the committed file, and runs the database
  integration tests.

The type comparison ignores only Supabase's environment-specific PostgREST
version marker. Tables, columns, relationships, functions, enums, and all other
generated schema details must match exactly.

The pull request workflow does not use production secrets or production data.
It also verifies that a clean database receives every API-role privilege from
versioned migrations instead of relying on grants left behind in one project.

## Production migrations

`Supabase production migration` runs after a migration is merged to `main`.
It can also be started with `workflow_dispatch`. The job uses the GitHub
environment named `production`, previews the pending migrations, applies them,
and confirms that the committed database types match the resulting schema.

Configure the `production` environment in GitHub before merging a migration:

| Kind                 | Name                    | Value                                 |
| -------------------- | ----------------------- | ------------------------------------- |
| Environment variable | `SUPABASE_PROJECT_REF`  | Production Supabase project reference |
| Environment secret   | `SUPABASE_ACCESS_TOKEN` | Supabase personal access token        |
| Environment secret   | `SUPABASE_DB_PASSWORD`  | Production database password          |

Add a required reviewer to the `production` environment. This leaves the
repetitive commands to GitHub while preserving an explicit approval before a
forward-only production schema change.

Do not add Supabase service-role or application runtime keys to this workflow.
Database integration tests run against the disposable local stack in `CI`.
