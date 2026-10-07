# oppskrifter

Github Pages: https://sondrebjarkum.github.io/oppskrifter/

## Installasjon
Kjør `pnpm i` i rot og i `./astro`.

### Supabase
Kjør `pnpm supabase start`, deretter `pnpm supabase:serve`

## Kjøre lokalt
Åpne terminal i `./astro` og kjør `pnpm dev`.

## Scripts
### Legge til ny oppskrift
`pnpm recipe -t <tittel> -c <kategori>`
### Generer PDF
`pnpm pdf`

> Forutsetter at puppeteer chrome er installert via `pnpx puppeteer browsers install chrome`