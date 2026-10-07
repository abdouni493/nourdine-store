# Boutique — gestion & boutique en ligne

Application de gestion pour une boutique de prêt-à-porter, doublée d'une
boutique en ligne publique. Un seul projet React, deux faces : le back-office
(`/dashboard`, …) et la vitrine (`/shop`).

Design monochrome noir/blanc, typographie display en capitales, angles vifs,
mode sombre complet. Interface bilingue **français / arabe** avec RTL.

---

## Démarrer

```bash
npm install
npm run dev        # http://localhost:5177
```

Autres scripts : `npm run build`, `npm run preview`, `npm run typecheck`.

Le SQL de `supabase/` doit être exécuté **avant** le premier lancement — voir
[`supabase/README.md`](supabase/README.md). Sans lui, la page de connexion
affiche l'erreur renvoyée par le projet au lieu d'un formulaire inutilisable.

Ensuite, la page de connexion propose **Créer un compte administrateur**. Le
compte est créé dans `auth.users`, et le bouton disparaît définitivement dès
que la fonction `admin_exists()` répond « oui ».

---

## Le back-office

| Module | Ce qu'il fait |
|--------|---------------|
| Tableau de bord | Chiffres du jour et du mois, alertes |
| Gestion de stock | Articles, tailles, codes-barres, photos |
| Achats | Réception fournisseur, paiements échelonnés |
| Point de vente | Caisse comptoir |
| Ventes | Registre des ventes, encaissements |
| Clients / Fournisseurs | Fiches et soldes |
| Employés | Fiches, salaires, avances, absences, **permissions** |
| Dépenses / Caisse | Trésorerie |
| **Site Web** | Pilotage complet de la boutique en ligne (5 onglets) |
| **Commandes Web** | Traitement des commandes du site |
| Rapports | Analyse boutique **et** canal en ligne |
| Paramètres | Identité du magasin, sauvegarde / restauration |

### Site Web — les cinq onglets

1. **Articles en ligne** — chaque article du stock en carte : publier / masquer,
   copier le lien de commande, voir la fiche, modifier (même formulaire que la
   gestion de stock, photos comprises).
2. **Offres spéciales** — recherche multi-articles, quantité et nouveau prix par
   article, remise calculée en montant **et** en pourcentage, titre,
   description, visuel, période de validité, activation. Les offres créées
   s'affichent en cartes avec compte à rebours.
3. **Livraison** — sociétés de livraison, puis grille tarifaire couvrant les
   **58 wilayas et 1 541 communes** : prix domicile et stop-desk par commune,
   avec un raccourci « appliquer à toutes les communes de la wilaya ».
4. **Contacts** — Facebook, Instagram, TikTok, Snapchat, WhatsApp, deux
   téléphones, e-mail, lien Google Maps.
5. **Paramètres du site** — favicon, image de fond de la page d'accueil,
   accroche, description, seuil de livraison offerte, avec aperçu en direct.

### Commandes Web — le cycle de vie

```
en attente ──accepter──▶ acceptée ──livrer──▶ livrée ──encaisser──▶ encaissée
     │                       │                   │
     └───────annuler─────────┘                   └──retour──▶ retournée
```

- **Livrer** demande la société de livraison, puis **sort les articles du stock**.
- **Retour** les **remet en stock**.
- **Encaisser** demande confirmation puis **enregistre le montant dans la caisse**.
- Une commande annulée peut être **réactivée**.

Filtres par statut avec compteurs, recherche par nom ou téléphone, et un badge
d'alerte sur la barre latérale pour les commandes en attente.

---

## La boutique en ligne — `/shop`

- **Accueil** — hero plein écran animé (nom, logo, description, image de fond),
  offres en cours et articles à la une.
- **Boutique** — grille de cartes compactes : **4 articles par écran sur mobile**,
  recherche, tri, filtre par catégorie.
- **Fiche article** — galerie, choix de la taille, quantité, panier ou commande
  directe, articles similaires.
- **Offres** — cartes avec **compte à rebours animé** jusqu'à la fin de l'offre.
- **Panier** — quantités et tailles modifiables.
- **Commande** — nom, téléphone, wilaya puis commune de cette wilaya. La
  livraison **à domicile** est présélectionnée avec le nom du transporteur ; le
  stop-desk reste disponible. Le total se recalcule en direct.
- **Merci** — page de confirmation animée avec logo, nom, description et
  récapitulatif complet.

---

## Données

**Supabase est la seule source de vérité.** Chaque écran lit ce que la base
contient et chaque enregistrement y retourne ; rien n'est conservé sur
l'appareil. Les magasins Zustand de `src/store` ne sont qu'un cache de ce que
`src/lib/db.ts` a lu en dernier, vidé à la déconnexion.

Deux exceptions assumées, parce qu'aucune table ne les réclame : le **thème**
(une préférence d'affichage) et le **panier** de la vitrine — celui d'un
visiteur anonyme, sur un seul appareil, qui ne devient une commande qu'au
passage en caisse. Les deux vivent dans le `localStorage` du navigateur.

La base **dérive tout ce qu'elle peut** : les totaux d'un document, le statut de
paiement, les niveaux de stock, les références `ACH-…` / `VTE-…` / `WEB-…` et les
remises d'une offre viennent de déclencheurs SQL. L'application envoie donc les
*faits* — les lignes, les règlements — puis relit la ligne, au lieu de calculer
un total dans le navigateur en espérant que les deux concordent. C'est aussi
pourquoi le point de vente ne décrémente plus le stock lui-même : la ligne de
vente s'en charge côté base.

`supabase/` contient le schéma complet — 36 tables, les fonctions du cycle de vie
des commandes, la sécurité au niveau des lignes, les buckets d'images et les 58
wilayas avec leurs communes. Voir [`supabase/README.md`](supabase/README.md)
pour l'ordre d'exécution.

L'authentification est entièrement Supabase : les comptes sont des lignes
`auth.users`, leur rôle et leur matrice de permissions vivent dans
`public.profiles`. Il n'y a plus de liste de comptes locale ni de vérification
de mot de passe de secours.

### Configuration

`.env` à la racine :

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-public-key>
```

> La clé `anon` est conçue pour être publiée dans le bundle navigateur ; c'est la
> sécurité au niveau des lignes qui protège les données, pas le secret de la clé.
> Ne mettez **jamais** la clé `service_role` ici.

---

## Images — compression automatique

Toute image choisie dans l'application passe par une seule porte,
[`uploadImage`](src/lib/imageUpload.ts), avant d'être stockée où que ce soit.
Une photo de téléphone de 5 à 12 Mo n'arrive **jamais** telle quelle dans le
bucket : elle est recompressée dans le navigateur, à la manière de Squoosh, mais
automatiquement.

**Le traitement, en trois temps :**

1. **Redimensionnement** à l'arête la plus longue du profil — une photo de
   4032 px n'a aucun intérêt dans une carte de 400 px.
2. **Ré-encodage en WebP** quand le navigateur sait le faire, JPEG sinon. WebP
   est environ 30 % plus léger que JPEG à qualité perçue égale, et les quatre
   buckets l'acceptent.
3. **Recherche dichotomique de la qualité** jusqu'à ce que le fichier tienne
   dans le poids cible du profil. C'est cette étape qui transforme un original
   de 10 Mo en ~400 Ko.

Le calcul tourne dans un **Web Worker** ([`browser-image-compression`](https://github.com/Donaldcwl/browser-image-compression)),
donc l'interface reste fluide même pendant une galerie de six photos, et le
codec est chargé **à la demande** : il ne pèse pas sur le démarrage d'une session
qui ne touche jamais à une image.

**Les profils**, définis dans [`src/utils/media.ts`](src/utils/media.ts) :

| Profil | Arête max | Poids cible | Utilisé par |
|--------|-----------|-------------|-------------|
| `product` | 1600 px | 450 Ko | Photos d'article (stock et site web) |
| `hero` | 1920 px | 600 Ko | Image de fond de la page d'accueil |
| `offer` | 1280 px | 350 Ko | Visuel d'offre spéciale |
| `logo` | 512 px | 120 Ko | Logo de la boutique (Paramètres) |
| `carrier` | 320 px | 60 Ko | Logo d'une société de livraison |
| `favicon` | 256 px | 40 Ko | Favicon du site |

**Où finissent les octets :**

Le fichier compressé part dans son bucket et l'application ne garde que l'URL
publique. La ligne porte alors ~100 caractères au lieu d'un blob base64 de
700 Ko : la table reste légère et la vitrine sert ses images depuis le CDN.

Un envoi qui échoue **lève une erreur** et l'utilisateur la voit. Auparavant il
retombait en silence sur l'URL de données, ce qui écrivait tranquillement un
mégaoctet de base64 dans la base à chaque politique refusée ou coupure réseau —
et personne ne s'en apercevait avant que la table ne soit trop lourde.

Les formats vectoriels (SVG, ICO) et les fichiers déjà plus légers que la cible
sont conservés octet pour octet — il n'y a plus rien à gagner, seulement du
détail à perdre. Le gain est affiché à l'utilisateur après chaque envoi
(« Image compressée · 4,8 Mo → 412 Ko (−91 %) »).

### Aucune image n'est jamais écrasée

Chaque envoi reçoit un nom aléatoire. Ce n'est pas seulement une question de
cache : la plupart de ces champs modifient un **brouillon** que l'utilisateur
peut encore abandonner — le favicon et l'image de fond sont derrière un bouton
*Réinitialiser*, un article derrière *Annuler*. Écrire à un chemin fixe au
moment du choix détruirait l'image en ligne **avant** que l'utilisateur ait
confirmé son remplacement, et *Réinitialiser* restaurerait alors une URL
pointant vers les nouveaux octets.

En contrepartie, les photos remplacées et les brouillons abandonnés restent
dans le bucket. **Paramètres → Nettoyer les images** les récupère : la fonction
liste ce que contient chaque bucket, en retire tout ce que la boutique référence
encore, et supprime le reste. Deux garde-fous évitent qu'elle touche une image
vivante — rien de plus récent que **24 h** n'est supprimé (un formulaire peut
être ouvert avec des photos pas encore enregistrées), et le nettoyage refuse de
s'exécuter tant que la boutique n'a pas été relue depuis Supabase, faute de quoi
*rien* ne semblerait référencé et le balayage viderait chaque bucket.

---

## Permissions

L'administrateur coche, pour chaque employé, les modules autorisés et les
actions permises dans chacun (`voir`, `créer`, `modifier`, `supprimer`,
`imprimer`, `payer`). La barre latérale, les pages et les boutons d'action se
plient à cette matrice, et le schéma SQL l'applique une seconde fois côté base
via `has_permission(module, action)`.

---

## Stack

React 18 · TypeScript · Vite · Tailwind CSS · Zustand ·
React Router · Framer Motion · Emotion · Recharts · react-hook-form + Zod ·
Supabase · browser-image-compression.
