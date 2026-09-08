/**
 * TH2 Patrimoine - Simulateur de gains SCPI
 *
 * Hypothèses de calcul (moteur mensuel) :
 *  - Les frais sur versement sont prélevés sur chaque versement : capital net investi = versement x (1 - frais).
 *  - Chaque versement (initial, programmé ou réinvestissement de revenus) n'entre en jouissance
 *    qu'après le délai propre à la SCPI ("date d'entrée en jouissance" du tableau) : il ne produit
 *    aucun revenu avant cette date.
 *  - Les revenus sont calculés mois par mois sur le capital en jouissance, au taux de
 *    distribution 2025 supposé constant (1/12e du taux annuel chaque mois).
 *  - Les versements programmés (mensuels, trimestriels ou annuels) débutent après le versement
 *    initial et respectent les minimums de la colonne "Versement permanent" du tableau.
 *  - En mode capitalisation, les revenus sont réinvestis en nouvelles parts : ils supportent
 *    à leur tour les frais sur versement et le délai de jouissance de la SCPI.
 *  - Le prix de part est supposé constant (pas de revalorisation), revenus bruts de fiscalité.
 */

document.addEventListener('DOMContentLoaded', function () {
    const listEl = document.getElementById('sim-scpi-list');
    if (!listEl) return;

    // Données issues du tableau "Notre sélection de SCPI" (exercice 2025)
    // jouissanceMois = nombre de mois sans revenus (entrée en jouissance le 1er jour du mois suivant)
    // vpMin / vpLabel = minimum de la colonne "Versement permanent" ; vpAutorise = versements programmés possibles
    const SCPI = [
        { id: 'comete',      societe: 'Alderan',    nom: 'Comète',             logo: '../assets/logos/alderan.png',    frais: 0.10, td: 0.09,   ticket: 5000, jouissanceMois: 5, jouissanceLabel: '1er jour du 6e mois', vpAutorise: true,  vpMin: 50,  vpLabel: '50 €/mois' },
        { id: 'coeur',       societe: 'Sogenial',   nom: 'Cœur d’Europe', logo: '../assets/logos/sogenial.svg',   frais: 0.12, td: 0.0625, ticket: 2040, jouissanceMois: 5, jouissanceLabel: '1er jour du 6e mois', vpAutorise: true,  vpMin: 204, vpLabel: '204 €/mois' },
        { id: 'transitions', societe: 'Arkéa REIM', nom: 'Transitions Europe', logo: '../assets/logos/arkea-reim.png', frais: 0.10, td: 0.076,  ticket: 1000, jouissanceMois: 5, jouissanceLabel: '1er jour du 6e mois', vpAutorise: true,  vpMin: 202, vpLabel: '202 €/mois' },
        { id: 'iroko',       societe: 'Iroko',      nom: 'Iroko Zen',          logo: '../assets/logos/iroko.webp',     frais: 0,    td: 0.0714, ticket: 5000, jouissanceMois: 3, jouissanceLabel: '1er jour du 4e mois', vpAutorise: true,  vpMin: 50,  vpLabel: '50 €/mois' },
        { id: 'remake',      societe: 'Remake AM',  nom: 'Remake Live',        logo: '../assets/logos/remake.svg',     frais: 0,    td: 0.0705, ticket: 204,  jouissanceMois: 3, jouissanceLabel: '1er jour du 4e mois', vpAutorise: true,  vpMin: 204, vpLabel: '204 €/mois' },
        { id: 'eurion',      societe: 'Corum',      nom: 'Corum Eurion',       logo: '../assets/logos/corum.svg',      frais: 0.10, td: 0.0573, ticket: 215,  jouissanceMois: 5, jouissanceLabel: '1er jour du 6e mois', vpAutorise: true,  vpMin: 50,  vpLabel: '50 €/mois' },
        { id: 'wemo',        societe: 'Wemo REIM',  nom: 'Wemo One',           logo: '../assets/logos/wemo.svg',       frais: 0.10, td: 0.1527, ticket: 1050, jouissanceMois: 5, jouissanceLabel: '1er jour du 6e mois', vpAutorise: true,  vpMin: 200, vpLabel: '200 €' }
    ];

    const montantInput = document.getElementById('sim-montant');
    const dureeInput = document.getElementById('sim-duree');
    const dureeOutput = document.getElementById('sim-duree-output');
    const allocStatusEl = document.getElementById('sim-alloc-status');
    const resultsEl = document.getElementById('sim-results');
    const versementInput = document.getElementById('sim-versement');
    const versementWrap = document.getElementById('sim-versement-wrap');
    const versementSuffix = document.getElementById('sim-versement-suffix');
    const versementHint = document.getElementById('sim-versement-hint');

    const FREQ_LABELS = { 1: { suffixe: '€ / mois', nom: 'mensuel', par: 'par mois' }, 3: { suffixe: '€ / trimestre', nom: 'trimestriel', par: 'par trimestre' }, 12: { suffixe: '€ / an', nom: 'annuel', par: 'par an' } };

    const fmtEuro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    const fmtEuroCents = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
    const fmtPct = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

    function euro(v) { return fmtEuro.format(Math.round(v)); }
    function pct(v) { return fmtPct.format(v) + ' %'; }

    /* ------------------------------------------------------------------ */
    /* Construction de la liste des SCPI sélectionnables                    */
    /* ------------------------------------------------------------------ */
    SCPI.forEach(function (s) {
        const card = document.createElement('label');
        card.className = 'sim-scpi-card';
        card.setAttribute('for', 'sim-check-' + s.id);
        card.innerHTML =
            '<input type="checkbox" id="sim-check-' + s.id + '" data-scpi="' + s.id + '">' +
            '<span class="sim-scpi-main">' +
                '<img src="' + s.logo + '" alt="Logo ' + s.societe + '" loading="lazy" width="72" height="28">' +
                '<span class="sim-scpi-names"><strong>' + s.nom + '</strong><small>' + s.societe + '</small></span>' +
            '</span>' +
            '<span class="sim-scpi-meta">' +
                '<span class="sim-tag sim-tag-td" title="Taux de distribution 2025">' + fmtPct.format(s.td * 100) + '&nbsp;%</span>' +
                '<span class="sim-tag" title="Frais sur versement">Frais ' + fmtPct.format(s.frais * 100) + '&nbsp;%</span>' +
            '</span>' +
            '<span class="sim-scpi-alloc"><input type="number" min="0" max="100" step="1" data-alloc="' + s.id + '" aria-label="Part du versement affectée à ' + s.nom + ' (%)"><span>%</span></span>';
        listEl.appendChild(card);
    });

    const checkboxes = Array.prototype.slice.call(listEl.querySelectorAll('input[type="checkbox"]'));
    const allocInputs = {};
    Array.prototype.forEach.call(listEl.querySelectorAll('input[data-alloc]'), function (input) {
        allocInputs[input.getAttribute('data-alloc')] = input;
    });

    function selectedScpi() {
        return SCPI.filter(function (s) {
            return document.getElementById('sim-check-' + s.id).checked;
        });
    }

    function frequenceMois() {
        const checked = document.querySelector('input[name="sim-frequence"]:checked');
        return checked ? parseInt(checked.value, 10) : 0;
    }

    /* Répartition égale (en %) quand la sélection change */
    function resetAllocations() {
        const selected = selectedScpi();
        SCPI.forEach(function (s) {
            const input = allocInputs[s.id];
            const card = input.closest('.sim-scpi-card');
            const isSelected = selected.indexOf(s) !== -1;
            card.classList.toggle('selected', isSelected);
            input.parentElement.style.visibility = isSelected ? 'visible' : 'hidden';
            if (!isSelected) { input.value = ''; return; }
        });
        if (selected.length === 0) return;
        const base = Math.floor(1000 / selected.length) / 10; // 1 décimale
        selected.forEach(function (s, i) {
            const isLast = i === selected.length - 1;
            allocInputs[s.id].value = isLast
                ? Math.round((100 - base * (selected.length - 1)) * 10) / 10
                : base;
        });
    }

    /* ------------------------------------------------------------------ */
    /* Moteur de calcul (pas mensuel)                                       */
    /* ------------------------------------------------------------------ */
    /**
     * @param scpi                SCPI simulée
     * @param versementInitial    versement au mois 0
     * @param versementProgramme  montant de chaque versement programmé (0 si aucun)
     * @param freqMois            périodicité en mois (1, 3, 12) ou 0 si aucun versement programmé
     * @param annees              durée de placement
     * @param capitaliser         true = revenus réinvestis en nouvelles parts
     */
    function simulateOne(scpi, versementInitial, versementProgramme, freqMois, annees, capitaliser) {
        const nbMois = annees * 12;
        // Capital net entrant en jouissance au mois t (délai de jouissance appliqué à chaque versement)
        const entreesJouissance = new Array(nbMois).fill(0);
        // Flux de trésorerie mensuels de l'épargnant (pour le TRI) : versements négatifs, revenus perçus positifs
        const cashflows = new Array(nbMois + 1).fill(0);

        let capital = 0;               // capital net investi total (en jouissance ou en attente)
        let capitalEnJouissance = 0;
        let totalVerse = 0;
        let versementsProgrammes = 0;
        let fraisVersements = 0;
        let fraisReinvest = 0;
        let revenusPercus = 0;
        let revenusGeneres = 0;
        const parAnnee = [];
        let dividendeAnnee = 0;
        let verseAnnee = 0;

        function investir(montant, mois, estReinvestissement) {
            if (montant <= 0) return;
            const frais = montant * scpi.frais;
            if (estReinvestissement) { fraisReinvest += frais; } else { fraisVersements += frais; }
            const net = montant - frais;
            capital += net;
            const debutJouissance = mois + scpi.jouissanceMois;
            if (debutJouissance < nbMois) entreesJouissance[debutJouissance] += net;
        }

        for (let t = 0; t < nbMois; t++) {
            // Versement initial au mois 0, versements programmés ensuite selon la périodicité
            if (t === 0) {
                totalVerse += versementInitial;
                verseAnnee += versementInitial;
                cashflows[t] -= versementInitial;
                investir(versementInitial, t, false);
            } else if (versementProgramme > 0 && freqMois > 0 && t % freqMois === 0) {
                totalVerse += versementProgramme;
                versementsProgrammes += versementProgramme;
                verseAnnee += versementProgramme;
                cashflows[t] -= versementProgramme;
                investir(versementProgramme, t, false);
            }

            // Le capital versé il y a "jouissanceMois" mois commence à produire des revenus
            capitalEnJouissance += entreesJouissance[t];
            const dividende = capitalEnJouissance * scpi.td / 12;
            revenusGeneres += dividende;
            dividendeAnnee += dividende;
            if (capitaliser) {
                investir(dividende, t, true);
            } else {
                revenusPercus += dividende;
                cashflows[t] += dividende;
            }

            if ((t + 1) % 12 === 0) {
                parAnnee.push({
                    annee: (t + 1) / 12,
                    verse: verseAnnee,
                    verseCumule: totalVerse,
                    dividende: dividendeAnnee,
                    capital: capital,
                    revenusCumules: revenusPercus,
                    valeur: capital + revenusPercus
                });
                dividendeAnnee = 0;
                verseAnnee = 0;
            }
        }

        const valeurFinale = capital + revenusPercus;
        cashflows[nbMois] += capital; // valeur du capital récupérée au terme (les revenus perçus sont déjà dans les flux)

        return {
            scpi: scpi,
            versementInitial: versementInitial,
            versementsProgrammes: versementsProgrammes,
            versement: totalVerse,
            fraisVersements: fraisVersements,
            fraisReinvest: fraisReinvest,
            fraisTotaux: fraisVersements + fraisReinvest,
            capitalInvesti: totalVerse - fraisVersements,
            capitalFinal: capital,
            revenusPercus: revenusPercus,
            revenusGeneres: revenusGeneres,
            valeurFinale: valeurFinale,
            gainNet: valeurFinale - totalVerse,
            parAnnee: parAnnee,
            cashflows: cashflows
        };
    }

    /* TRI annualisé (taux de rendement interne) sur des flux mensuels, par dichotomie */
    function triAnnuel(cashflows) {
        function van(tauxMensuel) {
            let v = 0;
            for (let t = 0; t < cashflows.length; t++) {
                v += cashflows[t] / Math.pow(1 + tauxMensuel, t);
            }
            return v;
        }
        let bas = -0.06, haut = 0.06; // bornes mensuelles (≈ -52 % à +101 % par an)
        if (van(bas) <= 0) return (Math.pow(1 + bas, 12) - 1) * 100;
        if (van(haut) >= 0) return (Math.pow(1 + haut, 12) - 1) * 100;
        for (let i = 0; i < 80; i++) {
            const milieu = (bas + haut) / 2;
            if (van(milieu) > 0) { bas = milieu; } else { haut = milieu; }
        }
        return (Math.pow(1 + (bas + haut) / 2, 12) - 1) * 100;
    }

    /* ------------------------------------------------------------------ */
    /* Rendu des résultats                                                  */
    /* ------------------------------------------------------------------ */
    function render() {
        const selected = selectedScpi();
        const montant = Math.max(0, parseFloat(montantInput.value) || 0);
        const annees = parseInt(dureeInput.value, 10) || 1;
        const capitaliser = document.querySelector('input[name="sim-capitalisation"]:checked').value === 'capitaliser';
        const freqMois = frequenceMois();
        const vpMontant = freqMois > 0 ? Math.max(0, parseFloat(versementInput.value) || 0) : 0;

        dureeOutput.textContent = annees + ' an' + (annees > 1 ? 's' : '');

        // Champ montant des versements programmés affiché seulement si une périodicité est choisie
        versementWrap.hidden = freqMois === 0;
        versementHint.hidden = freqMois === 0;
        if (freqMois > 0) versementSuffix.textContent = FREQ_LABELS[freqMois].suffixe;

        // Poids de répartition saisis (normalisés si le total diffère de 100 %)
        let totalPct = 0;
        const poids = {};
        selected.forEach(function (s) {
            const v = Math.max(0, parseFloat(allocInputs[s.id].value) || 0);
            poids[s.id] = v;
            totalPct += v;
        });

        if (selected.length > 1 && Math.abs(totalPct - 100) > 0.05 && totalPct > 0) {
            allocStatusEl.hidden = false;
            allocStatusEl.innerHTML = '<i class="fas fa-circle-info" aria-hidden="true"></i> La répartition saisie totalise <strong>' + fmtPct.format(Math.round(totalPct * 10) / 10) + '&nbsp;%</strong> : le montant est réparti proportionnellement à ces poids.';
        } else {
            allocStatusEl.hidden = true;
        }

        if (selected.length === 0 || (montant <= 0 && vpMontant <= 0)) {
            resultsEl.innerHTML =
                '<div class="sim-empty">' +
                    '<i class="fas fa-chart-line" aria-hidden="true"></i>' +
                    '<p>' + (selected.length === 0
                        ? 'Sélectionnez au moins une SCPI ci-dessus pour lancer la simulation.'
                        : 'Indiquez un montant à placer pour lancer la simulation.') + '</p>' +
                '</div>';
            return;
        }

        // Simulation par SCPI (les versements programmés suivent la même répartition que le versement initial)
        const resultats = selected.map(function (s) {
            const part = totalPct > 0 ? poids[s.id] / totalPct : 1 / selected.length;
            const vpScpi = s.vpAutorise ? vpMontant * part : 0;
            return simulateOne(s, montant * part, vpScpi, freqMois, annees, capitaliser);
        });

        // Totaux
        const total = resultats.reduce(function (acc, r) {
            acc.versement += r.versement;
            acc.versementsProgrammes += r.versementsProgrammes;
            acc.fraisVersements += r.fraisVersements;
            acc.fraisReinvest += r.fraisReinvest;
            acc.fraisTotaux += r.fraisTotaux;
            acc.capitalInvesti += r.capitalInvesti;
            acc.capitalFinal += r.capitalFinal;
            acc.revenusPercus += r.revenusPercus;
            acc.revenusGeneres += r.revenusGeneres;
            acc.valeurFinale += r.valeurFinale;
            acc.gainNet += r.gainNet;
            return acc;
        }, { versement: 0, versementsProgrammes: 0, fraisVersements: 0, fraisReinvest: 0, fraisTotaux: 0, capitalInvesti: 0, capitalFinal: 0, revenusPercus: 0, revenusGeneres: 0, valeurFinale: 0, gainNet: 0 });

        // TRI annualisé sur l'ensemble des flux (tient compte des dates de chaque versement et revenu)
        const fluxTotaux = new Array(annees * 12 + 1).fill(0);
        resultats.forEach(function (r) {
            r.cashflows.forEach(function (v, t) { fluxTotaux[t] += v; });
        });
        const rendementAnnuel = total.versement > 0 ? triAnnuel(fluxTotaux) : 0;

        // Alertes ticket d'entrée (sur le versement initial)
        const alertes = resultats
            .filter(function (r) { return r.versementInitial < r.scpi.ticket; })
            .map(function (r) {
                return '<li>' + r.scpi.nom + ' : versement initial simulé de ' + euro(r.versementInitial) +
                    ', inférieur au ticket d’entrée de ' + euro(r.scpi.ticket) + '.</li>';
            });

        // Alertes versements programmés (colonne "Versement permanent" du tableau)
        const alertesVp = [];
        if (freqMois > 0 && vpMontant > 0) {
            resultats.forEach(function (r) {
                const s = r.scpi;
                const part = totalPct > 0 ? poids[s.id] / totalPct : 1 / selected.length;
                const vpScpi = vpMontant * part;
                if (!s.vpAutorise) {
                    alertesVp.push('<li>' + s.nom + ' : les versements programmés ne sont pas autorisés (« Versement permanent : non autorisé ») — la part de ' + euro(vpScpi) + ' ' + FREQ_LABELS[freqMois].par + ' qui lui reviendrait n’est pas investie dans la simulation.</li>');
                } else if (vpScpi < s.vpMin) {
                    alertesVp.push('<li>' + s.nom + ' : versement programmé de ' + euro(vpScpi) + ' ' + FREQ_LABELS[freqMois].par + ', inférieur au minimum de ' + euro(s.vpMin) + ' par versement (« Versement permanent : ' + s.vpLabel + ' »).</li>');
                }
            });
        }

        const gainClass = total.gainNet >= 0 ? 'positive' : 'negative';
        const gainSign = total.gainNet >= 0 ? '+' : '−';

        let html = '';

        // Bandeau de synthèse
        html += '<div class="sim-hero">' +
            '<div class="sim-hero-main">' +
                '<span class="sim-hero-label">Valeur totale au terme (' + annees + ' an' + (annees > 1 ? 's' : '') + ')</span>' +
                '<span class="sim-hero-value">' + euro(total.valeurFinale) + '</span>' +
                '<span class="sim-hero-gain ' + gainClass + '">' + gainSign + '&nbsp;' + euro(Math.abs(total.gainNet)) + ' de gain net' + (capitaliser ? ', revenus capitalisés' : ', revenus perçus') + '</span>' +
            '</div>' +
            '<div class="sim-hero-stats">' +
                '<div class="sim-stat"><span>Montant versé' + (total.versementsProgrammes > 0.5 ? ' (dont ' + euro(total.versementsProgrammes) + ' de versements programmés)' : '') + '</span><strong>' + euro(total.versement) + '</strong></div>' +
                '<div class="sim-stat"><span>Frais sur versement' + (capitaliser && total.fraisReinvest > 0.5 ? ' (dont réinvestissements)' : '') + '</span><strong>' + euro(total.fraisTotaux) + '</strong></div>' +
                (capitaliser
                    ? '<div class="sim-stat"><span>Capital au terme</span><strong>' + euro(total.capitalFinal) + '</strong></div>'
                    : '<div class="sim-stat"><span>Revenus perçus cumulés</span><strong>' + euro(total.revenusPercus) + '</strong></div>') +
                '<div class="sim-stat"><span>Rendement annuel moyen net de frais (TRI)</span><strong>' + fmtPct.format(Math.round(rendementAnnuel * 100) / 100) + '&nbsp;%</strong></div>' +
            '</div>' +
        '</div>';

        if (alertes.length > 0) {
            html += '<div class="sim-warning"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i><div><strong>Ticket d’entrée non atteint</strong><ul>' + alertes.join('') + '</ul></div></div>';
        }
        if (alertesVp.length > 0) {
            html += '<div class="sim-warning"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i><div><strong>Versements programmés : minimums du tableau non respectés</strong><ul>' + alertesVp.join('') + '</ul></div></div>';
        }

        // Détail par SCPI
        html += '<div class="partners-table sim-detail-table"><table>' +
            '<thead><tr>' +
                '<th>SCPI</th><th>Répartition</th><th>Montant versé</th><th>Frais sur versement</th><th>Capital net investi</th>' +
                (capitaliser
                    ? '<th>Revenus réinvestis</th><th>Capital au terme</th>'
                    : '<th>Revenus annuels (année pleine)</th><th>Revenus perçus cumulés</th>') +
                '<th>Valeur au terme</th><th>Gain net</th>' +
            '</tr></thead><tbody>';

        resultats.forEach(function (r) {
            const part = totalPct > 0 ? poids[r.scpi.id] / totalPct * 100 : 100 / selected.length;
            const g = r.gainNet >= 0 ? 'positive' : 'negative';
            html += '<tr>' +
                '<td class="contract-name">' + r.scpi.nom + '<br><span class="muted">' + r.scpi.societe + '</span></td>' +
                '<td class="nowrap">' + fmtPct.format(Math.round(part * 10) / 10) + '&nbsp;%</td>' +
                '<td class="nowrap">' + euro(r.versement) + '</td>' +
                '<td class="nowrap">' + euro(r.fraisTotaux) + '</td>' +
                '<td class="nowrap">' + euro(r.capitalInvesti) + '</td>' +
                (capitaliser
                    ? '<td class="nowrap">' + euro(r.revenusGeneres) + '</td><td class="nowrap">' + euro(r.capitalFinal) + '</td>'
                    : '<td class="nowrap">' + euro(r.capitalInvesti * r.scpi.td) + '</td><td class="nowrap">' + euro(r.revenusPercus) + '</td>') +
                '<td class="nowrap">' + euro(r.valeurFinale) + '</td>' +
                '<td class="nowrap sim-gain ' + g + '">' + (r.gainNet >= 0 ? '+' : '−') + '&nbsp;' + euro(Math.abs(r.gainNet)) + '</td>' +
            '</tr>';
        });
        html += '</tbody></table></div>';

        // Évolution année par année (agrégée)
        const avecVp = total.versementsProgrammes > 0.5;
        html += '<details class="sim-evolution"><summary><i class="fas fa-table-list" aria-hidden="true"></i> Voir l’évolution année par année</summary>' +
            '<div class="partners-table"><table>' +
            '<thead><tr><th>Année</th>' +
            (avecVp ? '<th>Versements cumulés</th>' : '') +
            '<th>Revenus de l’année</th>' +
            (capitaliser ? '<th>Capital en fin d’année</th>' : '<th>Revenus perçus cumulés</th>') +
            '<th>Valeur totale</th></tr></thead><tbody>';

        for (let a = 0; a < annees; a++) {
            let dividende = 0, capital = 0, revenusCumules = 0, valeur = 0, verseCumule = 0;
            resultats.forEach(function (r) {
                dividende += r.parAnnee[a].dividende;
                capital += r.parAnnee[a].capital;
                revenusCumules += r.parAnnee[a].revenusCumules;
                valeur += r.parAnnee[a].valeur;
                verseCumule += r.parAnnee[a].verseCumule;
            });
            html += '<tr><td class="nowrap">Année ' + (a + 1) + '</td>' +
                (avecVp ? '<td class="nowrap">' + fmtEuroCents.format(Math.round(verseCumule)) + '</td>' : '') +
                '<td class="nowrap">' + fmtEuroCents.format(Math.round(dividende)) + '</td>' +
                '<td class="nowrap">' + (capitaliser ? fmtEuroCents.format(Math.round(capital)) : fmtEuroCents.format(Math.round(revenusCumules))) + '</td>' +
                '<td class="nowrap perf">' + fmtEuroCents.format(Math.round(valeur)) + '</td></tr>';
        }
        html += '</tbody></table></div><p class="sim-evolution-note">Chaque versement (initial comme programmé) n’entre en jouissance qu’après le délai propre à chaque SCPI et ne produit aucun revenu avant cette date (' + selected.map(function (s) { return s.nom + ' : ' + s.jouissanceLabel; }).join(' · ') + ').</p></details>';

        resultsEl.innerHTML = html;
    }

    /* ------------------------------------------------------------------ */
    /* Écouteurs                                                            */
    /* ------------------------------------------------------------------ */
    checkboxes.forEach(function (cb) {
        cb.addEventListener('change', function () {
            resetAllocations();
            render();
        });
    });

    Object.keys(allocInputs).forEach(function (id) {
        allocInputs[id].addEventListener('input', render);
        // Le clic sur le champ % ne doit pas (dé)cocher la carte
        allocInputs[id].addEventListener('click', function (e) { e.stopPropagation(); });
    });

    montantInput.addEventListener('input', render);
    dureeInput.addEventListener('input', render);
    versementInput.addEventListener('input', render);
    Array.prototype.forEach.call(document.querySelectorAll('input[name="sim-capitalisation"]'), function (radio) {
        radio.addEventListener('change', render);
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="sim-frequence"]'), function (radio) {
        radio.addEventListener('change', render);
    });

    // État initial : les deux SCPI sans frais + une classique pour illustrer le comparatif
    document.getElementById('sim-check-iroko').checked = true;
    document.getElementById('sim-check-transitions').checked = true;
    resetAllocations();
    render();
});
