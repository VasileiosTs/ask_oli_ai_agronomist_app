# Supabase Backend Scaffold

This folder scaffolds the backend described in `Oli_Master_V1_Build_Pack_v3.pdf`.

What is included:

- SQL migrations for the core app schema
- RLS policies, storage bucket setup, views, and RPCs
- A first-pass `chat` edge function scaffold
- A compatibility layer for this frontend's current `chat_messages` table name

Notable compatibility choices:

- The PDF uses a canonical `messages` table. This repo already hardcodes `chat_messages`, so the migration keeps `chat_messages` as the real table and exposes a `messages` view for backend compatibility.
- The current frontend calls `resolve_field(p_user_id, p_mention)`. The PDF text used `p_text`; the migration keeps `p_mention` so the existing app does not break.
- The current frontend still inserts legacy `interventions.problem`, `interventions.product`, and `interventions.date`. The schema includes both legacy and canonical columns and keeps them in sync with a trigger.

Suggested setup flow:

1. Install the Supabase CLI.
2. Link this repo to your Supabase project.
3. Push the migrations.
4. Set edge-function secrets.
5. Deploy the `chat` function.

Typical commands:

```bash
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
supabase secrets set \
  GEMINI_API_KEY=... \
  SUPABASE_URL=... \
  SUPABASE_ANON_KEY=... \
  SUPABASE_SERVICE_ROLE_KEY=...
supabase functions deploy chat
```

Local development:

```bash
supabase start
supabase db reset
supabase functions serve chat --env-file ./supabase/.env.local
```

Current limitation:

Authenticated chat in `src/` is now wired to the `chat` edge function, but guest mode still falls back to the existing local Gemini helper path because the edge function requires a signed-in user for RLS, usage limits, and persistence.
