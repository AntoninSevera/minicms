# Cestovatelsky denik

Publikacni webova aplikace postavena na Next.js App Routeru. Umoznuje spravu a publikaci cestovatelskych deniku s internim dashboardem, bezpecnym API a verejnou SEO-optimalizovanou casti.

## Technologie

- Next.js (App Router, Server Components, Route Handlers)
- TypeScript
- Prisma ORM
- PostgreSQL (produkce)
- NextAuth Credentials
- NextUI (dashboard UI)
- TipTap (WYSIWYG editor)
- React Query + React Hook Form + Zod

## Datovy model

Aplikace pouziva tyto hlavni relace:

- User 1:N Trip
: Jeden uzivatel muze byt autorem vice deniku.
- Trip N:M Tag
: Jeden denik muze mit vice tagu a jeden tag muze byt prirazeny vice denikum.

Auth modely jsou pripravene pro NextAuth:

- User
- Account
- Session
- VerificationToken

Obsahove modely:

- Trip
- Tag

## Funkce

- Interni dashboard pod /dashboard pro spravu deniku.
- WYSIWYG editor obsahu (TipTap) pro tvorbu a editaci clanku.
- Bezpecne API pod /api/trips s ownership kontrolou pro PATCH/PUT/DELETE.
- Middleware ochrana endpointu /api/trips a dashboard cest.
- Verejna cast jako Server Components:
  - seznam publikovanych cest s filtrovanim podle tagu
  - detail clanku podle slugu
- SEO:
  - dynamicke generateMetadata na detailu
  - generateStaticParams pro publikovane clanky
  - automaticky sitemap.xml
  - robots.txt
- Cookie consent lista s podminenou aktivaci Google Analytics.

## Spusteni projektu

1. Nainstaluj zavislosti:

```bash
npm install
```

2. Vytvor lokni konfiguraci prostredi:

```bash
cp .env.example .env
```

Na Windows muzes soubor vytvorit rucne z obsahu .env.example.

3. Doplneni hodnot do .env:

- DATABASE_URL (PostgreSQL)
- NEXTAUTH_SECRET
- NEXTAUTH_URL=http://localhost:3000
- volitelne NEXT_PUBLIC_GA_ID pro Google Analytics

4. Vygeneruj Prisma klienta:

```bash
npx prisma generate
```

5. Napln databazi seed daty:

```bash
npm run db:seed
```

6. Spust vyvojovy server:

```bash
npm run dev
```

## Testovani API

Automatizovany smoke test API je dostupny prikazem:

```bash
npm run test:crud
```

Test pokryva:

- login uzivatele ze seed dat
- create / patch / delete flow pro Trip
- ownership check (pokus o mazani ciziho zaznamu)

Vystup testu je ve formatu PASS/FAIL pro kazdy krok.

## Poznamky k nasazeni (Vercel)

- Datasource je nastaven na PostgreSQL v prisma/schema.prisma.
- Pred nasazenim nastav produkcni DATABASE_URL a NEXTAUTH_SECRET.
- Po prvnim deployi proved migrace v produkcnim prostredi.
- Ve Vercel nastav DATABASE_URL minimalne pro Production i Preview (a dle potreby i Development), aby byla databaze dostupna pri behu aplikace.

## Production checklist

1. Zkontroluj a nastav produkcni promenne prostredi:

- DATABASE_URL
- NEXTAUTH_SECRET
- NEXTAUTH_URL
- volitelne NEXT_PUBLIC_GA_ID

2. Over, ze Prisma klient je aktualni:

```bash
npx prisma generate
```

3. Spust databazove migrace v produkcnim prostredi:

```bash
npx prisma migrate deploy
```

4. Proved lokalni smoke test API pred release:

```bash
npm run test:crud
```

5. Vytvor produkcni build a over, ze projde bez chyb:

```bash
npm run build
```

6. Proved deploy na Vercel.

7. Po deployi over:

- prihlaseni do dashboardu
- CRUD flow (vytvoreni, editace, smazani)
- verejne stranky (list + detail)
- sitemap.xml a robots.txt
- cookie consent a podminenou aktivaci GA

8. Pri problemu vrat posledni deploy a analyzuj logy aplikace/databaze.
