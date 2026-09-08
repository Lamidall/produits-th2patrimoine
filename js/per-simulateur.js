/**
 * TH2 Patrimoine - Simulateur d'économie d'impôt PER
 *
 * Hypothèses de calcul :
 *  - Plafond de déduction "épargne retraite" calculé sur le revenu saisi :
 *    10 % du revenu professionnel, limité à 10 % de 8 PASS, avec un minimum
 *    de 10 % du PASS (PASS 2025 : 47 100 €). Les reports de plafonds N-1 à N-3
 *    et la mutualisation entre conjoints ne sont pas pris en compte.
 *  - Économie d'impôt = versement déductible x TMI (on suppose que la
 *    déduction ne fait pas changer de tranche).
 *  - La TMI estimée affichée à titre indicatif correspond au barème 2026
 *    (revenus 2025) pour un célibataire (1 part), après abattement de 10 %.
 */

document.addEventListener('DOMContentLoaded', function () {
    const revenuInput = document.getElementById('per-revenu');
    if (!revenuInput) return;

    const versementInput = document.getElementById('per-versement');
    const tmiHintEl = document.getElementById('per-tmi-hint');
    const plafondBoxEl = document.getElementById('per-plafond-box');
    const resultsEl = document.getElementById('per-results');

    const PASS = 47100; // PASS 2025, référence pour les versements 2026
    const PLAFOND_MIN = 0.10 * PASS;       // 4 710 €
    const PLAFOND_MAX = 0.10 * 8 * PASS;   // 37 680 €

    // Barème 2026 sur les revenus 2025, pour 1 part (TMI indicative)
    const BAREME = [
        { seuil: 11497,  taux: 0 },
        { seuil: 29315,  taux: 0.11 },
        { seuil: 83823,  taux: 0.30 },
        { seuil: 180294, taux: 0.41 },
        { seuil: Infinity, taux: 0.45 }
    ];

    const TMI_LABELS = { '0': '0 %', '0.11': '11 %', '0.30': '30 %', '0.41': '41 %', '0.45': '45 %' };

    const fmtEuro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
    const fmtPct = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

    function euro(v) { return fmtEuro.format(Math.round(v)); }

    function tmiSelectionnee() {
        const checked = document.querySelector('input[name="per-tmi"]:checked');
        return checked ? parseFloat(checked.value) : 0;
    }

    function tmiEstimee(revenu) {
        // Abattement forfaitaire de 10 % (plancher/plafond ignorés pour rester simple)
        const imposable = revenu * 0.9;
        for (let i = 0; i < BAREME.length; i++) {
            if (imposable <= BAREME[i].seuil) return BAREME[i].taux;
        }
        return 0.45;
    }

    function plafondDeduction(revenu) {
        return Math.min(Math.max(revenu * 0.10, PLAFOND_MIN), PLAFOND_MAX);
    }

    function render() {
        const revenu = Math.max(0, parseFloat(revenuInput.value) || 0);
        const versement = Math.max(0, parseFloat(versementInput.value) || 0);
        const tmi = tmiSelectionnee();

        // Suggestion de TMI d'après le revenu saisi
        if (revenu > 0) {
            const estimee = tmiEstimee(revenu);
            tmiHintEl.innerHTML = 'À titre indicatif, pour un célibataire sans autre revenu (1 part), ce revenu correspond à une TMI de <strong>' +
                fmtPct.format(estimee * 100) + '&nbsp;%</strong>. Votre TMI réelle dépend de votre foyer fiscal (nombre de parts, autres revenus…).';
        } else {
            tmiHintEl.textContent = 'Votre TMI figure sur votre avis d’imposition. Elle dépend de votre foyer fiscal (nombre de parts, autres revenus…).';
        }

        // Plafond de déduction et jauge d'utilisation
        const plafond = plafondDeduction(revenu);
        const utilisation = plafond > 0 ? Math.min(versement / plafond, 1) : 0;
        plafondBoxEl.innerHTML =
            '<div class="sim-plafond-head"><span>Plafond de déduction estimé</span><strong>' + euro(plafond) + '</strong></div>' +
            '<div class="sim-plafond-bar" role="img" aria-label="Utilisation du plafond : ' + fmtPct.format(utilisation * 100) + ' %">' +
                '<div class="sim-plafond-fill' + (versement > plafond ? ' over' : '') + '" style="width:' + (utilisation * 100) + '%"></div>' +
            '</div>' +
            '<p class="sim-plafond-note">Vous utilisez <strong>' + fmtPct.format(utilisation * 100) + '&nbsp;%</strong> de votre plafond annuel (hors reports des 3 années précédentes).</p>';

        if (versement <= 0) {
            resultsEl.innerHTML =
                '<div class="sim-empty">' +
                    '<i class="fas fa-piggy-bank" aria-hidden="true"></i>' +
                    '<p>Indiquez un montant de versement annuel pour estimer votre économie d’impôt.</p>' +
                '</div>';
            return;
        }

        const deductible = Math.min(versement, plafond);
        const excedent = versement - deductible;
        const economie = deductible * tmi;
        const effortReel = versement - economie;
        const tauxReduction = versement > 0 ? economie / versement : 0;

        let html = '';

        // Bandeau de synthèse
        html += '<div class="sim-hero">' +
            '<div class="sim-hero-main">' +
                '<span class="sim-hero-label">Économie d’impôt annuelle estimée (TMI ' + fmtPct.format(tmi * 100) + '&nbsp;%)</span>' +
                '<span class="sim-hero-value">' + euro(economie) + '</span>' +
                '<span class="sim-hero-gain positive">soit ' + fmtPct.format(tauxReduction * 100) + '&nbsp;% de votre versement pris en charge par la fiscalité</span>' +
            '</div>' +
            '<div class="sim-hero-stats">' +
                '<div class="sim-stat"><span>Versement annuel</span><strong>' + euro(versement) + '</strong></div>' +
                '<div class="sim-stat"><span>Versement déductible</span><strong>' + euro(deductible) + '</strong></div>' +
                '<div class="sim-stat"><span>Effort d’épargne réel</span><strong>' + euro(effortReel) + '</strong></div>' +
                '<div class="sim-stat"><span>Économie sur 10 ans (versements identiques)</span><strong>' + euro(economie * 10) + '</strong></div>' +
            '</div>' +
        '</div>';

        if (tmi === 0) {
            html += '<div class="sim-warning"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i><div>' +
                '<strong>TMI à 0&nbsp;% : aucune économie d’impôt immédiate</strong>' +
                'Non imposable, vous ne tirez pas d’avantage fiscal de la déduction. Vous pouvez opter pour des versements non déduits, imposés plus favorablement à la sortie.' +
            '</div></div>';
        }

        if (excedent > 0.5) {
            html += '<div class="sim-warning"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i><div>' +
                '<strong>Plafond de déduction dépassé</strong>' +
                'Sur ' + euro(versement) + ' versés, ' + euro(excedent) + ' excèdent votre plafond estimé et ne sont pas déductibles cette année (hors reports des 3 années précédentes et mutualisation entre conjoints).' +
            '</div></div>';
        }

        // Comparatif de l'économie selon la TMI
        html += '<div class="partners-table sim-detail-table sim-tmi-table"><table>' +
            '<thead><tr><th>TMI</th><th>Économie d’impôt annuelle</th><th>Effort d’épargne réel</th><th>Part du versement financée par l’impôt</th></tr></thead><tbody>';

        Object.keys(TMI_LABELS).forEach(function (key) {
            const t = parseFloat(key);
            const eco = deductible * t;
            const selected = Math.abs(t - tmi) < 0.001;
            html += '<tr' + (selected ? ' class="sim-tmi-current"' : '') + '>' +
                '<td class="nowrap">' + TMI_LABELS[key] + (selected ? ' <span class="sim-tmi-badge">votre TMI</span>' : '') + '</td>' +
                '<td class="nowrap perf">' + euro(eco) + '</td>' +
                '<td class="nowrap">' + euro(versement - eco) + '</td>' +
                '<td class="nowrap">' + fmtPct.format(versement > 0 ? eco / versement * 100 : 0) + '&nbsp;%</td>' +
            '</tr>';
        });
        html += '</tbody></table></div>' +
            '<p class="sim-evolution-note">Plus votre TMI est élevée, plus la déduction des versements PER est avantageuse. À la sortie, le capital issu des versements déduits est imposé au barème de l’impôt sur le revenu (et les gains au PFU)&nbsp;: l’intérêt du PER est maximal lorsque votre TMI à la retraite est inférieure à votre TMI actuelle.</p>';

        resultsEl.innerHTML = html;
    }

    revenuInput.addEventListener('input', render);
    versementInput.addEventListener('input', render);
    Array.prototype.forEach.call(document.querySelectorAll('input[name="per-tmi"]'), function (radio) {
        radio.addEventListener('change', render);
    });

    render();
});
