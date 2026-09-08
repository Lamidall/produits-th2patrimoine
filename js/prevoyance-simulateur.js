/**
 * TH2 Patrimoine - Simulateur de perte de revenus en cas d'arrêt de travail
 *
 * Hypothèses de calcul (arrêt maladie / accident de la vie privée, hors AT-MP et ALD) :
 *  - PASS 2025 : 47 100 €. SMIC mensuel brut : 1 801,80 €.
 *  - Salariés & assimilés salariés (régime général) : IJSS = 50 % du gain
 *    journalier de base (3 derniers mois bruts / 91,25), salaire plafonné à
 *    1,4 SMIC (arrêts depuis le 01/04/2025) soit 41,47 €/j max. Carence 3 jours.
 *    Brut estimé = net x 1,282.
 *  - Salariés uniquement : maintien légal employeur (art. L.1226-1 C. trav.,
 *    ancienneté >= 1 an) : après 7 jours de carence, 90 % de la rémunération
 *    pendant 30 jours puis 66,66 % pendant 30 jours (tranche 1 à 5 ans
 *    d'ancienneté), IJSS comprises. Approximation : pourcentages appliqués au net.
 *  - Artisans, commerçants, chefs d'entreprise et PL non réglementées (SSI/CPAM) :
 *    IJ = revenu annuel moyen des 3 dernières années / 730, plafonnée à
 *    PASS/730 (64,52 €/j), nulle si revenu moyen < 10 % du PASS (4 710 €).
 *    Carence 3 jours, 360 IJ maximum sur 3 ans.
 *  - Professions libérales réglementées : IJ CPAM du 4e au 90e jour =
 *    revenu/730 plafonné à 3 PASS/730 (193,56 €/j). Au-delà du 90e jour,
 *    relais (ou non) par la caisse professionnelle : forfaits indicatifs 2025.
 *  - Exploitants agricoles (MSA/Amexa) : IJ forfaitaires ~25,36 €/j pendant
 *    les 28 premiers jours indemnisés puis ~33,81 €/j. Carence 3 jours.
 *  - CSG-CRDS de 6,7 % déduite de toutes les indemnités journalières.
 */

document.addEventListener('DOMContentLoaded', function () {
    const remuInput = document.getElementById('prev-remu');
    if (!remuInput) return;

    const professionSelect = document.getElementById('prev-profession');
    const tnsBloc = document.getElementById('prev-tns-bloc');
    const caisseBox = document.getElementById('prev-caisse');
    const resultsEl = document.getElementById('prev-results');

    const PASS = 47100;                       // PASS 2025
    const SMIC_BRUT = 1801.80;                // SMIC mensuel brut 2025
    const IJSS_MAX = 0.5 * (1.4 * SMIC_BRUT * 3 / 91.25); // 41,47 €/j (plafond 1,4 SMIC)
    const IJ_SSI_MAX = PASS / 730;            // 64,52 €/j
    const IJ_PL_MAX = 3 * PASS / 730;         // 193,56 €/j
    const SEUIL_SSI = 0.10 * PASS;            // 4 710 € : en-deçà, IJ SSI nulles
    const CSG = 0.067;                        // CSG-CRDS sur les IJ
    const NET_VERS_BRUT = 1.282;              // brut estimé depuis le net (salariés)
    const DUREES = [
        { jours: 30,  label: '1 mois (30 jours)' },
        { jours: 90,  label: '3 mois (90 jours)' },
        { jours: 180, label: '6 mois (180 jours)' },
        { jours: 365, label: '1 an (365 jours)' }
    ];

    // Caisses des travailleurs non salariés : indemnisation légale obligatoire.
    // after90(revenuAnnuel) = IJ brute versée par la caisse à partir du 91e jour.
    const CAISSES = {
        ssi: {
            sigle: 'SSI / CPAM',
            nom: 'Sécurité sociale des indépendants (gérée par la CPAM)',
            type: 'ssi',
            resume: [
                'IJ = 1/730e du revenu annuel moyen des 3 dernières années, plafonnée à 64,52 €/j (PASS 2025).',
                'Aucune IJ si le revenu moyen est inférieur à 4 710 €/an (10 % du PASS).',
                'Délai de carence de 3 jours, 360 IJ maximum sur 3 ans.'
            ]
        },
        msa: {
            sigle: 'MSA',
            nom: 'Mutualité sociale agricole (Amexa)',
            type: 'msa',
            resume: [
                'IJ forfaitaires, quel que soit votre revenu : ≈ 25,36 €/j pendant les 28 premiers jours indemnisés, puis ≈ 33,81 €/j.',
                'Délai de carence de 3 jours.'
            ]
        },
        carmf: {
            sigle: 'CARMF',
            nom: 'Caisse autonome de retraite des médecins de France',
            type: 'pl',
            after90: function (revenu) { return revenu < PASS ? 69.74 : (revenu < 3 * PASS ? 104.61 : 139.48); },
            after90Label: 'IJ CARMF forfaitaire selon votre classe de cotisation (≈ 70 à 139 €/j, indicatif 2025)'
        },
        carcdsf_d: {
            sigle: 'CARCDSF',
            nom: 'Caisse de retraite des chirurgiens-dentistes et sages-femmes',
            type: 'pl',
            after90: function () { return 106; },
            after90Label: 'IJ CARCDSF forfaitaire (≈ 106 €/j, indicatif 2025)'
        },
        carcdsf_sf: {
            sigle: 'CARCDSF',
            nom: 'Caisse de retraite des chirurgiens-dentistes et sages-femmes',
            type: 'pl',
            after90: function () { return 56; },
            after90Label: 'IJ CARCDSF sages-femmes forfaitaire (≈ 56 €/j, indicatif 2025)'
        },
        carpimko: {
            sigle: 'CARPIMKO',
            nom: 'Caisse des infirmiers, kinésithérapeutes, orthophonistes, orthoptistes et pédicures-podologues',
            type: 'pl',
            after90: function () { return 57; },
            after90Label: 'IJ CARPIMKO forfaitaire (≈ 57 €/j, indicatif 2025)'
        },
        cavp: {
            sigle: 'CAVP',
            nom: 'Caisse d’assurance vieillesse des pharmaciens',
            type: 'pl',
            after90: function () { return 112; },
            after90Label: 'IJ CAVP forfaitaire (≈ 112 €/j, indicatif 2025)'
        },
        carpv: {
            sigle: 'CARPV',
            nom: 'Caisse autonome de retraite et de prévoyance des vétérinaires',
            type: 'pl',
            after90: function () { return 106; },
            after90Label: 'IJ CARPV forfaitaire (≈ 106 €/j, indicatif 2025)'
        },
        cnbf: {
            sigle: 'CNBF',
            nom: 'Caisse nationale des barreaux français',
            type: 'pl',
            after90: function () { return 90; },
            after90Label: 'IJ CNBF forfaitaire de 90 €/j (jusqu’au 365e jour)'
        },
        cipav: {
            sigle: 'CIPAV',
            nom: 'Caisse interprofessionnelle de prévoyance et d’assurance vieillesse',
            type: 'pl',
            after90: function () { return 0; },
            after90Label: 'Aucune IJ versée par la CIPAV au-delà du 90e jour (seule une pension est prévue en cas d’invalidité d’au moins 66 %)'
        },
        cavec: {
            sigle: 'CAVEC',
            nom: 'Caisse d’assurance vieillesse des experts-comptables',
            type: 'pl',
            after90: function () { return 0; },
            after90Label: 'Aucune IJ versée par la CAVEC au-delà du 90e jour (régime invalidité-décès uniquement)'
        },
        cavom: {
            sigle: 'CAVOM',
            nom: 'Caisse d’assurance vieillesse des officiers ministériels',
            type: 'pl',
            after90: function () { return 0; },
            after90Label: 'Aucune IJ versée par la CAVOM au-delà du 90e jour (régime invalidité-décès uniquement)'
        },
        cprn: {
            sigle: 'CPRN',
            nom: 'Caisse de prévoyance et de retraite des notaires',
            type: 'pl',
            after90: function () { return 0; },
            after90Label: 'Aucune IJ versée par la CPRN au-delà du 90e jour (régime invalidité-décès uniquement)'
        },
        cavamac: {
            sigle: 'CAVAMAC',
            nom: 'Caisse des agents généraux d’assurance',
            type: 'pl',
            after90: function () { return 0; },
            after90Label: 'Aucune IJ versée par la CAVAMAC au-delà du 90e jour'
        }
    };

    const fmtEuro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    const fmtEuroDec = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtPct = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

    function euro(v) { return fmtEuro.format(Math.round(v)); }
    function euroJour(v) { return fmtEuroDec.format(v); }

    function statutSelectionne() {
        const checked = document.querySelector('input[name="prev-statut"]:checked');
        return checked ? checked.value : 'tns';
    }

    function net(v) { return v * (1 - CSG); }

    /**
     * Construit les phases d'indemnisation légale sur 365 jours d'arrêt :
     * [{ from, to, daily (net de CSG-CRDS), label }]
     */
    function construirePhases(statut, caisse, netMensuel) {
        const revenuAnnuel = netMensuel * 12;
        const dailyNet = revenuAnnuel / 365;
        const phases = [];
        const warnings = [];

        if (statut === 'salarie' || statut === 'assimile') {
            const brutMensuel = Math.min(netMensuel * NET_VERS_BRUT, 1.4 * SMIC_BRUT);
            const ijss = Math.min(0.5 * (brutMensuel * 3 / 91.25), IJSS_MAX);
            const ijssNet = net(ijss);

            if (statut === 'salarie') {
                phases.push({ from: 1, to: 3, daily: 0, label: 'Délai de carence de la Sécurité sociale' });
                phases.push({ from: 4, to: 7, daily: ijssNet, label: 'IJSS seules (50 % du salaire plafonné à 1,4 SMIC)' });
                phases.push({ from: 8, to: 37, daily: Math.max(0.90 * dailyNet, ijssNet), label: 'IJSS + maintien légal employeur à 90 % (loi de mensualisation)' });
                phases.push({ from: 38, to: 67, daily: Math.max((2 / 3) * dailyNet, ijssNet), label: 'IJSS + maintien légal employeur à 66,66 %' });
                phases.push({ from: 68, to: 365, daily: ijssNet, label: 'IJSS seules (fin du maintien légal)' });
            } else {
                phases.push({ from: 1, to: 3, daily: 0, label: 'Délai de carence de la Sécurité sociale' });
                phases.push({ from: 4, to: 365, daily: ijssNet, label: 'IJSS seules (50 % du salaire plafonné à 1,4 SMIC)' });
                warnings.push({
                    titre: 'Assimilé salarié : une protection légale très limitée',
                    texte: 'En tant que mandataire social, vous ne bénéficiez ni du maintien légal de salaire par l’employeur (réservé aux titulaires d’un contrat de travail), ni de l’assurance chômage. Votre seule couverture légale se limite à ' + euroJour(ijssNet) + ' par jour.'
                });
            }
            return { phases: phases, warnings: warnings, dailyNet: dailyNet };
        }

        // TNS
        if (caisse.type === 'ssi') {
            let ij = revenuAnnuel < SEUIL_SSI ? 0 : Math.min(revenuAnnuel / 730, IJ_SSI_MAX);
            const ijNet = net(ij);
            phases.push({ from: 1, to: 3, daily: 0, label: 'Délai de carence' });
            phases.push({ from: 4, to: 363, daily: ijNet, label: 'IJ SSI : 1/730e du revenu annuel moyen (plafond 64,52 €/j)' });
            phases.push({ from: 364, to: 365, daily: 0, label: 'Limite légale de 360 IJ atteinte' });
            if (ij === 0) {
                warnings.push({
                    titre: 'Revenu inférieur à 10 % du PASS : aucune indemnité journalière',
                    texte: 'Avec un revenu annuel moyen inférieur à ' + euro(SEUIL_SSI) + ', la Sécurité sociale des indépendants ne verse aucune IJ : la loi ne prévoit aucun revenu de remplacement dans votre situation.'
                });
            }
        } else if (caisse.type === 'msa') {
            phases.push({ from: 1, to: 3, daily: 0, label: 'Délai de carence' });
            phases.push({ from: 4, to: 31, daily: net(25.36), label: 'IJ Amexa forfaitaire (28 premiers jours indemnisés)' });
            phases.push({ from: 32, to: 365, daily: net(33.81), label: 'IJ Amexa forfaitaire majorée' });
        } else {
            // Professions libérales : IJ CPAM 90 jours, puis relais éventuel de la caisse
            const ijCpam = net(Math.min(revenuAnnuel / 730, IJ_PL_MAX));
            const ijCaisse = net(caisse.after90(revenuAnnuel));
            phases.push({ from: 1, to: 3, daily: 0, label: 'Délai de carence' });
            phases.push({ from: 4, to: 90, daily: ijCpam, label: 'IJ CPAM des professions libérales : 1/730e du revenu (plafond 193,56 €/j)' });
            phases.push({ from: 91, to: 365, daily: ijCaisse, label: caisse.after90Label });
            if (ijCaisse === 0) {
                warnings.push({
                    titre: 'Aucune indemnité au-delà du 90e jour d’arrêt',
                    texte: 'Votre caisse (' + caisse.sigle + ' – ' + caisse.nom + ') ne verse aucune indemnité journalière après le 90e jour. En cas d’arrêt long, la loi ne prévoit plus aucun revenu de remplacement : c’est le principal risque à couvrir par un contrat de prévoyance.'
                });
            }
        }
        return { phases: phases, warnings: warnings, dailyNet: dailyNet };
    }

    function indemnitesSurDuree(phases, jours) {
        let total = 0;
        phases.forEach(function (p) {
            const debut = Math.max(p.from, 1);
            const fin = Math.min(p.to, jours);
            if (fin >= debut) total += p.daily * (fin - debut + 1);
        });
        return total;
    }

    function ijAuJour(phases, jour) {
        for (let i = 0; i < phases.length; i++) {
            if (jour >= phases[i].from && jour <= phases[i].to) return phases[i].daily;
        }
        return 0;
    }

    function majCaisseBox() {
        const statut = statutSelectionne();
        tnsBloc.hidden = statut !== 'tns';
        if (statut !== 'tns' || !professionSelect.value) {
            caisseBox.hidden = true;
            return;
        }
        const caisse = CAISSES[professionSelect.value];
        const professionBrute = professionSelect.selectedOptions.length ? professionSelect.selectedOptions[0].text : '';
        const profession = professionBrute.replace(/\s*\(PCS[^)]*\)/i, '');
        let items = '';
        if (caisse.type === 'pl') {
            items = '<li>Du 4e au 90e jour : IJ CPAM = 1/730e de votre revenu annuel moyen, plafonnée à 193,56 €/j (3 PASS).</li>' +
                '<li>À partir du 91e jour : ' + caisse.after90Label + '.</li>' +
                '<li>Délai de carence de 3 jours.</li>';
        } else {
            items = caisse.resume.map(function (r) { return '<li>' + r + '</li>'; }).join('');
        }
        caisseBox.innerHTML =
            '<div class="sim-caisse-head">' +
                '<span class="sim-caisse-badge">' + caisse.sigle + '</span>' +
                '<strong>' + caisse.nom + '</strong>' +
            '</div>' +
            '<p class="sim-caisse-prof">En tant que <strong>' + profession.toLowerCase() + '</strong>, vous cotisez obligatoirement à cette caisse. Vos indemnités légales en cas d’arrêt de travail :</p>' +
            '<ul>' + items + '</ul>';
        caisseBox.hidden = false;
    }

    function render() {
        majCaisseBox();

        const statut = statutSelectionne();
        const netMensuel = Math.max(0, parseFloat(remuInput.value) || 0);

        if (statut === 'tns' && !professionSelect.value) {
            resultsEl.innerHTML =
                '<div class="sim-empty">' +
                    '<i class="fas fa-briefcase-medical" aria-hidden="true"></i>' +
                    '<p>Sélectionnez votre profession (nomenclature INSEE) pour identifier votre caisse obligatoire et estimer votre perte de revenus en cas d’arrêt de travail.</p>' +
                '</div>';
            return;
        }
        if (netMensuel <= 0) {
            resultsEl.innerHTML =
                '<div class="sim-empty">' +
                    '<i class="fas fa-briefcase-medical" aria-hidden="true"></i>' +
                    '<p>Indiquez votre rémunération nette mensuelle (hors dividendes) pour estimer votre perte de revenus en cas d’arrêt de travail.</p>' +
                '</div>';
            return;
        }

        const caisse = statut === 'tns' ? CAISSES[professionSelect.value] : null;
        const calc = construirePhases(statut, caisse, netMensuel);
        const phases = calc.phases;
        const dailyNet = calc.dailyNet;

        const indem90 = indemnitesSurDuree(phases, 90);
        const perte90 = dailyNet * 90 - indem90;
        const couverture90 = (dailyNet * 90) > 0 ? indem90 / (dailyNet * 90) : 0;
        const perte365 = dailyNet * 365 - indemnitesSurDuree(phases, 365);

        let html = '';

        // Bandeau de synthèse
        html += '<div class="sim-hero">' +
            '<div class="sim-hero-main">' +
                '<span class="sim-hero-label">Perte nette estimée sur un arrêt de 90 jours, sans contrat de prévoyance</span>' +
                '<span class="sim-hero-value">' + euro(perte90) + '</span>' +
                '<span class="sim-hero-gain negative">soit ' + fmtPct.format((1 - couverture90) * 100) + '&nbsp;% de vos revenus non compensés par le régime obligatoire</span>' +
            '</div>' +
            '<div class="sim-hero-stats">' +
                '<div class="sim-stat"><span>Votre revenu net</span><strong>' + euro(netMensuel) + ' / mois <small>(' + euroJour(dailyNet) + ' / jour)</small></strong></div>' +
                '<div class="sim-stat"><span>Indemnité légale au 30e jour d’arrêt</span><strong>' + euroJour(ijAuJour(phases, 30)) + ' / jour</strong></div>' +
                '<div class="sim-stat"><span>Indemnité légale au 91e jour d’arrêt</span><strong>' + euroJour(ijAuJour(phases, 91)) + ' / jour</strong></div>' +
                '<div class="sim-stat"><span>Perte nette sur 1 an d’arrêt</span><strong>' + euro(perte365) + '</strong></div>' +
            '</div>' +
        '</div>';

        // Alertes
        calc.warnings.forEach(function (w) {
            html += '<div class="sim-warning"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i><div>' +
                '<strong>' + w.titre + '</strong>' + w.texte +
            '</div></div>';
        });

        // Chronologie d'indemnisation
        html += '<div class="partners-table sim-detail-table sim-prev-table"><table>' +
            '<thead><tr><th>Période de l’arrêt</th><th>Indemnisation légale</th><th>Montant net / jour</th><th>% de votre revenu</th></tr></thead><tbody>';
        phases.forEach(function (p) {
            const pctRevenu = dailyNet > 0 ? p.daily / dailyNet : 0;
            html += '<tr>' +
                '<td class="nowrap">' + (p.from === p.to ? 'Jour ' + p.from : 'Jours ' + p.from + ' à ' + p.to) + '</td>' +
                '<td>' + p.label + '</td>' +
                '<td class="nowrap">' + (p.daily > 0 ? euroJour(p.daily) : '—') + '</td>' +
                '<td class="nowrap ' + (pctRevenu >= 0.7 ? 'sim-gain positive' : (pctRevenu <= 0.3 ? 'sim-gain negative' : '')) + '">' + fmtPct.format(pctRevenu * 100) + '&nbsp;%</td>' +
            '</tr>';
        });
        html += '</tbody></table></div>';

        // Perte selon la durée de l'arrêt
        html += '<div class="partners-table sim-detail-table sim-prev-table"><table>' +
            '<thead><tr><th>Durée de l’arrêt</th><th>Revenus non perçus</th><th>Indemnités légales estimées</th><th>Perte nette</th><th>Taux de couverture</th></tr></thead><tbody>';
        DUREES.forEach(function (d) {
            const revenus = dailyNet * d.jours;
            const indemnites = indemnitesSurDuree(phases, d.jours);
            const perte = revenus - indemnites;
            const couverture = revenus > 0 ? indemnites / revenus : 0;
            html += '<tr>' +
                '<td class="nowrap">' + d.label + '</td>' +
                '<td class="nowrap">' + euro(revenus) + '</td>' +
                '<td class="nowrap">' + euro(indemnites) + '</td>' +
                '<td class="nowrap sim-gain negative">−&nbsp;' + euro(perte) + '</td>' +
                '<td class="nowrap">' + fmtPct.format(couverture * 100) + '&nbsp;%</td>' +
            '</tr>';
        });
        html += '</tbody></table></div>' +
            '<p class="sim-evolution-note">La perte nette correspond aux revenus que la loi ne remplace pas si vous n’avez souscrit aucun contrat de prévoyance individuelle. Un contrat d’indemnités journalières adapté permet de compléter les prestations obligatoires jusqu’à hauteur de votre revenu réel, dès la fin du délai de carence choisi.</p>';

        resultsEl.innerHTML = html;
    }

    remuInput.addEventListener('input', render);
    professionSelect.addEventListener('change', render);
    Array.prototype.forEach.call(document.querySelectorAll('input[name="prev-statut"]'), function (radio) {
        radio.addEventListener('change', render);
    });

    render();
});
