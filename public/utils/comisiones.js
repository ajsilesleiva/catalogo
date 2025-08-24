// ---------------- Utils ----------------
const IVA_FALLBACK = 15;          // % si una línea no trae tax_percentage
const AjSiles_Name = 'AjSiles';      // fabricante que comisiona 8%
const RATE_VIDA = 0.08;      // comisión por AjSiles
const RATE_OTHERS = 0.08;   // comisión por otros fabricantes

const toISO = d => (d ? new Date(d).toISOString().slice(0, 10) : '');

// descuento de entidad (a nivel factura) prorrateado antes de impuestos
function entityDiscountFactor(inv, preTaxSubtotal) {
    if (String(inv.discount_type || '') !== 'entity_level') return 1;

    // Si Zoho mandó "discount" como porcentaje
    if (typeof inv.discount === 'number' && inv.discount > 0) {
        return 1 - (inv.discount / 100);
    }

    // Si mandó "discount_amount" como monto absoluto
    if (typeof inv.discount_amount === 'number' && inv.discount_amount > 0 && preTaxSubtotal > 0) {
        return (preTaxSubtotal - inv.discount_amount) / preTaxSubtotal;
    }

    return 1;
}


// helpers en server.js
function isCommissionable(inv) {
    const status = (inv.invoice_status || inv.status || '').toLowerCase();
    const type = (inv.invoice_type || '').toLowerCase();

    const isPaid = status === 'paid' || inv.balance === 0;
    const isCred = type.includes('credit') || type.includes('creditnote');
    const isVoid = status === 'void';
    console.log('%cpublic/utils/comisiones.js:35 isPaid', 'color: #007acc;', isPaid,
        'isCred', isCred, 'isVoid', isVoid, 'status', status, 'type', type, 'factura', inv.invoice_number );
    // si traes sub_total o total, puedes reforzar:
    const nonPositive = (typeof inv.sub_total === 'number' ? inv.sub_total : inv.total) <= 0;
    // console.log('%cpublic/utils/comisiones.js:39 nonPositive', 'color: #007acc;', nonPositive);
    return isPaid && !isCred && !isVoid && !nonPositive;
}

// function isPaid(inv) {
//     // robusto: status, balance, o suma de pagos (si vinieran)
//     if (String(inv.status || '').toLowerCase() === 'paid') return true;
//     if (typeof inv.balance === 'number' && inv.balance === 0) return true;
//     // si tu payload trae payments, puedes sumar aquí
//     return Boolean(inv.last_payment_date || inv.current_sub_status === 'paid');
// }

function lineBaseExVAT(li, invoice, ivaFallback = IVA_FALLBACK) {
    const qty = Number(li.quantity || 0);
    const rate = Number(li.rate || 0);
    let base = qty * rate;

    // Descuentos a nivel línea (si aplica)
    if (typeof li.discount_amount === 'number') base -= Number(li.discount_amount);
    else if (typeof li.discount === 'number') base -= base * (Number(li.discount) / 100);

    // Si los precios vienen con impuesto incluido y la línea trae tax %
    const inclusive = !!invoice.is_inclusive_tax;
    const taxPct = (typeof li.tax_percentage === 'number') ? Number(li.tax_percentage) : ivaFallback;
    if (inclusive && taxPct > 0) base = base / (1 + taxPct / 100);

    return Math.max(0, Number(base.toFixed(2)));
}

// ---------------- Cálculo de comisiones ----------------
/**
 * @param {Array} invoices  // facturas ya con line_items (por detailedlist=true)
 * @param {Map|null} manufacturerMap // Map(item_id -> fabricante). Puede ser null.
 * @returns {Object} { rows:[], totals:{} }
 */
function calcularComisiones(invoices, manufacturerMap = null, rates = {}) {
    const rateVida = typeof rates.vida === 'number' ? rates.vida : RATE_VIDA;
    const rateOtros = typeof rates.otros === 'number' ? rates.otros : RATE_OTHERS;
    // console.log('%cpublic/utils/comisiones.js:60 rateVida, rateOtros', 'color: #007acc;', rateVida, rateOtros);
    const AjSiles_Up = AjSiles_Name.toUpperCase();
    const rows = [];
    let tBaseAjsiles = 0, tComVida = 0, tBaseOtros = 0, tComOtros = 0, tComTotal = 0;
    let tQtyVida = 0, tQtyOtros = 0;

    for (const inv of invoices) {
        if (!isCommissionable(inv)) continue; // solo pagadas
        // if (Number(inv.total || 0) === 0) continue; // sin monto total

        let baseVidaPre = 0, baseOtrosPre = 0, preTaxSubtotal = 0;
        let qtyVida = 0, qtyOtros = 0;

        for (const li of (inv.line_items || [])) {
            // fabricante solo por Map o por li.manufacturer (ya sin heurística por nombre)
            const mf =
                (manufacturerMap && li.item_id && (manufacturerMap.get(li.item_id) || '')) ||
                String(li.manufacturer || '').trim();

            // base SIN IVA de la línea (ya descuenta discount_amount o discount de línea)
            const base = lineBaseExVAT(li, inv);
            const qty = Number(li.quantity || 0);

            preTaxSubtotal += base;

            if (String(mf).toUpperCase() === AjSiles_Name.toUpperCase()) {
                baseVidaPre += base;
                qtyVida += qty;
            } else {
                baseOtrosPre += base;
                qtyOtros += qty;
            }

            // if (String(mf).toUpperCase() === AjSiles_Name.toUpperCase()) baseVidaPre += base;
            // else baseOtrosPre += base;
        }

        // aplica el descuento de entidad proporcionalmente a todas las líneas
        // (si la factura lo tiene y es "before tax", como en tu caso is_discount_before_tax = 1)
        const factor = entityDiscountFactor(inv, preTaxSubtotal);
        const baseVida = Number((baseVidaPre * factor).toFixed(2));
        const baseOtros = Number((baseOtrosPre * factor).toFixed(2));

        const comVida = Number((baseVida * rateVida).toFixed(2));
        const comOtros = Number((baseOtros * rateOtros).toFixed(2));
        const comTot = Number((comVida + comOtros).toFixed(2));

        tBaseAjsiles += baseVida; tComVida += comVida;
        tBaseOtros += baseOtros; tComOtros += comOtros; tComTotal += comTot;
        tQtyVida += qtyVida; tQtyOtros += qtyOtros; // 👈 nuevos

        rows.push({
            invoice_id: inv.invoice_id,
            invoice_number: inv.invoice_number,
            customer_name: inv.customer_name,
            date: toISO(inv.date || inv.invoice_date),
            paid_date: toISO(inv.last_payment_date || inv.paid_date),
            qty_vida: qtyVida,          // 👈 nuevo
            qty_otros: qtyOtros,         // 👈 nuevo
            base_vida: baseVida,
            com_vida: comVida,
            base_otros: baseOtros,
            com_otros: comOtros,
            com_total: comTot,
            status: inv.status || inv.current_sub_status // por si usas el badge
        });
    }

    const totals = {
        tQtyVida: tQtyVida,   // 👈 nuevo
        tQtyOtros: tQtyOtros,  // 👈 nuevo
        tBaseAjsiles: Number(tBaseAjsiles.toFixed(2)),
        tComVida: Number(tComVida.toFixed(2)),
        tBaseOtros: Number(tBaseOtros.toFixed(2)),
        tComOtros: Number(tComOtros.toFixed(2)),
        tComTotal: Number(tComTotal.toFixed(2)),
    };

    // Orden opcional por fecha
    // rows.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    return { rows, totals };
}

module.exports = { calcularComisiones };