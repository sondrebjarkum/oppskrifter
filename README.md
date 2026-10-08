# oppskrifter

Github Pages: https://sondrebjarkum.github.io/oppskrifter/

## Installasjon
Kjør `pnpm i` i rot og i `./astro`.

### Supabase
Kjør `pnpm supabase start`, deretter `pnpm supabase:serve`

sett opp en PAT i github,, oppdater .env med GITHUB_ env-er, lag secrets i Supabase med `supabase secrets set --env-file ./astro/.env`

## Kjøre lokalt
Åpne terminal i `./astro` og kjør `pnpm dev`.

## Scripts
### Legge til ny oppskrift
`pnpm recipe -t <tittel> -c <kategori>`
### Generer PDF
`pnpm pdf`

> Forutsetter at puppeteer chrome er installert via `pnpx puppeteer browsers install chrome`