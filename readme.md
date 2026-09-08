# TH2 Patrimoine - Site Web

Site web professionnel pour TH2 Patrimoine, cabinet de conseil et de stratégie en organisation patrimoniale.

## Structure du projet

```
TH2-Patrimoine/
├── index.html                 # Page d'accueil (les 4 onglets)
├── css/
│   └── styles.css            # Styles CSS principaux
├── js/
│   └── main.js               # JavaScript principal
├── assets/
│   ├── logo-th2-patrimoine.png   # Logo officiel affiché dans l'en-tête
│   ├── logos/                # Logos officiels des partenaires
│   └── data/
│       └── produits-distribues.xlsx  # Source des tableaux produits
├── pages/
│   ├── assurance-vie.html    # Onglet Assurance-vie
│   ├── capitalisation.html   # Onglet Capitalisation
│   ├── per.html              # Onglet PER (Plan d'Épargne Retraite)
│   └── scpi.html             # Onglet SCPI
└── README.md                 # Documentation
```

## Fonctionnalités

### Pages principales
- **Accueil** : accès aux 4 onglets Assurance-vie, Capitalisation, PER et SCPI
- **Assurance-vie** : solutions d'épargne et de transmission
- **Capitalisation** : investissement et croissance du capital
- **PER** : préparation de la retraite avec avantages fiscaux
- **SCPI** : investissement immobilier sans contrainte de gestion

Chaque onglet se termine par le tableau comparatif des produits distribués, avec le logo
officiel de chaque partenaire. Les données proviennent de `assets/data/produits-distribues.xlsx`.

### Caractéristiques techniques
- Design responsive (mobile, tablette, desktop)
- Navigation intuitive avec menu mobile
- Animations CSS et JavaScript
- Formulaires interactifs
- FAQ avec système d'accordéon
- Bouton "Retour en haut"

## Palette de couleurs

Palette reprise du site th2patrimoine.com :
- **Bleu nuit** : #1C365E (couleur principale) — variantes #002157 et #10294E
- **Magenta** : #D30B64 (couleur d'accentuation : boutons, liens actifs, chiffres clés)
- **Rose** : #EB5D98 (accent secondaire, dégradés)
- **Bleus clairs** : #D9E7F8 et #F3F6FA (arrière-plans et bordures)
- **Blanc** : #ffffff
- **Typographie** : Montserrat
- **Logo** : `assets/logo-th2-patrimoine.png`, affiché en haut à gauche sur toutes les pages
  (hauteur 48 px en desktop, 38 px sous 768 px, 32 px sous 420 px)

## Utilisation

### Développement local
1. Clonez le dépôt
2. Ouvrez le fichier `index.html` dans votre navigateur
3. Naviguez entre les différentes pages via le menu

### Déploiement
- Copiez l'ensemble des fichiers sur votre serveur web
- Assurez-vous que la structure des dossiers est conservée
- Le site est prêt à être utilisé

## Personnalisation

### Modifier les couleurs
Éditez les variables CSS dans `css/styles.css` :
```css
:root {
    --primary-color: #1C365E;
    --secondary-color: #D30B64;
    /* ... */
}
```

### Ajouter une nouvelle page
1. Créez un nouveau fichier HTML dans le dossier `pages/`
2. Utilisez la même structure que les pages existantes
3. Ajoutez le lien dans le menu de navigation (dans `index.html` et les autres pages)

### Modifier le contenu
- Éditez directement les fichiers HTML pour modifier le contenu
- Les styles sont centralisés dans `css/styles.css`
- Les fonctionnalités JavaScript sont dans `js/main.js`

## Technologies utilisées

- HTML5
- CSS3 (Flexbox, Grid, Variables CSS)
- JavaScript (ES6+)
- Font Awesome (icônes)

## Compatibilité navigateurs

- Chrome (recommandé)
- Firefox
- Safari
- Edge
- Mobile (iOS, Android)

## Contact

Pour toute question ou demande de personnalisation, contactez TH2 Patrimoine :
- Téléphone : 01 59 03 05 74
- Email : contact@th2patrimoine.com
- Site : https://th2patrimoine.com/

## Licence

Ce projet est la propriété de TH2 Patrimoine. Toute reproduction ou utilisation non autorisée est interdite.
