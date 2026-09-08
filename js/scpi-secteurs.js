/**
 * Secteurs d'investissement SCPI — camemberts du tableau "Notre sélection de SCPI".
 *
 * Chaque cellule porte un élément .sector-pie avec :
 *  - data-secteurs : objet JSON { cle: pourcentage } (clés de l'ordre canonique ci-dessous)
 *  - data-libelles : (optionnel) objet JSON { cle: libellé spécifique } quand le bulletin
 *    de la société de gestion regroupe les typologies différemment de nos catégories.
 *
 * Les couleurs sont définies dans styles.css (variables --secteur-*), reprises par la
 * légende sous le tableau : un secteur donné a toujours la même couleur d'une SCPI à l'autre.
 */
(function () {
    'use strict';

    // Ordre canonique des secteurs : détermine l'ordre des tranches (sens horaire depuis midi)
    var SECTEURS = [
        { cle: 'bureaux',     libelle: 'Bureaux' },
        { cle: 'commerces',   libelle: 'Commerces' },
        { cle: 'logistique',  libelle: 'Logistique & locaux d’activité' },
        { cle: 'sante',       libelle: 'Santé & éducation' },
        { cle: 'hotellerie',  libelle: 'Hôtellerie, tourisme & loisirs' },
        { cle: 'residentiel', libelle: 'Résidentiel' },
        { cle: 'autres',      libelle: 'Autres / diversifié' }
    ];

    var SVG_NS = 'http://www.w3.org/2000/svg';
    var RAYON = 48;

    function formatPct(valeur) {
        return valeur.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' %';
    }

    function point(angle) {
        return [RAYON * Math.cos(angle), RAYON * Math.sin(angle)];
    }

    function construireCamembert(el) {
        var donnees, libelles;
        try {
            donnees = JSON.parse(el.getAttribute('data-secteurs') || '{}');
            libelles = JSON.parse(el.getAttribute('data-libelles') || '{}');
        } catch (e) {
            return;
        }

        var tranches = [];
        var total = 0;
        SECTEURS.forEach(function (s) {
            var valeur = donnees[s.cle];
            if (typeof valeur === 'number' && valeur > 0) {
                tranches.push({ cle: s.cle, libelle: libelles[s.cle] || s.libelle, valeur: valeur });
                total += valeur;
            }
        });
        if (!tranches.length || total <= 0) { return; }

        var svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('viewBox', '-50 -50 100 100');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', 'Répartition sectorielle : ' + tranches.map(function (t) {
            return t.libelle + ' ' + formatPct(t.valeur);
        }).join(', '));

        // Tranches en sens horaire depuis midi, séparées par un liseré blanc
        var angle = -Math.PI / 2;
        tranches.forEach(function (t) {
            var ouverture = (t.valeur / total) * Math.PI * 2;
            var path = document.createElementNS(SVG_NS, 'path');
            if (tranches.length === 1) {
                path.setAttribute('d', 'M0,-' + RAYON + ' A' + RAYON + ',' + RAYON + ' 0 1 1 -0.01,-' + RAYON + ' Z');
            } else {
                var debut = point(angle);
                var fin = point(angle + ouverture);
                var grandArc = ouverture > Math.PI ? 1 : 0;
                path.setAttribute('d',
                    'M0,0 L' + debut[0].toFixed(2) + ',' + debut[1].toFixed(2) +
                    ' A' + RAYON + ',' + RAYON + ' 0 ' + grandArc + ' 1 ' +
                    fin[0].toFixed(2) + ',' + fin[1].toFixed(2) + ' Z');
            }
            path.style.fill = 'var(--secteur-' + t.cle + ')';
            path.setAttribute('stroke', '#ffffff');
            path.setAttribute('stroke-width', '2');
            path.setAttribute('stroke-linejoin', 'round');

            var title = document.createElementNS(SVG_NS, 'title');
            title.textContent = t.libelle + ' : ' + formatPct(t.valeur);
            path.appendChild(title);
            svg.appendChild(path);

            angle += ouverture;
        });

        el.textContent = '';
        el.appendChild(svg);
    }

    function init() {
        Array.prototype.forEach.call(document.querySelectorAll('.sector-pie'), construireCamembert);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
