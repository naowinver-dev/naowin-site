# Plateforme de témoignages vidéo

Collecte de témoignages vidéo clients en fin de prestation, synthèse générée par Claude, back-office de publication, facturation à l'usage sur le téléchargement.

Voir la proposition d'architecture complète (diagrammes, modèle de données, protection du contenu, facturation) validée avec l'équipe pour le détail des choix techniques.

## Stack

- **Next.js 15 (App Router) + TypeScript** — parcours de capture client public + back-office entreprise
- **Postgres + Prisma** — modèle de données (voir `prisma/schema.prisma`)
- **Cloudflare Stream** — stockage/streaming vidéo, watermark natif, upload direct navigateur
- **Deepgram** — transcription des réponses (français)
- **Anthropic Claude API** — génération de la synthèse écrite
- **Clerk** — authentification back-office entreprise
- **Inngest** — orchestration des jobs asynchrones (transcription → synthèse, purge de rétention)
- **Stripe** — frais de setup (Checkout) + facturation à l'usage par palier (Billing Meters)

## Démarrage

```bash
npm install
cp .env.example .env.local   # renseigner les clés (voir ci-dessous)
npm run prisma:migrate       # crée les tables
npm run db:seed              # grille tarifaire par défaut
npm run dev
```

Dans un second terminal, pour exécuter les jobs Inngest en local :

```bash
npm run inngest:dev
```

## Variables d'environnement

Voir `.env.example`. Points d'attention :

- `CLOUDFLARE_WATERMARK_UID` : profil de watermark créé côté Cloudflare Stream (logo entreprise + plateforme, incrusté à l'ingestion).
- `STRIPE_SETUP_FEE_PRICE_ID` : prix Stripe à paiement unique pour le frais de setup.
- `STRIPE_DOWNLOAD_PRICE_ID` : prix Stripe **metered** avec tarification par palier (graduated), associé au Billing Meter `testimonial_download` — à créer côté Stripe avant la mise en prod.
- `RETENTION_DAYS_UNDOWNLOADED` : délai avant suppression de la vidéo source d'un témoignage jamais téléchargé (les métadonnées et la synthèse restent).

## Webhooks à configurer

- Cloudflare Stream → `POST /api/webhooks/cloudflare` (secret : `CLOUDFLARE_STREAM_WEBHOOK_SECRET`)
- Stripe → `POST /api/webhooks/stripe` (événement `checkout.session.completed`)
- Inngest → `POST /api/inngest` (auto-découvert par le CLI Inngest en dev)

## Structure

```
src/
  app/
    t/[token]/              parcours de capture client (consentement → questions → relecture → récompense)
    (dashboard)/dashboard/   back-office entreprise (Clerk)
    onboarding/              création d'entreprise + paiement du frais de setup
    api/capture/[token]/     API du parcours de capture
    api/webhooks/            Cloudflare Stream, Stripe
    api/inngest/             handler des jobs asynchrones
  lib/                       clients de service (Prisma, Cloudflare Stream, Deepgram, Anthropic, Stripe, Inngest)
prisma/schema.prisma         modèle de données
```

## Ce qui reste à faire avant la production

- Générateur de QR code sur la page "Liens de collecte" (actuellement le lien texte seul est affiché).
- UI de résultat du téléchargement (actuellement une server action sans retour visuel — prévoir un composant client avec état de chargement et affichage des liens/synthèse obtenus).
- Reprendre le ton/l'UX du prototype de référence fourni séparément — l'implémentation actuelle est fonctionnelle mais volontairement sobre.
- Créer les objets Stripe (Meter, prix graduated, prix setup fee) et les rôles/permissions Clerk multi-utilisateurs par entreprise (MEMBER en lecture seule vs OWNER).
