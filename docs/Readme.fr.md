<div align="center">

![Moonrush Agent Skills](https://raw.githubusercontent.com/moonrush-app/moonrush-skills/main/static/moonrush-skills.png)

[English](../Readme.md) ·
[简体中文](./Readme.zh-CN.md) ·
**Français** ·
[한국어](./Readme.ko.md) ·
[日本語](./Readme.ja.md)

[![Console](https://img.shields.io/badge/console-moonrush.space%2Fai-7C3AED)](https://moonrush.space/ai)
[![npm](https://img.shields.io/npm/v/moonrush-cli?color=5865F2&label=moonrush-cli)](https://www.npmjs.com/package/moonrush-cli)
[![X](https://img.shields.io/badge/X-@moonrush__space-000000?logo=x&logoColor=white)](https://x.com/moonrush_space)
[![Discord](https://img.shields.io/badge/Discord-join-5865F2?logo=discord&logoColor=white)](https://discord.gg/vD66uhAG3h)
[![Telegram](https://img.shields.io/badge/Telegram-announcements-26A5E4?logo=telegram&logoColor=white)](https://t.me/moonrush_space_app)
[![Telegram](https://img.shields.io/badge/Telegram-chat-26A5E4?logo=telegram&logoColor=white)](https://t.me/moonrush_spacechat)

</div>

Avec Moonrush Agent Skills, vous demandez en langage naturel à un agent IA les classements de
découverte en temps réel sur Solana, Robinhood Chain, Base, BNB, Soneium et Arc, les
fondamentaux d'un token avec un verdict de risque nommé, la liste Verified, une lecture
technique de n'importe quel graphique, la liste complète des détenteurs avec la concentration
et les nouvelles baleines, l'historique d'un créateur noté à partir de tout ce qu'il a lancé
avant, n'importe quel portefeuille noté comme compétent, chanceux, bot ou développeur, et ce
que détiennent en ce moment les premiers du classement PnL.

S'y ajoute ce qu'aucune autre boîte à outils de données on-chain ne possède : Moonrush est une
place de marché sociale, donc le même agent lit le fil et la timeline d'un trader, les
mooncalls sous une position et qui suit qui, et dit à un créateur ce que lui ont rapporté les
trades passés d'après ses appels.

Le trading est de premier plan, et il engage de l'argent réel : cotations, achats et ventes au
marché, ordres limites, take-profit, stop-loss et leurs variantes suiveuses, entrées en
bracket qui placent les deux sorties en une seule fois, et le côté portefeuille avec les
soldes, la valeur dans le temps, les dépôts et l'activité. Chaque chemin qui dépense cote
d'abord, montre les chiffres, et demande à la personne devant le terminal.

> Le [Readme.md](../Readme.md) anglais est la seule version de référence. En cas de divergence,
> c'est lui qui fait foi.

## Installation

```bash
npm install -g moonrush-cli
moonrush-cli config
```

Comme plugin d'agent :

```bash
npx skills add moonrush-app/moonrush-skills
```

Claude Code et tout hôte qui lit un `.claude-plugin` : la commande ci-dessus suffit.

| Hôte | Installation |
|---|---|
| Claude Code, Codex, OpenCode, Cursor | `npx skills add moonrush-app/moonrush-skills` |
| Codex, à la main | [.codex/INSTALL.md](../.codex/INSTALL.md) |
| OpenCode, à la main | [.opencode/INSTALL.md](../.opencode/INSTALL.md) |
| Cursor | le paquet contient [.cursor-plugin/plugin.json](../.cursor-plugin/plugin.json) ; pointez Cursor sur ce dépôt ou sur le paquet npm installé |

## Demander en langage naturel

Les compétences sont la raison d'être de ce dépôt. Une fois installées, vous parlez à l'agent,
et c'est lui qui choisit la compétence et les commandes :

| Ce que vous dites | Ce qu'il utilise |
|---|---|
| « Que fait PENGU aujourd'hui ? » | `moonrush-token`, puis le graphique et le verdict de risque |
| « Note ce token : `<adresse>` » | `moonrush-token-dd`, de 0 à 100, chaque point retiré justifié |
| « Qui le détient, et à quel point c'est concentré ? » | `moonrush-holder-analysis` |
| « Ce dev a-t-il déjà lancé quelque chose ? » | `moonrush-dev-score` |
| « Ce portefeuille vaut-il d'être copié ? `<adresse>` » | `moonrush-wallet-score` |
| « Que détiennent les meilleurs en ce moment ? » | `moonrush-smart-money` |
| « Lis-moi ce graphique » | `moonrush-kline-pattern` |
| « Achète 25 $ de `<token>` » | `moonrush-token-buy` : résoudre, diligence rapide, dimensionner, coter, puis il vous demande |
| « Achète 50 $ de X, take-profit à +40 %, stop à -20 % » | `moonrush-bracket` : l'achat, puis les deux sorties |
| « Quelles positions n'ont pas de stop-loss ? » | le workflow [risque des positions](./workflow-position-risk.md) |
| « Qu'ont rapporté mes appels, et pourquoi ce n'est pas arrivé ? » | `moonrush-rewards` |

Rien qui dépense de l'argent ne se produit sur une simple phrase. Les compétences cotent
d'abord, montrent les chiffres, vous demandent au terminal, et il leur est interdit de passer
`--yes`.

## Compétences

| Compétence | Couvre |
|---|---|
| `moonrush-token` | Détail d'un token, recherche par nom, liste Verified |
| `moonrush-market` | Classements Trending / Movers / New, configuration des frais en direct |
| `moonrush-wallet` | Soldes, portefeuille, dépôts, valeur dans le temps, activité |
| `moonrush-positions` | Trades : les vôtres, les publics, les meilleurs, et qui détient un token |
| `moonrush-leaderboard` | Classements PnL sur 24 h / 7 j / 30 j / depuis le début |
| `moonrush-rewards` | Gains de créateur, et leur réclamation |
| `moonrush-trade` | Coter, acheter, vendre ; ordres limites, take-profit, stop-loss et suiveurs |
| `moonrush-token-dd` | Une note de diligence de 0 à 100, chaque point retiré étant justifié |
| `moonrush-social` | Le fil, la timeline d'un trader, le fil d'une position, les mooncalls, les abonnements |
| `moonrush-kline-pattern` | Lecture technique d'un graphique : tendance, niveaux, volume, figures et leurs règles |
| `moonrush-smart-money` | Ce que détiennent maintenant les premiers du classement, trié par nombre de détenteurs |
| `moonrush-token-buy` | De « achète du X » au trade confirmé : résoudre, diligence rapide, dimensionner, coter, acheter |
| `moonrush-holder-analysis` | Liste complète des détenteurs, concentration, nouvelles baleines, pools et burns |
| `moonrush-dev-score` | Une note de 0 à 100 du créateur d'un token, d'après tout ce qu'il a lancé avant |
| `moonrush-wallet-score` | Le palmarès on-chain d'un portefeuille en une note : compétent, chanceux, bot ou développeur |
| `moonrush-bracket` | Acheter et placer les deux sorties en une fois : l'achat, puis take-profit et stop-loss |

## Workflows

Des recettes en plusieurs étapes qui enchaînent les commandes jusqu'à une réponse :

| Workflow | Pour |
|---|---|
| [Recherche sur un token](./workflow-token-research.md) | D'un nom ou d'une adresse à ce qui mérite d'être dit |
| [Brief quotidien](./workflow-daily-brief.md) | Vos positions, les ordres déclenchés, ce qu'ont fait vos abonnements, ce qui a bougé |
| [Profil d'un trader](./workflow-trader-profile.md) | Faut-il le copier : palmarès, concentration, capacité d'exécution |
| [Risque des positions](./workflow-position-risk.md) | Quelles positions sont sans protection, et quels stops proposer |
| [Opportunités de marché](./workflow-market-opportunities.md) | Une liste filtrée sur toutes les chaînes |
| [Revue de portefeuille](./workflow-portfolio-review.md) | Positions, PnL, et ce qui l'explique |
| [Gains de créateur](./workflow-creator-earnings.md) | Ce qu'un créateur a gagné, et pourquoi ce n'est pas arrivé |

## Commandes

Les commandes et leurs options ne se traduisent pas. La référence complète est dans le
[Readme.md](../Readme.md#commands) anglais, ou directement :

```bash
moonrush-cli --help
moonrush-cli <commande> --help
```

## Authentification

Deux entrées, pour deux machines différentes.

**Un navigateur, pour votre portable.**

```bash
moonrush-cli login
```

Un clic. La session dure environ une heure et se renouvelle tant qu'elle vit.

**Une clé API, pour un serveur, une CI ou un agent.** Sans navigateur, sans expiration.

```bash
moonrush-cli config --generate-key     # paire de clés, la moitié privée reste ici en mode 600
# collez la clé PUBLIQUE sur https://moonrush.space/ai/keys
moonrush-cli config --apply-key <key id>.<secret>
```

⚠️ **La clé privée ne quitte jamais votre machine et n'est jamais envoyée.** La console ne
stocke que la moitié publique : ce que détient le serveur peut vérifier une signature, pas en
produire une. Rien sur cette page ne devrait jamais demander une clé privée.

**Les clés ont deux niveaux.** `read` couvre les données de marché publiques et ne demande que
l'identifiant de clé. Tout ce qui appartient à une personne, c'est-à-dire votre portefeuille,
vos positions, vos gains et leur réclamation, exige « Trading and private data » ET une
signature portant sur le chemin, la requête, le corps et l'horodatage de chaque appel. Un
identifiant de clé fuité lit donc les classements publics et rien d'autre, et une requête
interceptée ne peut être ni rejouée ni modifiée.

La frontière n'est pas lecture contre écriture : `rewards me` et `wallet portfolio` sont des
lectures et relèvent pourtant du niveau supérieur, car ce qui rend un appel sensible, c'est à
qui appartiennent les données renvoyées.

`token verified`, `token check` et `market config` ne demandent aucune authentification.

**Variables d'environnement, pour un conteneur ou une CI.** Les mêmes identifiants sans fichier
de configuration, et elles l'emportent sur le fichier quand les deux existent. Copiez
[.env.example](../.env.example) vers `~/.config/moonrush/.env`, ou exportez-les :

| Variable | Ce que c'est |
|---|---|
| `MOONRUSH_TOKEN` | Le jeton d'accès court. Suffit seul pendant environ une heure. |
| `MOONRUSH_REFRESH_TOKEN` | L'identifiant longue durée. Avec lui le CLI se renouvelle et continue de fonctionner tant que la session Privy vit. **À traiter comme un secret.** |
| `MOONRUSH_PRIVY_APP_ID`, `MOONRUSH_PRIVY_CLIENT_ID` | Valeurs publiques, issues des en-têtes de l'appel de session Privy. |
| `MOONRUSH_API_BASE` | Optionnel. Par défaut `https://social.moonrush.space`. |

## Sécurité

Les noms, symboles et descriptions de tokens sont écrits par celui qui a déployé le token, et
dans un CLI fait pour des agents ils arrivent dans le contexte d'un modèle. Le client retire
les caractères invisibles (surcharges bidi, jointures de largeur nulle, le bloc tag Unicode)
pour qu'un texte caché ne puisse pas dire une chose au modèle et une autre à la personne. Il
ne cherche pas à détecter des instructions : ce filtre-là se contourne, et mange au passage
des textes de token légitimes.

Les adresses ne sont jamais réécrites.

`rewards claim`, `trade buy`, `trade sell` et `orders create` engagent de l'argent (un ordre
plus tard, de lui-même), et `mooncall post` publie au nom de l'utilisateur. Chacun affiche
d'abord les montants ou le texte exacts, demande sur un terminal, et refuse s'il n'y en a pas.
`--yes` existe pour une personne qui tape sur sa propre machine ; les compétences interdisent
aux agents de le passer.

Les textes écrits par des personnes dans les fils (publications, bios, noms affichés) sont
nettoyés comme les métadonnées de tokens.

## Développement

```bash
npm ci && npm run build && npm test
```

La CI lance build et tests sur Node 20 et 24, et vérifie que le frontmatter de chaque
compétence correspond à son dossier.

## Ce qu'il ne fait pas

À savoir avant de bâtir une intégration autour. Chacun de ces points existe dans l'API et
n'a pas encore de commande ici.

- **Pas de sortie d'argent.** `wallet deposits` indique où envoyer des fonds, et rien ici
  n'en envoie où que ce soit. Retirer et envoyer, ce sont `/transfer/*` et `/rh/send` sur
  l'API ; aucune commande ne les appelle.
- **Pas de flux en direct.** L'API a six sockets (gateway, chart, intent, trending, verified,
  discovery). Un processus CLI n'en garde pas un ouvert, donc chaque compétence interroge à
  la demande. Pour un agent c'est généralement le bon compromis : redemander coûte peu, et
  une connexion à surveiller coûte cher.
- **Pas de perps.** `/perps` est sur l'API. Aucune compétence ne le couvre.
- **Pas de notifications.** Rien ici ne les lit ni ne les envoie.

## Liens

- La console, où se créent les clés : [moonrush.space/ai](https://moonrush.space/ai)
- Versions et changements : [releases](https://github.com/moonrush-app/moonrush-skills/releases)
- Un problème, ou une commande souhaitée : [ouvrir une issue](https://github.com/moonrush-app/moonrush-skills/issues)
- [X](https://x.com/moonrush_space) · [Discord](https://discord.gg/vD66uhAG3h) · [Telegram](https://t.me/moonrush_space_app)

Les pull requests sont bienvenues. Une nouvelle compétence a besoin d'un `SKILL.md` dont le
`name` correspond à son dossier, ce que la CI vérifie, et le style de la maison n'utilise pas
d'em dash, ce que la CI vérifie aussi.

## Licence

MIT
