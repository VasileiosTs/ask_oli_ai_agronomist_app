import { supabase } from './supabase';

export interface ReportField {
  id: string;
  name: string;
  crop_type: string | null;
  location: string | null;
  size_ha: number | null;
  soil_type: string | null;
  irrigation_type: string | null;
  growing_medium: string | null;
}

interface Intervention {
  id: string;
  field_id: string | null;
  problem: string | null;
  product_applied: string | null;
  dosage: string | null;
  application_method: string | null;
  outcome: string | null;
  applied_at: string;
  notes: string | null;
}

function outcomeLabel(o: string | null, el: boolean): string {
  if (!o) return '—';
  const map: Record<string, [string, string]> = {
    better: ['Βελτίωση ✓', 'Improved ✓'],
    same:   ['Ίδια κατάσταση', 'No change'],
    worse:  ['Επιδείνωση ⚠', 'Worsened ⚠'],
  };
  return el ? (map[o]?.[0] ?? o) : (map[o]?.[1] ?? o);
}

function fmt(iso: string, el: boolean): string {
  return new Date(iso).toLocaleDateString(el ? 'el-GR' : 'en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export async function downloadFieldReport(
  userId: string,
  fields: ReportField[],
  userName: string,
  lang: string
): Promise<void> {
  const el = lang === 'el';

  const { data: interventions } = await supabase
    .from('interventions')
    .select('id, field_id, problem, product_applied, dosage, application_method, outcome, applied_at, notes')
    .eq('user_id', userId)
    .order('applied_at', { ascending: false })
    .limit(300);

  const byField = (interventions ?? []).reduce<Record<string, Intervention[]>>((acc, i: any) => {
    const key = i.field_id ?? '__none__';
    (acc[key] ??= []).push(i);
    return acc;
  }, {});

  const today = new Date().toLocaleDateString(el ? 'el-GR' : 'en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  const label = (k: string, v: string | number | null) =>
    v ? `<span class="meta"><b>${k}:</b> ${v}</span>` : '';

  const fieldSections = fields.map(f => {
    const ints = (byField[f.id] ?? []).slice(0, 15);
    const rows = ints.map(i => `
      <tr>
        <td>${fmt(i.applied_at, el)}</td>
        <td>${i.problem ?? '—'}</td>
        <td>${i.product_applied ?? '—'}</td>
        <td>${i.dosage ?? '—'}</td>
        <td>${outcomeLabel(i.outcome, el)}</td>
      </tr>`).join('');

    const intTable = ints.length > 0 ? `
      <h3>${el ? 'Ιστορικό Επεμβάσεων' : 'Intervention History'}</h3>
      <table>
        <thead><tr>
          <th>${el ? 'Ημερομηνία' : 'Date'}</th>
          <th>${el ? 'Πρόβλημα' : 'Problem'}</th>
          <th>${el ? 'Σκεύασμα' : 'Product'}</th>
          <th>${el ? 'Δόση' : 'Dosage'}</th>
          <th>${el ? 'Αποτέλεσμα' : 'Outcome'}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>` : `<p class="empty">${el ? 'Δεν υπάρχουν καταγεγραμμένες επεμβάσεις.' : 'No interventions recorded.'}</p>`;

    return `
    <div class="card">
      <h2>${f.name}</h2>
      <div class="metas">
        ${label(el ? 'Καλλιέργεια' : 'Crop', f.crop_type)}
        ${label(el ? 'Τοποθεσία' : 'Location', f.location)}
        ${label(el ? 'Έκταση' : 'Size', f.size_ha ? `${f.size_ha} ha` : null)}
        ${label(el ? 'Μέσο ανάπτυξης' : 'Growing medium', f.growing_medium)}
        ${label(el ? 'Έδαφος' : 'Soil', f.soil_type)}
        ${label(el ? 'Άρδευση' : 'Irrigation', f.irrigation_type)}
      </div>
      ${intTable}
    </div>`;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <title>Oli — ${el ? 'Αναφορά Χωραφιών' : 'Field Report'}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#111;background:#fff}
    .page{max-width:900px;margin:0 auto;padding:32px 40px}
    /* Header */
    .hdr{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #2EA043;padding-bottom:16px;margin-bottom:28px}
    .hdr-l{display:flex;align-items:center;gap:10px}
    .logo{font-size:20px;font-weight:700;color:#2EA043}
    .sub{font-size:10px;color:#777;margin-top:2px}
    .hdr-r{text-align:right;font-size:11px;color:#555;line-height:1.6}
    /* Card */
    .card{border:1px solid #ddd;border-radius:10px;padding:20px;margin-bottom:20px;page-break-inside:avoid}
    h2{font-size:15px;font-weight:700;color:#2EA043;margin-bottom:10px}
    h3{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#555;margin:14px 0 8px}
    /* Meta */
    .metas{display:flex;flex-wrap:wrap;gap:6px 18px;padding-bottom:4px}
    .meta{font-size:11px;color:#444}
    /* Table */
    table{width:100%;border-collapse:collapse;font-size:11px;margin-top:2px}
    th{background:#f4fbf4;padding:6px 8px;text-align:left;border-bottom:1px solid #c8e6c9;font-size:10px;font-weight:700;color:#2EA043;text-transform:uppercase;letter-spacing:.04em}
    td{padding:5px 8px;border-bottom:1px solid #f0f0f0;vertical-align:top;color:#333}
    tr:last-child td{border-bottom:none}
    .empty{color:#999;font-style:italic;font-size:11px;margin-top:6px}
    /* Footer */
    .footer{margin-top:32px;padding-top:12px;border-top:1px solid #eee;text-align:center;font-size:10px;color:#aaa}
    @media print{
      .page{padding:16px 20px}
      .card{border-color:#ccc}
    }
  </style>
</head>
<body>
<div class="page">
  <div class="hdr">
    <div class="hdr-l">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="#2EA043"><path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-13 6 0 0 .93-.98 2-2z"/></svg>
      <div>
        <div class="logo">Oli</div>
        <div class="sub">${el ? 'Ο AI Γεωπόνος σου' : 'Your AI Agronomist'}</div>
      </div>
    </div>
    <div class="hdr-r">
      <b>${userName || ''}</b><br>
      ${el ? 'Αναφορά Χωραφιών' : 'Field Report'}<br>
      ${today}
    </div>
  </div>
  ${fields.length === 0
    ? `<p class="empty">${el ? 'Δεν βρέθηκαν χωράφια.' : 'No fields found.'}</p>`
    : fieldSections}
  <div class="footer">askoli.gr &mdash; ${el ? 'Δημιουργήθηκε από το Oli' : 'Generated by Oli'}</div>
</div>
<script>window.addEventListener('load',()=>window.print())</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
