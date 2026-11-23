/**
 * IELTS Prep Hub — Crisp SVG & HTML Visualisers for Writing Task 1 & Task 2
 * Renders grouped bar charts, multi-line graphs, multi-pie charts, financial tables,
 * combined pie+table tasks, process diagrams, before/after map comparisons, and Task 2 blueprints.
 */
(function () {
  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderGroupedBar(spec) {
    const W = 540;
    const H = 270;
    const padL = 48;
    const padR = 20;
    const padT = 22;
    const padB = 42;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const yMax = spec.y_max || 7;
    const steps = 7;

    let grid = "";
    for (let i = 0; i <= steps; i++) {
      const val = ((yMax / steps) * i).toFixed(1);
      const y = padT + plotH - (i / steps) * plotH;
      grid += `
        <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#E5E0D5" stroke-dasharray="${i === 0 ? "0" : "3,3"}" />
        <text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="10.5" fill="#64748B">${val}%</text>
      `;
    }

    const groupW = plotW / spec.categories.length;
    const barCount = spec.series.length;
    const barW = Math.min(24, (groupW - 24) / barCount);

    let bars = "";
    spec.categories.forEach((cat, gIdx) => {
      const groupStart = padL + gIdx * groupW + (groupW - barW * barCount - (barCount - 1) * 4) / 2;
      spec.series.forEach((s, sIdx) => {
        const v = s.values[gIdx];
        const bh = (v / yMax) * plotH;
        const x = groupStart + sIdx * (barW + 4);
        const y = padT + plotH - bh;
        bars += `
          <g>
            <rect x="${x}" y="${y}" width="${barW}" height="${bh}" rx="3" fill="${s.color}">
              <title>${esc(s.name)} (${esc(cat)}): ${v}%</title>
            </rect>
            <text x="${x + barW / 2}" y="${y - 5}" text-anchor="middle" font-size="9.5" font-weight="600" fill="#334155">${v}%</text>
          </g>
        `;
      });
      bars += `<text x="${padL + gIdx * groupW + groupW / 2}" y="${H - 16}" text-anchor="middle" font-size="11" font-weight="600" fill="#1E293B">${esc(cat)}</text>`;
    });

    const legend = spec.series
      .map(
        (s) => `
        <span class="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
          <span class="w-2.5 h-2.5 rounded-full inline-block" style="background:${s.color}"></span>${esc(s.name)}
        </span>`
      )
      .join("");

    return `
      <div class="bg-white rounded-xl border border-paper-subtle p-4">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider text-ink-soft">${esc(spec.y_label)}</span>
          <div class="flex flex-wrap gap-3">${legend}</div>
        </div>
        <svg viewBox="0 0 ${W} ${H}" class="w-full h-auto" role="img" aria-label="Grouped bar chart">
          ${grid}
          ${bars}
        </svg>
      </div>
    `;
  }

  function renderLineChart(spec) {
    const W = 560;
    const H = 275;
    const padL = 52;
    const padR = 20;
    const padT = 20;
    const padB = 40;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const yMax = spec.y_max || 4000;
    const steps = 8;

    let grid = "";
    for (let i = 0; i <= steps; i++) {
      const val = Math.round((yMax / steps) * i);
      const y = padT + plotH - (i / steps) * plotH;
      grid += `
        <line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#E5E0D5" stroke-dasharray="${i === 0 ? "0" : "3,3"}" />
        <text x="${padL - 8}" y="${y + 3.5}" text-anchor="end" font-size="10" fill="#64748B">${val.toLocaleString()}</text>
      `;
    }

    const n = spec.categories.length;
    const xAt = (idx) => padL + (idx / (n - 1)) * plotW;
    const yAt = (val) => padT + plotH - (val / yMax) * plotH;

    let xLabels = "";
    spec.categories.forEach((cat, idx) => {
      const x = xAt(idx);
      xLabels += `
        <line x1="${x}" y1="${padT}" x2="${x}" y2="${padT + plotH}" stroke="#F1EDE4" />
        <text x="${x}" y="${H - 14}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#334155">${esc(cat)}</text>
      `;
    });

    let lines = "";
    spec.series.forEach((s) => {
      const pts = s.values.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
      const dots = s.values
        .map(
          (v, i) => `
          <circle cx="${xAt(i).toFixed(1)}" cy="${yAt(v).toFixed(1)}" r="3.8" fill="${s.color}" stroke="#FFFFFF" stroke-width="1.5">
            <title>${esc(s.name)} (${esc(spec.categories[i])}): ${v.toLocaleString()}</title>
          </circle>`
        )
        .join("");
      lines += `<polyline fill="none" stroke="${s.color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" points="${pts}" />${dots}`;
    });

    const legend = spec.series
      .map(
        (s) => `
        <span class="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
          <span class="w-2.5 h-2.5 rounded-full inline-block" style="background:${s.color}"></span>${esc(s.name)}
        </span>`
      )
      .join("");

    return `
      <div class="bg-white rounded-xl border border-paper-subtle p-4">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span class="text-xs font-semibold uppercase tracking-wider text-ink-soft">${esc(spec.y_label)}</span>
          <div class="flex flex-wrap gap-3">${legend}</div>
        </div>
        <svg viewBox="0 0 ${W} ${H}" class="w-full h-auto" role="img" aria-label="Line graph">
          ${xLabels}
          ${grid}
          ${lines}
        </svg>
      </div>
    `;
  }

  function svgPie(slices, size = 148) {
    const r = 44;
    const cx = size / 2;
    const cy = size / 2;
    const circ = 2 * Math.PI * r;
    let offset = 0;
    const arcs = slices
      .map((sl) => {
        const dash = (sl.value / 100) * circ;
        const seg = `
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="transparent"
            stroke="${sl.color}" stroke-width="28"
            stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}"
            stroke-dashoffset="${(-offset).toFixed(2)}"
            transform="rotate(-90 ${cx} ${cy})">
            <title>${esc(sl.label)}: ${sl.value}%</title>
          </circle>
        `;
        offset += dash;
        return seg;
      })
      .join("");
    return `<svg viewBox="0 0 ${size} ${size}" class="w-32 h-32 mx-auto">${arcs}</svg>`;
  }

  function renderMultiPies(spec) {
    const legendMap = new Map();
    spec.pies.forEach((p) => p.slices.forEach((s) => legendMap.set(s.label, s.color)));
    const legend = Array.from(legendMap.entries())
      .map(
        ([label, color]) => `
        <span class="inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
          <span class="w-2.5 h-2.5 rounded-full inline-block" style="background:${color}"></span>${esc(label)}
        </span>`
      )
      .join("");

    const cards = spec.pies
      .map(
        (p) => `
        <div class="bg-paper rounded-lg p-3 border border-paper-subtle text-center">
          <div class="text-xs font-bold text-ink mb-1">${esc(p.title)}</div>
          ${svgPie(p.slices)}
          <div class="mt-2 space-y-0.5 text-[11px] text-ink-muted">
            ${p.slices
              .map(
                (s) =>
                  `<div class="flex justify-between px-1"><span>${esc(s.label)}</span><span class="font-semibold text-ink">${s.value}%</span></div>`
              )
              .join("")}
          </div>
        </div>`
      )
      .join("");

    return `
      <div class="bg-white rounded-xl border border-paper-subtle p-4">
        <div class="flex flex-wrap gap-3 justify-center mb-3">${legend}</div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">${cards}</div>
      </div>
    `;
  }

  function renderTableSpec(spec) {
    const ths = spec.headers
      .map(
        (h, i) =>
          `<th class="px-3 py-2 text-xs font-semibold uppercase tracking-wider ${
            i === 0 ? "text-left" : "text-right"
          } text-ink-muted bg-paper-warm border-b border-paper-subtle">${esc(h)}</th>`
      )
      .join("");

    const trs = spec.rows
      .map((r, rIdx) => {
        const isTotal = r[0].toLowerCase() === "total";
        const tds = r
          .map((cell, cIdx) => {
            let badgeClass = "";
            if (cIdx === 3) {
              badgeClass = String(cell).includes("↑")
                ? "text-oxford-600 font-semibold"
                : "text-coralwarn-600 font-semibold";
            }
            return `<td class="px-3 py-2 text-xs ${cIdx === 0 ? "text-left font-medium" : "text-right font-mono"} ${
              isTotal ? "font-bold bg-paper-warm text-ink" : "text-ink"
            } ${badgeClass} border-b border-paper-subtle/70">${esc(cell)}</td>`;
          })
          .join("");
        return `<tr class="${rIdx % 2 === 1 && !isTotal ? "bg-paper/60" : ""}">${tds}</tr>`;
      })
      .join("");

    return `
      <div class="bg-white rounded-xl border border-paper-subtle overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full border-collapse">${`<thead><tr>${ths}</tr></thead><tbody>${trs}</tbody>`}</table>
        </div>
      </div>
    `;
  }

  function renderComboPieTable(spec) {
    const pieHtml = `
      <div class="bg-paper rounded-lg p-3 border border-paper-subtle">
        <div class="text-xs font-bold text-ink text-center mb-1">${esc(spec.pie.title)}</div>
        ${svgPie(spec.pie.slices, 144)}
        <div class="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 text-xs">
          ${spec.pie.slices
            .map(
              (s) => `
              <div class="flex items-center justify-between">
                <span class="inline-flex items-center gap-1.5 text-ink-muted">
                  <span class="w-2 h-2 rounded-full" style="background:${s.color}"></span>${esc(s.label)}
                </span>
                <span class="font-semibold text-ink">${s.value}%</span>
              </div>`
            )
            .join("")}
        </div>
      </div>
    `;

    const ths = spec.table.headers
      .map(
        (h, i) =>
          `<th class="px-2.5 py-2 text-[11px] font-semibold uppercase tracking-wider ${
            i === 0 ? "text-left" : "text-right"
          } bg-paper-warm text-ink-muted border-b border-paper-subtle">${esc(h)}</th>`
      )
      .join("");
    const trs = spec.table.rows
      .map(
        (r) =>
          `<tr>${r
            .map(
              (c, i) =>
                `<td class="px-2.5 py-2 text-xs ${
                  i === 0 ? "font-semibold text-left" : "text-right font-mono"
                } border-b border-paper-subtle/70">${esc(c)}</td>`
            )
            .join("")}</tr>`
      )
      .join("");

    return `
      <div class="bg-white rounded-xl border border-paper-subtle p-4 space-y-3">
        ${pieHtml}
        <div class="overflow-x-auto rounded-lg border border-paper-subtle">
          <table class="w-full border-collapse"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>
        </div>
      </div>
    `;
  }

  function renderProcessSpec(spec) {
    const linear = spec.steps.slice(0, 3);
    const branches = spec.steps.slice(3);

    return `
      <div class="bg-white rounded-xl border border-paper-subtle p-4 space-y-2.5">
        <div class="text-xs font-semibold uppercase tracking-wider text-ink-soft mb-1">9-Stage US Food Supply Flowchart</div>
        ${linear
          .map(
            (st, i) => `
            <div class="flex items-start gap-3 bg-paper rounded-lg p-3 border border-paper-subtle">
              <span class="w-6 h-6 rounded-full bg-oxford-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">${
                i + 1
              }</span>
              <div>
                <div class="text-xs font-bold text-ink">${esc(st.stage)}</div>
                <div class="text-xs text-ink-muted">${esc(st.detail)}</div>
              </div>
            </div>
            <div class="text-center text-ink-soft text-xs font-bold leading-none">↓</div>
          `
          )
          .join("")}
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          ${branches
            .map(
              (b, idx) => `
              <div class="rounded-lg p-3 border ${
                idx === 0 ? "bg-oxford-50 border-oxford-200" : "bg-amberband-50 border-amberband-100"
              }">
                <div class="text-xs font-bold text-ink">${esc(b.stage)}</div>
                <div class="text-xs text-ink-muted mt-1">${esc(b.detail)}</div>
              </div>`
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function renderMapCompare(spec) {
    return `
      <div class="bg-white rounded-xl border border-paper-subtle p-4 space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-ink-soft">Spatial Map Matrix: ${esc(
            spec.before_year
          )} → ${esc(spec.after_year)}</span>
          <span class="text-[11px] font-mono bg-paper-warm px-2 py-0.5 rounded text-ink-muted">Compass: N ↑</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          ${spec.zones
            .map(
              (z) => `
              <div class="rounded-lg border border-paper-subtle bg-paper p-2.5">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-bold text-ink">${esc(z.zone)}</span>
                  <span class="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-oxford-50 text-oxford-700">${esc(
                    z.change
                  )}</span>
                </div>
                <div class="text-[11px] text-ink-muted"><strong class="text-ink-soft">2000:</strong> ${esc(
                  z.before
                )}</div>
                <div class="text-[11px] text-ink font-medium mt-0.5"><strong class="text-oxford-600">Present:</strong> ${esc(
                  z.after
                )}</div>
              </div>`
            )
            .join("")}
        </div>
      </div>
    `;
  }

  function renderBlueprint(spec) {
    return `
      <div class="bg-white rounded-xl border border-paper-subtle p-4 space-y-2.5">
        <div class="text-xs font-semibold uppercase tracking-wider text-ink-soft">High-Band Structural Blueprint</div>
        ${spec.blocks
          .map(
            (b, i) => `
            <div class="flex items-start gap-3 rounded-lg bg-paper p-3 border border-paper-subtle">
              <span class="w-6 h-6 rounded-md bg-navyband-600 text-white text-xs font-bold flex items-center justify-center shrink-0">${
                i + 1
              }</span>
              <div>
                <div class="text-xs font-bold text-ink">${esc(b.label)}</div>
                <div class="text-xs text-ink-muted mt-0.5">${esc(b.focus)}</div>
              </div>
            </div>`
          )
          .join("")}
      </div>
    `;
  }

  window.IELTSCharts = {
    render(spec) {
      if (!spec) return "";
      switch (spec.kind) {
        case "bar_grouped":
          return renderGroupedBar(spec);
        case "line":
          return renderLineChart(spec);
        case "pies_multi":
          return renderMultiPies(spec);
        case "table":
          return renderTableSpec(spec);
        case "combo_pie_table":
          return renderComboPieTable(spec);
        case "process":
          return renderProcessSpec(spec);
        case "map_compare":
          return renderMapCompare(spec);
        case "essay_blueprint":
          return renderBlueprint(spec);
        default:
          return "";
      }
    }
  };
})();
