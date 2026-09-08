/**
 * TH2 Patrimoine - Simulateur de gains Assurance-emprunteur
 *
 * Hypothèses de calcul :
 *  - Coût annuel d'une assurance = TAEA x capital restant dû (le TAEA exprime le
 *    surcoût annuel de l'assurance rapporté au capital, approximation usuelle).
 *  - Le capital restant dû est supposé constant sur la durée restante.
 *  - Chaque emprunteur est supposé assuré sur la totalité du capital (quotité 100 %) :
 *    en cas de quotité inférieure, saisir un TAEA proportionnel.
 *  - Le changement d'assurance entraîne des frais de dossier uniques de 0,50 % du
 *    capital restant dû, avec un minimum forfaitaire de 200 €.
 *  - Économie nette = (TAEA actuel - TAEA futur) x capital restant dû x durée restante
 *    - frais de dossier.
 */

const FRAIS_DOSSIER_TAUX = 0.005; // 0,50 % du capital restant dû
const FRAIS_DOSSIER_MIN = 200;    // minimum forfaitaire en euros

document.addEventListener('DOMContentLoaded', function () {
    const capitalInput = document.getElementById('sim-capital');
    if (!capitalInput) return;

    const dureeAnsInput = document.getElementById('sim-duree-ans');
    const dureeMoisInput = document.getElementById('sim-duree-mois');
    const resultsEl = document.getElementById('sim-results');

    const fmtEuro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    const fmtPct = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    function euro(v) { return fmtEuro.format(Math.round(v)); }
    function pct(v) { return fmtPct.format(v) + ' %'; }

    /* ------------------------------------------------------------------ */
    /* Emprunteurs                                                          */
    /* ------------------------------------------------------------------ */
    const BORROWERS = [1, 2].map(function (n) {
        return {
            n: n,
            fieldset: document.getElementById('sim-emp-' + n),
            age: document.getElementById('sim-age-' + n),
            taeaActuel: document.getElementById('sim-taea-actuel-' + n),
            taeaFutur: document.getElementById('sim-taea-futur-' + n),
            taeaFuturOutput: document.getElementById('sim-taea-futur-' + n + '-output'),
            hint: document.getElementById('sim-hint-' + n)
        };
    });

    function nbEmprunteurs() {
        return parseInt(document.querySelector('input[name="sim-nb-emprunteurs"]:checked').value, 10);
    }

    /* Fourchette de TAEA généralement observée selon l'âge (indicatif) */
    function taeaIndicatif(age) {
        if (!age) return null;
        if (age < 30) return [0.10, 0.30];
        if (age < 40) return [0.15, 0.40];
        if (age < 50) return [0.25, 0.60];
        if (age < 60) return [0.45, 0.90];
        return [0.80, 1.50];
    }

    function updateHints() {
        BORROWERS.forEach(function (b) {
            const age = parseInt(b.age.value, 10);
            const range = taeaIndicatif(age);
            b.hint.textContent = range
                ? 'À titre indicatif, à ' + age + ' ans et sans risque particulier, les TAEA du marché se situent souvent entre ' +
                  fmtPct.format(range[0]) + ' % et ' + fmtPct.format(range[1]) + ' %.'
                : '';
        });
    }

    /* ------------------------------------------------------------------ */
    /* Calcul et rendu                                                      */
    /* ------------------------------------------------------------------ */
    function render() {
        const nb = nbEmprunteurs();
        BORROWERS.forEach(function (b) { b.fieldset.hidden = b.n > nb; });

        BORROWERS.forEach(function (b) {
            b.taeaFuturOutput.textContent = pct(parseFloat(b.taeaFutur.value));
        });
        updateHints();

        const capital = Math.max(0, parseFloat(capitalInput.value) || 0);
        const ans = Math.max(0, parseInt(dureeAnsInput.value, 10) || 0);
        const mois = Math.min(11, Math.max(0, parseInt(dureeMoisInput.value, 10) || 0));
        const totalMois = ans * 12 + mois;
        const annees = totalMois / 12;

        if (capital <= 0 || totalMois <= 0) {
            resultsEl.innerHTML =
                '<div class="sim-empty">' +
                    '<i class="fas fa-calculator" aria-hidden="true"></i>' +
                    '<p>' + (capital <= 0
                        ? 'Indiquez le capital restant dû de votre emprunt pour lancer la simulation.'
                        : 'Indiquez la durée restante de votre emprunt pour lancer la simulation.') + '</p>' +
                '</div>';
            return;
        }

        // Simulation par emprunteur
        const resultats = BORROWERS.slice(0, nb).map(function (b) {
            const taeaActuel = Math.max(0, parseFloat(b.taeaActuel.value) || 0);
            const taeaFutur = parseFloat(b.taeaFutur.value);
            const coutMensuelActuel = capital * (taeaActuel / 100) / 12;
            const coutMensuelFutur = capital * (taeaFutur / 100) / 12;
            return {
                n: b.n,
                age: parseInt(b.age.value, 10) || null,
                taeaActuel: taeaActuel,
                taeaFutur: taeaFutur,
                coutMensuelActuel: coutMensuelActuel,
                coutMensuelFutur: coutMensuelFutur,
                coutTotalActuel: coutMensuelActuel * totalMois,
                coutTotalFutur: coutMensuelFutur * totalMois,
                economie: (coutMensuelActuel - coutMensuelFutur) * totalMois
            };
        });

        const total = resultats.reduce(function (acc, r) {
            acc.coutMensuelActuel += r.coutMensuelActuel;
            acc.coutMensuelFutur += r.coutMensuelFutur;
            acc.coutTotalActuel += r.coutTotalActuel;
            acc.coutTotalFutur += r.coutTotalFutur;
            acc.economie += r.economie;
            return acc;
        }, { coutMensuelActuel: 0, coutMensuelFutur: 0, coutTotalActuel: 0, coutTotalFutur: 0, economie: 0 });

        const economieMensuelle = total.coutMensuelActuel - total.coutMensuelFutur;
        const fraisDossier = Math.max(FRAIS_DOSSIER_MIN, capital * FRAIS_DOSSIER_TAUX);
        const economieNette = total.economie - fraisDossier;
        const reductionPct = total.coutTotalActuel > 0 ? (economieNette / total.coutTotalActuel) * 100 : 0;

        const dureeLabel = ans > 0
            ? ans + ' an' + (ans > 1 ? 's' : '') + (mois > 0 ? ' et ' + mois + ' mois' : '')
            : mois + ' mois';

        const gainClass = economieNette >= 0 ? 'positive' : 'negative';
        const gainSign = economieNette >= 0 ? '+' : '−';

        let html = '';

        // Bandeau de synthèse
        html += '<div class="sim-hero">' +
            '<div class="sim-hero-main">' +
                '<span class="sim-hero-label">Économie nette estimée sur la durée restante (' + dureeLabel + ')</span>' +
                '<span class="sim-hero-value">' + gainSign + '&nbsp;' + euro(Math.abs(economieNette)) + '</span>' +
                '<span class="sim-hero-gain ' + gainClass + '">' +
                    (economieNette >= 0
                        ? 'frais de dossier de ' + euro(fraisDossier) + ' déduits, soit une réduction de ' + fmtPct.format(Math.round(reductionPct * 100) / 100) + ' % du coût de vos assurances-emprunteurs'
                        : (total.economie >= 0
                            ? 'l’économie sur les cotisations (' + euro(total.economie) + ') ne couvre pas les frais de dossier de ' + euro(fraisDossier) + ' : le changement représenterait un surcoût'
                            : 'le TAEA futur saisi est supérieur au TAEA actuel : le changement représenterait un surcoût, frais de dossier de ' + euro(fraisDossier) + ' inclus')) +
                '</span>' +
            '</div>' +
            '<div class="sim-hero-stats">' +
                '<div class="sim-stat"><span>Coût restant de ' + (nb > 1 ? 'vos assurances actuelles' : 'votre assurance actuelle') + '</span><strong>' + euro(total.coutTotalActuel) + '</strong></div>' +
                '<div class="sim-stat"><span>Coût ' + (nb > 1 ? 'des nouvelles assurances' : 'de la nouvelle assurance') + '</span><strong>' + euro(total.coutTotalFutur) + '</strong></div>' +
                '<div class="sim-stat"><span>Frais de dossier (0,50&nbsp;% du capital, min.&nbsp;200&nbsp;€)</span><strong>' + euro(fraisDossier) + '</strong></div>' +
                '<div class="sim-stat"><span>Économie par mois sur les cotisations</span><strong>' + (economieMensuelle >= 0 ? '+' : '−') + '&nbsp;' + euro(Math.abs(economieMensuelle)) + '</strong></div>' +
            '</div>' +
        '</div>';

        // Détail par emprunteur
        html += '<div class="partners-table sim-detail-table sim-emp-table"><table>' +
            '<thead><tr>' +
                '<th>Emprunteur</th><th>Âge</th><th>TAEA actuel</th><th>TAEA futur</th>' +
                '<th>Coût mensuel actuel</th><th>Coût mensuel futur</th>' +
                '<th>Coût restant actuel</th><th>Coût restant futur</th><th>Économie sur les cotisations</th>' +
            '</tr></thead><tbody>';

        resultats.forEach(function (r) {
            const g = r.economie >= 0 ? 'positive' : 'negative';
            html += '<tr>' +
                '<td class="contract-name">Emprunteur ' + r.n + '</td>' +
                '<td class="nowrap">' + (r.age ? r.age + ' ans' : '—') + '</td>' +
                '<td class="nowrap">' + pct(r.taeaActuel) + '</td>' +
                '<td class="nowrap">' + pct(r.taeaFutur) + '</td>' +
                '<td class="nowrap">' + euro(r.coutMensuelActuel) + '</td>' +
                '<td class="nowrap">' + euro(r.coutMensuelFutur) + '</td>' +
                '<td class="nowrap">' + euro(r.coutTotalActuel) + '</td>' +
                '<td class="nowrap">' + euro(r.coutTotalFutur) + '</td>' +
                '<td class="nowrap sim-gain ' + g + '">' + (r.economie >= 0 ? '+' : '−') + '&nbsp;' + euro(Math.abs(r.economie)) + '</td>' +
            '</tr>';
        });
        html += '</tbody></table></div>';

        html += '<p class="sim-evolution-note">Économie sur les cotisations : ' + (total.economie >= 0 ? '' : '−') + euro(Math.abs(total.economie)) +
            ' − frais de dossier de ' + euro(fraisDossier) + ' (0,50&nbsp;% du capital restant dû, minimum forfaitaire de 200&nbsp;€)' +
            ' = économie nette de ' + (economieNette >= 0 ? '' : '−') + euro(Math.abs(economieNette)) + '.</p>';

        resultsEl.innerHTML = html;
    }

    /* ------------------------------------------------------------------ */
    /* Écouteurs                                                            */
    /* ------------------------------------------------------------------ */
    [capitalInput, dureeAnsInput, dureeMoisInput].forEach(function (input) {
        input.addEventListener('input', render);
    });
    BORROWERS.forEach(function (b) {
        [b.age, b.taeaActuel, b.taeaFutur].forEach(function (input) {
            input.addEventListener('input', render);
        });
    });
    Array.prototype.forEach.call(document.querySelectorAll('input[name="sim-nb-emprunteurs"]'), function (radio) {
        radio.addEventListener('change', render);
    });

    render();
});
