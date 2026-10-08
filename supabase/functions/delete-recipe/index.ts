import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // or "https://<your-user>.github.io"
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeaders });

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
const GITHUB_REPO = Deno.env.get("GITHUB_REPO")!;
const GITHUB_BRANCH = Deno.env.get("GITHUB_BRANCH") ?? "main";

async function github(path: string, init: RequestInit = {}) {
  return fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST" && req.method !== "DELETE") {
    return json({ error: "Method not allowed" }, 405);
  }

  // 1. Authenticate user from JWT
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return json({ error: "Unauthorized" }, 401);
  }

  // 2. Validate input
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const id = payload.id;
  if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id)) {
    return json({ error: "Invalid id" }, 400);
  }

  const path = `recipes/${id}.md`;

  // 3. Get current SHA (required by GitHub to delete a file)
  const existing = await github(`${path}?ref=${GITHUB_BRANCH}`);
  if (existing.status === 404) {
    return json({ error: "Recipe not found", id }, 404);
  }
  if (!existing.ok) {
    return json({ error: "GitHub error", details: await existing.text() }, 502);
  }
  const { sha } = await existing.json();

  // 4. Commit deletion
  const res = await github(path, {
    method: "DELETE",
    body: JSON.stringify({
      message: `Delete ${id} via editor (${user.email})`,
      sha,
      branch: GITHUB_BRANCH,
    }),
  });

  if (!res.ok) {
    return json({ error: "GitHub error", details: await res.text() }, 502);
  }
  const result = await res.json();
  return json({ ok: true, id, commit: result.commit?.sha });
});

/* To invoke locally:

  1. Run `supabase start` and `supabase functions serve delete-recipe`
  2. Make an HTTP request with a user access token:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/delete-recipe' \
    --header 'Authorization: Bearer <USER_ACCESS_TOKEN>' \
    --header 'Content-Type: application/json' \
    --data '{"id":"amaretto-sour"}'
*/