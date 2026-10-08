import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding/base64";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // or "https://<your-user>.github.io"
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: corsHeaders });

const GITHUB_TOKEN = Deno.env.get("GITHUB_TOKEN")!;
const GITHUB_REPO = Deno.env.get("GITHUB_REPO")!;
const GITHUB_BRANCH = Deno.env.get("GITHUB_BRANCH") ?? "main";

function toMarkdown(frontmatter: Record<string, string>, body: string) {
  const yaml = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`) // JSON strings are valid YAML
    .join("\n");
  return `---\n${yaml}\n---\n\n${body.trim()}\n`;
}

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
  };
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  };

  // 1. Authenticate user from JWT
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return json({ error: "Unauthorized" }, 401);
  };

  // 2. Validate input
  const { id, frontmatter, body } = await req.json();
  if (typeof id !== "string" || !/^[a-z0-9-]+$/.test(id)) {
    return json({ error: "Invalid id" }, 400);
  }
  if (typeof body !== "string" || typeof frontmatter !== "object" || frontmatter === null) {
    return json({ error: "Invalid payload" }, 400);
  }

  const path = `recipes/${id}.md`;

  // 3. Get current SHA (required by GitHub to update an existing file)
  const existing = await github(`${path}?ref=${GITHUB_BRANCH}`);
  const sha = existing.ok ? (await existing.json()).sha : undefined;

  // 4. Commit
  const content = encodeBase64(new TextEncoder().encode(toMarkdown(frontmatter, body))); // UTF-8 safe (æøå)
  const res = await github(path, {
    method: "PUT",
    body: JSON.stringify({
      message: `Update ${id} via editor (${user.email})`,
      content,
      sha,
      branch: GITHUB_BRANCH,
    }),
  });

  if (!res.ok) return json({ error: "GitHub error", details: await res.text() }, 502);
  const result = await res.json();
  return json({ ok: true, commit: result.commit?.sha });
});

/* To invoke locally:

  1. Run `supabase start` and `supabase functions serve save-recipe`
  2. Make an HTTP request with a user access token:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/save-recipe' \
    --header 'Authorization: Bearer <USER_ACCESS_TOKEN>' \
    --header 'Content-Type: application/json' \
    --data '{"id":"amaretto-sour","frontmatter":{"category":"drinker","title":"Amaretto sour"},"body":"# Amaretto sour"}'
*/

// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
// import "@supabase/functions-js/edge-runtime.d.ts";
// import { withSupabase } from "@supabase/server";

// console.log("Hello from Functions!");

// // This endpoint uses 'publishable' | 'secret' access, apiKey is required.
// // Use publishable for Client-facing, key-validated endpoints
// // Use secret for Server-to-server, internal calls
// export default {
//   fetch: withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
//     // Called by another service with a secret key
//     // ctx.supabaseAdmin bypasses RLS — use for privileged operations
//     /*
//     if (ctx.authMode === "secret") {
//       const { user_id } = await req.json();
//       const { data } = await ctx.supabaseAdmin.auth.admin.getUserById(user_id);

//       return Response.json({
//         email: data?.user?.email,
//       });
//     }
//     */

//     const { name } = await req.json();

//     return Response.json({
//       message: `Hello ${name}!`,
//     });
//   }),
// };

// /* To invoke locally:

//   1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
//   2. Make an HTTP request:

//   curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/save-recipe' \
//     --header 'apiKey: sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' \
//     --data '{"name":"Functions"}'

// */
