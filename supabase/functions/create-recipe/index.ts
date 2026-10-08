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

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip remaining diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toMarkdown(frontmatter: Record<string, string>, body: string) {
  const yaml = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`) // JSON strings are valid YAML
    .join("\n");
  return `---\n${yaml}\n---\n\n${body.trim()}\n`;
}

function template(title: string) {
  return `# ${title}

## Ingredienser
- 

## Fremgangsmåte
1. 
`;
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

const optionalString = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
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

  const title = optionalString(payload.title);
  const category = optionalString(payload.category);
  const subcategory = optionalString(payload.subcategory);
  const source = optionalString(payload.source);

  if (!title || !category) {
    return json({ error: "title and category are required" }, 400);
  }

  const id = slugify(title);
  if (!id) {
    return json({ error: "Title must contain at least one letter or digit" }, 400);
  }

  const path = `recipes/${id}.md`;

  // 3. Make sure the recipe doesn't already exist
  const existing = await github(`${path}?ref=${GITHUB_BRANCH}`);
  if (existing.ok) {
    return json({ error: "Recipe already exists", id }, 409);
  }
  if (existing.status !== 404) {
    return json({ error: "GitHub error", details: await existing.text() }, 502);
  }

  // 4. Build file
  const frontmatter: Record<string, string> = { category, title };
  if (subcategory) frontmatter.subcategory = subcategory;
  if (source) frontmatter.source = source;

  const content = encodeBase64(
    new TextEncoder().encode(toMarkdown(frontmatter, template(title))),
  ); // UTF-8 safe (æøå)

  // 5. Commit (no sha => create only)
  const res = await github(path, {
    method: "PUT",
    body: JSON.stringify({
      message: `Create ${id} via editor (${user.email})`,
      content,
      branch: GITHUB_BRANCH,
    }),
  });

  if (!res.ok) {
    return json({ error: "GitHub error", details: await res.text() }, 502);
  }
  const result = await res.json();
  return json({ ok: true, id, path, commit: result.commit?.sha }, 201);
});

/* To invoke locally:

  1. Run `supabase start` and `supabase functions serve create-recipe`
  2. Make an HTTP request with a user access token:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-recipe' \
    --header 'Authorization: Bearer <USER_ACCESS_TOKEN>' \
    --header 'Content-Type: application/json' \
    --data '{"title":"Fiskesuppe på bergensk","category":"middag","subcategory":"supper"}'
*/