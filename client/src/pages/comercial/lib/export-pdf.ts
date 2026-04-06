/**
 * Export the current Simulador CPD page as PDF via window.print().
 * Injects a <style> for @media print, triggers print, then cleans up.
 */
export function exportPDF(revenda?: string): void {
  const styleId = "simulador-cpd-print-style";

  // Avoid duplicate injection
  if (document.getElementById(styleId)) {
    window.print();
    return;
  }

  const now = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const headerSubtitle = revenda
    ? `${revenda} — ${now}`
    : now;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    @media print {
      /* ── Hide navigation chrome ── */
      aside,
      nav,
      [data-sidebar],
      [data-print-hide],
      header .flex.items-center.gap-2 {
        display: none !important;
      }

      /* ── Force dark background for print ── */
      html, body {
        background-color: #0A0A0A !important;
        color: #e5e5e5 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      /* ── Print header ── */
      body::before {
        content: "Renov — Simulador CPD";
        display: block;
        font-size: 18px;
        font-weight: 700;
        font-family: Montserrat, system-ui, sans-serif;
        color: #e5e5e5;
        padding: 16px 24px 4px;
      }
      body::after {
        content: "${headerSubtitle}";
        display: block;
        font-size: 11px;
        font-family: Montserrat, system-ui, sans-serif;
        color: #a3a3a3;
        padding: 0 24px 16px;
        border-bottom: 1px solid #333;
        margin-bottom: 16px;
      }

      /* ── Layout adjustments ── */
      main, [role="main"], .flex-1 {
        overflow: visible !important;
        height: auto !important;
      }

      /* ── Page break between simulator and anatomy ── */
      .xl\\:col-span-2 {
        break-before: page;
      }

      /* ── Ensure cards print with backgrounds ── */
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      /* ── Page margins ── */
      @page {
        size: A4 landscape;
        margin: 12mm;
      }
    }
  `;

  document.head.appendChild(style);

  // Small delay for style to apply before print dialog
  requestAnimationFrame(() => {
    window.print();
    // Clean up after print dialog closes
    window.addEventListener(
      "afterprint",
      () => {
        style.remove();
      },
      { once: true },
    );
  });
}
