/* Otimizador de Build: interface. Usa o motor TL (engine.js). Sem etapa de build: scripts comuns, funciona abrindo index.html. */
(() => {
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = (n, d = 0) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const sgn = (n, d = 2) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n), d) + '%';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const stat = c => TL.STATS.find(s => s.chave === c);
const BOSSES = [['Golem', 130], ['Vulkan', 170], ['Chefe médio', 300], ['Calanthia', 540], ['Zairos', 1500]];

/* ---------- armazenamento (localStorage; se falhar, funciona sem salvar) ---------- */
const KEY = 'tl-otimizador-v1';
const D = {
  data: null,
  fresh() {
    return { v: 1, active: 'b1', builds: [{ id: 'b1', nome: 'Mago full (exemplo)', exemplo: true, b: { ...TL.BUILD } }],
      alvo: { ...TL.ALVO }, opc: { ...TL.OPC }, foco: 'dano', tema: 'auto',
      whatif: [{ chave: 'dc', delta: 20 }, { chave: 'pesado', delta: -300 }] };
  },
  load() { try { const j = JSON.parse(localStorage.getItem(KEY)); if (j && j.builds && j.builds.length) { this.data = j; return; } } catch (e) {} this.data = this.fresh(); },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) {} },
};
D.load();
const norm = b => ({ ...TL.BUILD, ...b });
const cur = () => D.data.builds.find(x => x.id === D.data.active) || D.data.builds[0];
const B = () => norm(cur().b);
const T = () => D.data.alvo;
const O = () => D.data.opc;
const F = () => D.data.foco;
const ui = { metodo: 'print', curva: 'crit', cmpA: null, cmpB: null };
let toastT;
function toast(msg) {
  let t = $('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2200);
}

/* ---------- zonas ---------- */
function zona(g) {
  const a = Math.abs(g);
  if (a < 0.005) return { k: 'zero', rot: 'Não afeta', ic: '–' };
  if (g >= 1) return { k: 'good', rot: 'Rende bem', ic: '✓' };
  if (g >= 0.5) return { k: 'warn', rot: 'Caro', ic: '▲' };
  return { k: 'crit', rot: 'Quase não rende', ic: '●' };
}
const chip = z => `<span class="chip z-${z.k}"><span aria-hidden="true">${z.ic}</span>${z.rot}</span>`;
const focoNome = () => TL.FOCOS[F()].nome;
function linhas() {
  const b = B(), t = T(), o = O(), f = F();
  return TL.STATS.map(s => ({ s, val: TL.valor(b, s.chave), up: TL.ganho(b, s.chave, s.passo, f, t, o), down: TL.ganho(b, s.chave, -s.passo, f, t, o) }));
}

/* ---------- icones ---------- */
const IC = {
  inicio: '<path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10"/>',
  otimizar: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  curvas: '<path d="M3 19c4 0 5-14 9-14s4 14 9 14"/>',
  whatif: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  builds: '<path d="M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5M3 17.5l9 5 9-5"/>',
  ficha: '<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6"/>',
  sobre: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
};
const icon = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]}</svg>`;
const PAGES = [['inicio', 'Início'], ['otimizar', 'Otimizar'], ['curvas', 'Curvas'], ['whatif', 'E se?'], ['builds', 'Builds'], ['ficha', 'Ficha'], ['sobre', 'Sobre']];
const MOBILE = ['inicio', 'otimizar', 'curvas', 'whatif', 'builds'];

/* ---------- topo ---------- */
function topo(titulo, sub) {
  const t = T();
  const alvo = t.tipo === 'chefe' ? `Chefe · Tol ${fmt(t.tol)}` : t.tipo === 'mob' ? `Mob comum · Tol ${fmt(t.tol)}` : 'Boneco';
  return `<div class="top"><div class="title"><h1>${titulo}</h1>${sub ? `<p>${sub}</p>` : ''}</div>
    <div class="ctx"><button class="pillbtn cta" data-act="criar" data-m="print">＋ Criar minha build</button><button class="pillbtn" data-act="goto" data-p="builds" title="Trocar de build">${esc(cur().nome)}</button>
    <button class="pillbtn" data-act="ctx">${alvo}<small>· ${focoNome()}</small></button></div></div>`;
}

/* ---------- Inicio ---------- */
function pInicio() {
  const b = B(), t = T(), rows = linhas();
  const [pc, ph] = TL.chances(b, t);
  const ativos = rows.filter(r => Math.abs(r.up) >= 0.005).sort((a, c) => c.up - a.up);
  const soltar = ativos.filter(r => r.down < 0 && (r.s.chave === 'dano_base' || r.val > 0)).sort((a, c) => c.down - a.down);
  const rec = r => `<div class="rk" style="grid-template-columns:minmax(0,1fr) auto"><div class="nm">${esc(r.s.nome)}<small>${r.s.rotulo}</small></div><div class="num"><b>${sgn(r.up)}</b> ${chip(zona(r.up))}</div></div>`;
  const tira = r => `<div class="rk" style="grid-template-columns:minmax(0,1fr) auto"><div class="nm">${esc(r.s.nome)}<small>−${fmt(r.s.passo)}${r.s.chave === 'dano_base' ? '%' : ''}</small></div><div class="num"><b>${sgn(r.down)}</b></div></div>`;
  const alertas = [];
  if (b.recarga >= 100) alertas.push(`Recarga em ${fmt(b.recarga, 1)}%: o teto é 120%, restam ${fmt(Math.max(0, 120 - b.recarga), 1)} pontos.`);
  if (b.vel_ataque >= 100) alertas.push(`Velocidade de Ataque em ${fmt(b.vel_ataque, 1)}%: o teto é 150%, restam ${fmt(Math.max(0, 150 - b.vel_ataque), 1)} pontos.`);
  for (const r of rows) if (['crit', 'pesado', 'acerto', 'amp'].includes(r.s.chave) && r.up > 0 && r.up < 0.5) alertas.push(`${r.s.nome}: +${fmt(r.s.passo)} rende só ${fmt(r.up, 2)}% de ${focoNome().toLowerCase()}.`);
  const capBar = (v, cap) => `<div class="bar" style="margin-top:6px"><i class="f-${v >= cap ? 'crit' : v >= cap * .9 ? 'warn' : 'good'}" style="width:${Math.min(100, v / cap * 100).toFixed(0)}%"></i></div>`;
  const novo = cur().exemplo || cur().rascunho;
  const comece = novo ? `<div class="card start"><h2>Comece pela sua build</h2>
    <p class="sub">O que aparece abaixo ainda é a ficha de exemplo. Escolha como quer passar os seus números:</p>
    <div class="row"><button class="btn main big" data-act="criar" data-m="print">📷 Print da ficha</button><button class="btn big" data-act="criar" data-m="digitar">✎ Digitar os stats</button><button class="btn big" data-act="criar" data-m="json">{ } Colar JSON</button></div></div>` : '';
  return `<div class="banner"><img src="img/muu-chan.webp" alt="Muu-chan Builds"></div>
  ${comece}
  ${topo('Início', 'Onde sua build está e o que mexer primeiro.')}
  <div class="card hero"><h2>${esc(cur().nome)}</h2>
    <p class="sub">${cur().exemplo ? 'Exemplo com a ficha do mago full. Edite na aba Ficha ou crie a sua em Builds.' : 'Build salva neste aparelho.'}</p>
    <div class="grid g4 keep2">
      <div class="tile"><div class="k">Crítico no alvo</div><div class="v">${fmt(pc * 100, 1)}%</div><div class="d">rating ${fmt(b.crit + (t.tipo === 'chefe' ? b.crit_chefe : 0))}</div></div>
      <div class="tile"><div class="k">Pesado no alvo</div><div class="v">${fmt(ph * 100, 1)}%</div><div class="d">rating ${fmt(b.pesado + (t.tipo === 'chefe' ? b.pesado_chefe : 0))}</div></div>
      <div class="tile"><div class="k">Recarga</div><div class="v">${fmt(b.recarga, 0)}%</div><div class="d">teto 120%</div>${capBar(b.recarga, 120)}</div>
      <div class="tile"><div class="k">Vel. de Ataque</div><div class="v">${fmt(b.vel_ataque, 0)}%</div><div class="d">teto 150%</div>${capBar(b.vel_ataque, 150)}</div>
    </div></div>
  <div class="grid g2" style="margin-top:16px">
    <div class="card"><h2>Onde investir</h2><p class="sub">Maior ganho de ${focoNome().toLowerCase()} por um passo.</p>${ativos.slice(0, 4).map(rec).join('') || '<p class="muted">Nada muda esse foco.</p>'}
      <p class="note"><button class="btn sm" data-act="goto" data-p="otimizar">Ver ranking completo</button></p></div>
    <div class="card"><h2>O que menos dói tirar</h2><p class="sub">Menor perda se você precisar abrir mão de pontos.</p>${soltar.slice(0, 4).map(tira).join('') || '<p class="muted">Sem candidatos.</p>'}
      <p class="note"><button class="btn sm" data-act="goto" data-p="whatif">Testar uma troca</button></p></div>
  </div>
  ${alertas.length ? `<div class="card" style="margin-top:16px"><h2>Alertas</h2><div class="stack">${alertas.slice(0, 5).map(a => `<p style="margin:0">▲ ${a}</p>`).join('')}</div></div>` : ''}
  <p class="note">Aproximação por engenharia reversa (outubro de 2026). Serve para comparar caminhos, não garante o número exato do jogo.</p>`;
}

/* ---------- Otimizar ---------- */
function pOtimizar() {
  const rows = linhas();
  const ativos = rows.filter(r => Math.abs(r.up) >= 0.005).sort((a, c) => c.up - a.up);
  const max = Math.max(...ativos.map(r => r.up), 0.01), top = ativos[0];
  const solto = ativos.filter(r => r.down < 0 && (r.s.chave === 'dano_base' || r.val > 0)).sort((a, c) => c.down - a.down)[0];
  let lead = top ? `Para <strong>${focoNome().toLowerCase()}</strong>, o melhor retorno agora está em <strong>${esc(top.s.nome)}</strong> (${sgn(top.up)} por ${top.s.rotulo}).` : 'Nenhum stat desta ficha muda esse foco.';
  if (solto) lead += ` O que menos dói tirar é <strong>${esc(solto.s.nome)}</strong> (${sgn(solto.down)}).`;
  const linha = r => { const z = zona(r.up);
    return `<div class="rk"><div class="nm">${esc(r.s.nome)}<small>passo ${r.s.rotulo} · hoje ${fmt(r.val, r.val % 1 ? 1 : 0)}</small></div>
    <div class="bw"><div class="bar"><i class="f-${z.k}" style="width:${(Math.max(0, r.up) / max * 100).toFixed(1)}%"></i></div><b class="num">${sgn(r.up)}</b></div>
    <div class="ds num"><span class="mo">Ao descer: </span>${Math.abs(r.down) < 0.005 ? '—' : sgn(r.down)}</div><div class="zn">${chip(z)}</div></div>`; };
  const fora = rows.filter(r => Math.abs(r.up) < 0.005);
  return `${topo('Otimizar', 'Ganho de cada stat para o foco escolhido.')}
  <div class="card"><p class="lead">${lead}</p>
    <div class="rk rkh"><div>Stat e passo</div><div>Ganho ao subir um passo</div><div style="text-align:right">Ao descer</div><div>Zona</div></div>
    ${ativos.map(linha).join('')}
    <p class="note">Zona pelo ganho de um passo: ${chip({ k: 'good', rot: 'rende bem', ic: '✓' })} a partir de 1%, ${chip({ k: 'warn', rot: 'caro', ic: '▲' })} de 0,5% a 1%, ${chip({ k: 'crit', rot: 'quase não rende', ic: '●' })} abaixo de 0,5%. O passo é um aumento típico de equipamento; compare com o custo real de cada um.</p>
    ${fora.length ? `<details class="note"><summary>Não afetam este foco (${fora.length})</summary>${fora.map(r => esc(r.s.nome)).join(', ')}.</details>` : ''}</div>`;
}

/* ---------- Curvas ---------- */
const CW = 720, CH = 320, CM = { l: 56, r: 18, t: 18, b: 40 };
function pCurvas() {
  const st = stat(ui.curva);
  const b = B(), t = T(), o = O(), f = F();
  const ativo = s => Math.abs(TL.ganho(b, s.chave, s.passo, f, t, o)) >= 0.005 || Math.abs(TL.ganho(b, s.chave, -s.passo, f, t, o)) >= 0.005;
  const pills = TL.STATS.map(s => `<button class="pill${s.chave === ui.curva ? ' on' : ''}${ativo(s) ? '' : ' off'}" data-act="stat" data-k="${s.chave}"${ativo(s) ? '' : ` title="Não afeta o foco ${esc(focoNome())}"`}>${esc(s.nome.replace(/ \(%\)/, ''))}</button>`).join('');
  return `${topo('Curvas', 'Retorno decrescente de cada stat. A bolinha dourada é você.')}
  <div class="card"><div class="scrollx" role="tablist" aria-label="Stat">${pills}</div><div id="cv" style="margin-top:14px">${curvaHtml(st)}</div></div>`;
}
function curvaHtml(st) {
  const b = B(), t = T(), o = O(), f = F();
  const pts = TL.curva(b, st.chave, f, t, o, 100), cv = TL.valor(b, st.chave), ys = pts.map(p => p.y);
  if (Math.max(...ys) - Math.min(...ys) < 0.005) {
    const alt = TL.STATS.find(s => s.chave !== st.chave && Math.abs(TL.ganho(b, s.chave, s.passo, f, t, o)) >= 0.005);
    return `<div class="vazio"><b>${esc(st.nome)}</b> não muda o foco “${focoNome()}”, então não tem curva para mostrar.
      <div class="row" style="margin-top:10px">${alt ? `<button class="btn main" data-act="stat" data-k="${alt.chave}">Ver a curva de ${esc(alt.nome.replace(/ \(%\)/, ''))}</button>` : ''}<button class="btn" data-act="ctx">Trocar o foco</button></div></div>`;
  }
  const [lo, hi] = st.faixa; let y0 = Math.min(...ys, 100), y1 = Math.max(...ys, 100); const pad = (y1 - y0) * .06; y0 -= pad; y1 += pad;
  const X = x => CM.l + (x - lo) / (hi - lo) * (CW - CM.l - CM.r), Y = y => CH - CM.b - (y - y0) / (y1 - y0) * (CH - CM.t - CM.b);
  const nice = (a, c, n) => { const r = (c - a) / n, p = Math.pow(10, Math.floor(Math.log10(r))), q = r / p, s = (q < 1.5 ? 1 : q < 3.5 ? 2 : q < 7.5 ? 5 : 10) * p, out = []; for (let v = Math.ceil(a / s) * s; v <= c + 1e-9; v += s) out.push(v); return out; };
  let bands = '';
  for (let i = 0; i < pts.length - 1; i++) bands += `<rect x="${X(pts[i].x).toFixed(1)}" y="${CM.t}" width="${(X(pts[i + 1].x) - X(pts[i].x)).toFixed(2)}" height="${CH - CM.t - CM.b}" shape-rendering="crispEdges" class="band z-${zona(pts[i].marg).k}"/>`;
  const path = pts.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join('');
  const parada = pts.find(p => p.x > lo && zona(p.marg).k === 'crit');
  const cy = 100;
  const g = TL.ganho(b, st.chave, st.passo, f, t, o), z = zona(g);
  let txt = `Você está em <strong>${fmt(cv, cv % 1 ? 1 : 0)}</strong>: ${st.rotulo} rende ${sgn(g)} ${chip(z)}`;
  if (parada) txt += cv >= parada.x ? `<br>Você já passou do ponto de parada (≈ ${fmt(parada.x)}).` : `<br>O retorno cai abaixo de 0,5% por passo perto de ${fmt(parada.x)}.`;
  if (st.chave === 'recarga') txt += '<br>Recarga tem teto de 120%.'; if (st.chave === 'vel_ataque') txt += '<br>Velocidade de Ataque tem teto de 150%.';
  const tab = pts.filter((_, i) => i % 10 === 0);
  const svg = `<div class="chart"><svg viewBox="0 0 ${CW} ${CH}" role="img" aria-label="Curva de retorno de ${esc(st.nome)}">${bands}
    ${nice(y0, y1, 5).map(v => `<line x1="${CM.l}" x2="${CW - CM.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="gl"/><text x="${CM.l - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" class="tk">${fmt(v, v % 1 ? 1 : 0)}%</text>`).join('')}
    ${nice(lo, hi, 6).map(v => `<text x="${X(v).toFixed(1)}" y="${CH - CM.b + 18}" text-anchor="middle" class="tk">${fmt(v)}</text>`).join('')}
    <line x1="${CM.l}" x2="${CW - CM.r}" y1="${CH - CM.b}" y2="${CH - CM.b}" class="ax"/><line x1="${CM.l}" x2="${CW - CM.r}" y1="${Y(100).toFixed(1)}" y2="${Y(100).toFixed(1)}" class="rf"/>
    <path d="${path}" class="ln"/>
    ${parada ? `<line x1="${X(parada.x).toFixed(1)}" x2="${X(parada.x).toFixed(1)}" y1="${CM.t}" y2="${CH - CM.b}" class="stp"/><text x="${X(parada.x).toFixed(1)}" y="${CM.t + 12}" text-anchor="${X(parada.x) > CW - 150 ? 'end' : 'start'}" dx="${X(parada.x) > CW - 150 ? -6 : 6}" class="lb">ponto de parada ≈ ${fmt(parada.x)}</text>` : ''}
    <circle cx="${X(st.chave === 'dano_base' ? 0 : cv).toFixed(1)}" cy="${Y(cy).toFixed(1)}" r="6" class="you"/>
    <text x="${X(st.chave === 'dano_base' ? 0 : cv).toFixed(1)}" y="${(Y(cy) + 22).toFixed(1)}" text-anchor="middle" class="lb">você</text>
    <line id="xh" y1="${CM.t}" y2="${CH - CM.b}" class="xh" hidden/><rect id="hit" x="${CM.l}" y="${CM.t}" width="${CW - CM.l - CM.r}" height="${CH - CM.t - CM.b}" fill="transparent"/></svg><div id="tip" class="tip" hidden></div></div>`;
  setTimeout(() => bindChart(pts, st, lo, hi, X), 0);
  return `<p class="lead" style="font-size:16px">${txt}</p>${svg}
    <details class="note"><summary>Ver valores</summary><div class="scroll"><table class="tbl"><thead><tr><th>${esc(st.nome)}</th><th>Índice (você = 100%)</th><th>${st.rotulo}</th></tr></thead><tbody>${tab.map(p => `<tr><td class="num">${fmt(p.x, p.x % 1 ? 1 : 0)}</td><td class="num">${fmt(p.y, 1)}%</td><td class="num">${sgn(p.marg)}</td></tr>`).join('')}</tbody></table></div></details>`;
}
function bindChart(pts, st, lo, hi, X) {
  const box = $('.chart'); if (!box) return;
  const svg = $('svg', box), tip = $('#tip', box), xh = $('#xh', box), hit = $('#hit', box); if (!hit) return;
  hit.addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * CW, x = lo + (px - CM.l) / (CW - CM.l - CM.r) * (hi - lo);
    const p = pts.reduce((a, c) => Math.abs(c.x - x) < Math.abs(a.x - x) ? c : a);
    xh.removeAttribute('hidden'); xh.setAttribute('x1', X(p.x)); xh.setAttribute('x2', X(p.x));
    tip.hidden = false; tip.innerHTML = `<b>${fmt(p.x, p.x % 1 ? 1 : 0)}</b> ${esc(st.nome)}<br>Índice ${fmt(p.y, 1)}% da build atual<br>${st.rotulo}: ${sgn(p.marg)} ${chip(zona(p.marg))}`;
    tip.style.left = Math.min(Math.max(X(p.x) / CW * r.width + 12, 4), r.width - 196) + 'px';
  });
  hit.addEventListener('pointerleave', () => { tip.hidden = true; xh.setAttribute('hidden', ''); });
}

/* ---------- E se? ---------- */
const PRESETS = [['+10 Dano Crítico, −300 pesado', [['dc', 10], ['pesado', -300]]], ['+100 Ampliação, −10 Recarga', [['amp', 100], ['recarga', -10]]], ['+500 Vida, −100 Resistência', [['vida', 500], ['resist', -100]]], ['+20 Dano Crítico, −500 crítico', [['dc', 20], ['crit', -500]]]];
function wfBuild() { let b = B(); for (const w of D.data.whatif) b = TL.aplicar(b, w.chave, Number(w.delta) || 0); return b; }
function pWhatif() {
  const opts = c => TL.STATS.map(s => `<option value="${s.chave}"${s.chave === c ? ' selected' : ''}>${esc(s.nome)}</option>`).join('');
  return `${topo('E se?', 'Consigo subir X mas perco Y: vale a pena?')}
  <div class="card"><div id="wfr">${D.data.whatif.map((w, i) => `<div class="wf"><select data-wf="${i}" data-f="chave" aria-label="Stat ${i + 1}">${opts(w.chave)}</select><input type="number" step="any" value="${w.delta}" data-wf="${i}" data-f="delta" aria-label="Mudança ${i + 1}"><button class="btn sm danger" data-act="wfrm" data-i="${i}" aria-label="Remover">×</button></div>`).join('')}</div>
    <div class="row"><button class="btn sm" data-act="wfadd">+ Mudança</button><span class="muted" style="font-size:13px">Use negativo para perda.</span></div>
    <div class="pills" style="margin-top:12px">${PRESETS.map((p, i) => `<button class="pill" data-act="preset" data-i="${i}">${p[0]}</button>`).join('')}</div>
    <div id="wfo">${wfOut()}</div></div>`;
}
function wfOut() {
  const nb = wfBuild(), ind = TL.indices(nb, B(), T(), O()), gf = TL.foco(ind, F()) - 100;
  const L = [['Dano', ind.dano], ['Cura direta', ind.cura], ['Cura contínua', ind.hot], ['Sobrevivência', ind.sobrev]];
  let v, k;
  if (!D.data.whatif.length) { v = 'Adicione uma mudança para comparar.'; k = 'zero'; }
  else if (gf >= 1) { v = `Vale a pena para ${focoNome().toLowerCase()}: ${sgn(gf)}`; k = 'good'; }
  else if (gf <= -1) { v = `Não vale para ${focoNome().toLowerCase()}: ${sgn(gf)}`; k = 'crit'; }
  else { v = `Praticamente neutro para ${focoNome().toLowerCase()} (${sgn(gf)}). Decida pelo custo.`; k = 'warn'; }
  const pior = L.filter(l => l[1] - 100 <= -1).map(l => l[0].toLowerCase());
  return `<div class="verdict vd-${k}"><span aria-hidden="true">${{ good: '✓', warn: '▲', crit: '✕', zero: '–' }[k]}</span>${v}</div>
    <table class="tbl"><thead><tr><th>Índice</th><th>Antes</th><th>Depois</th><th>Variação</th></tr></thead><tbody>${L.map(l => `<tr><td>${l[0]}</td><td class="num">100%</td><td class="num">${fmt(l[1], 1)}%</td><td class="num ${Math.abs(l[1] - 100) < .05 ? '' : l[1] > 100 ? 'up' : 'dn'}">${Math.abs(l[1] - 100) < .05 ? '—' : sgn(l[1] - 100)}</td></tr>`).join('')}</tbody></table>
    ${pior.length && k !== 'crit' ? `<p class="note">Atenção: piora ${pior.join(' e ')} em 1% ou mais.</p>` : ''}`;
}

/* ---------- Builds ---------- */
function pBuilds() {
  const d = D.data, b0 = d.builds;
  if (!ui.cmpA || !b0.find(x => x.id === ui.cmpA)) ui.cmpA = b0[0].id;
  if (!ui.cmpB || !b0.find(x => x.id === ui.cmpB)) ui.cmpB = (b0[1] || b0[0]).id;
  const card = x => { const b = norm(x.b), [pc, ph] = TL.chances(b, T());
    return `<div class="bcard${x.id === d.active ? ' on' : ''}">${x.exemplo ? '<span class="tag">Exemplo</span>' : ''}${x.id === d.active ? '<span class="tag">Ativa</span>' : ''}
    <input type="text" value="${esc(x.nome)}" data-nome="${x.id}" aria-label="Nome da build">
    <div class="muted num" style="font-size:13px">Dano ${fmt(b.dano_min)}–${fmt(b.dano_max)} · Crít ${fmt(pc * 100)}% · Pesado ${fmt(ph * 100)}% · Amp ${fmt(b.amp)}</div>
    <div class="row"><button class="btn sm main" data-act="usar" data-id="${x.id}">Usar</button><button class="btn sm" data-act="editar" data-id="${x.id}">Editar ficha</button><button class="btn sm" data-act="dup" data-id="${x.id}">Duplicar</button><button class="btn sm" data-act="exportar" data-id="${x.id}" title="Copia o JSON da build para colar em outro lugar">Exportar JSON</button><button class="btn sm" data-act="baixar" data-id="${x.id}" title="Baixa o arquivo .json">⬇ .json</button>${b0.length > 1 ? `<button class="btn sm danger" data-act="del" data-id="${x.id}">Excluir</button>` : ''}</div></div>`; };
  return `${topo('Builds', 'Salve várias fichas e compare.')}
  <div class="grid g2">${b0.map(card).join('')}</div>
  <div class="row" style="margin-top:12px"><button class="btn main" data-act="criar" data-m="print">＋ Criar minha build</button><button class="btn" data-act="nova">Cópia da build ativa</button></div>
  <div class="card" style="margin-top:16px"><h2>Comparar duas builds</h2><p class="sub">Índices da segunda em relação à primeira, no alvo e premissas atuais.</p>
    <div class="grid g2"><label class="field"><span>Base</span><select data-cmp="A">${b0.map(x => `<option value="${x.id}"${x.id === ui.cmpA ? ' selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label>
    <label class="field"><span>Comparar com</span><select data-cmp="B">${b0.map(x => `<option value="${x.id}"${x.id === ui.cmpB ? ' selected' : ''}>${esc(x.nome)}</option>`).join('')}</select></label></div>
    <div id="cmp" style="margin-top:12px">${cmpHtml()}</div></div>`;
}
function cmpHtml() {
  const a = norm(D.data.builds.find(x => x.id === ui.cmpA).b), b = norm(D.data.builds.find(x => x.id === ui.cmpB).b);
  if (ui.cmpA === ui.cmpB) return '<p class="muted">Escolha duas builds diferentes.</p>';
  const ind = TL.indices(b, a, T(), O());
  return [['Dano', ind.dano], ['Cura direta', ind.cura], ['Cura contínua', ind.hot], ['Sobrevivência', ind.sobrev]].map(([n, v]) => {
    const g = v - 100, w = Math.min(100, Math.abs(g) * 2);
    return `<div class="rk" style="grid-template-columns:120px minmax(0,1fr) 90px"><div class="nm">${n}</div><div class="bar"><i class="f-${Math.abs(g) < .05 ? 'zero' : g > 0 ? 'good' : 'crit'}" style="width:${w.toFixed(0)}%"></i></div><div class="num ${g > 0.05 ? 'up' : g < -0.05 ? 'dn' : ''}" style="text-align:right"><b>${Math.abs(g) < .05 ? '—' : sgn(g, 1)}</b></div></div>`;
  }).join('');
}

/* ---------- Ficha ---------- */
const CAMPOS = [['Ofensivo', [['dano_min', 'Dano Base mínimo'], ['dano_max', 'Dano Base máximo'], ['crit', 'Chance de acerto crítico (rating)'], ['crit_chefe', 'Crítico contra Chefes (aba Chefes)'], ['pesado', 'Chance de ataque pesado (rating)'], ['pesado_chefe', 'Pesado contra Chefes (aba Chefes)'], ['acerto', 'Chance de acerto (rating)'], ['dc', 'Dano Crítico (%)'], ['dap', 'Dano de Ataque Pesado (%)'], ['dap_extra', 'DAP extra de set (buff condicional, %)'], ['amp', 'Ampliação de Dano de Habilidade'], ['amp_magico', 'Ampliação de Dano Mágico (%)'], ['bonus', 'Bônus de Dano'], ['recarga', 'Velocidade de Recarga (%)'], ['vel_ataque', 'Velocidade de Ataque (%)']]],
  ['Cura', [['cura', 'Cura (%)'], ['cura_cont', 'Cura Contínua de Habilidade (%)'], ['cura_rec', 'Cura Recebida (%)'], ['esc_div', 'Eficácia de cura da maestria (%)']]],
  ['Defesa', [['def_corpo', 'Defesa corpo a corpo'], ['def_mag', 'Defesa mágica'], ['resist', 'Resistência a Dano de Habilidade'], ['reducao', 'Redução de Dano (%)'], ['vida', 'Vida máxima']]]];
/* Exportar: o mesmo JSON serve para colar em "Colar JSON" (nova build) ou em Ficha > Aplicar JSON */
const jsonDe = x => JSON.stringify({ app: 'Muu-chan Builds TL', nome: x.nome, build: norm(x.b) }, null, 1);
function baixar(x) {
  try {
    const a = document.createElement('a'), u = URL.createObjectURL(new Blob([jsonDe(x)], { type: 'application/json' }));
    a.href = u; a.download = (x.nome.replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '') || 'build') + '.json'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000);
    toast('Arquivo .json baixado');
  } catch (e) { toast('Não consegui baixar o arquivo'); }
}
const camposHtml = b => CAMPOS.map(([g, cs]) => `<fieldset><legend>${g}</legend><div class="frm">${cs.map(([k, n]) => `<label class="field"><span>${n}</span><input type="number" step="any" value="${b[k]}" data-k="${k}"></label>`).join('')}</div></fieldset>`).join('');
const printHtml = () => `<p class="sub">Mande prints da ficha (Efeitos Básicos, Ataque e Proteção, aba Chefes). O app lê os números e você confere antes de aplicar. Na primeira vez ele baixa o leitor, então precisa de internet.</p>
  <label class="drop" id="drop" for="ocrfile"><input type="file" id="ocrfile" accept="image/*" multiple hidden><b>Escolher prints</b> ou arrastar aqui<small>Também dá para colar com Ctrl+V</small></label><div id="ocrout">${ocrHtml()}</div>`;

/* Nova build: 3 metodos para preencher e um botao para confirmar */
const METODOS = [['print', '📷', 'Print da ficha', 'O app lê os números da imagem.'], ['digitar', '✎', 'Digitar os stats', 'Preencha campo por campo.'], ['json', '{ }', 'Colar JSON', 'Se alguém já te mandou a ficha pronta.']];
function cbTexto(c) {
  const t = c.tocados || [], falta = ESSENCIAIS.filter(k => !t.includes(k));
  return `<b>${t.length ? `${t.length} ${t.length === 1 ? 'campo preenchido' : 'campos preenchidos'}` : 'Nenhum campo preenchido ainda'}</b><small>${t.length && falta.length ? 'Faltam essenciais: ' + falta.map(k => NOMES[k] || k).slice(0, 3).join(', ') + (falta.length > 3 ? '…' : '') : t.length ? 'Pode confirmar ou ajustar mais.' : 'O que não for preenchido fica com o valor do exemplo.'}</small>`;
}
const marcar = (c, ks) => { c.tocados = [...new Set([...(c.tocados || []), ...ks])]; };
function pNova() {
  const c = cur(), b = B(), m = ui.metodo;
  const painel = m === 'print' ? printHtml()
    : m === 'digitar' ? `<p class="sub">Use os números da tela de status do jogo. Os campos que você não mexer ficam com o valor do exemplo.</p>${camposHtml(b)}`
    : `<p class="sub">Cole o JSON da ficha (o Claude devolve nesse formato ao ler o print, ou use "Copiar ficha atual" em outra build).</p>
      <textarea id="json" rows="7" spellcheck="false" placeholder='{"build": {"crit": 2726, "pesado": 1617.8, "dc": 22.1}}'></textarea>
      <div class="row" style="margin-top:10px"><button class="btn main" data-act="jsonapply">Carregar JSON</button><label class="btn" for="jsonfile">Escolher arquivo .json<input type="file" id="jsonfile" accept=".json,application/json" hidden></label></div>`;
  return `${topo('Nova build', 'Escolha UM jeito de preencher, confira e confirme no final.')}
  <div class="card"><label class="field"><span>1. Nome da build</span><input type="text" id="nome" value="${esc(c.nome)}"></label></div>
  <div class="card" style="margin-top:16px"><h2>2. Como você quer preencher?</h2>
    <div class="metodos" role="tablist">${METODOS.map(([k, ic, t, s]) => `<button role="tab" class="metodo" aria-selected="${m === k}" data-act="metodo" data-k="${k}"><span class="mi" aria-hidden="true">${ic}</span><b>${t}</b><small>${s}</small></button>`).join('')}</div>
    <div class="painel" style="margin-top:16px">${painel}</div></div>
  <div class="confirmbar"><div class="cb-t">${cbTexto(c)}</div>
    <div class="row"><button class="btn" data-act="cancelar">Cancelar</button><button class="btn main big" data-act="confirmar">✓ Criar build</button></div></div>`;
}
function pFicha() {
  if (cur().rascunho) return pNova();
  const b = B();
  const nome = `<div class="card"><label class="field"><span>Nome da build</span><input type="text" id="nome" value="${esc(cur().nome)}"></label></div>`;
  const campos = `<div class="card" style="margin-top:16px">${camposHtml(b)}</div>`;
  const print = `<div class="card" style="margin-top:16px"><h2>Ler de um print</h2>${printHtml()}</div>`;
  return `${topo('Ficha', 'Os números da sua ficha de status. Salvam sozinhos.')}
  ${nome}${campos}${print}
  <div class="card" style="margin-top:16px"><h2>Importar e exportar</h2><p class="sub">Cole o JSON que o Claude devolve ao ler o print da sua ficha, ou copie o seu para guardar.</p>
    <textarea id="json" rows="6" spellcheck="false" placeholder='{"build": {"crit": 2726, "pesado": 1617.8, "dc": 22.1}}'></textarea>
    <div class="row" style="margin-top:10px"><button class="btn main" data-act="jsonapply">Aplicar JSON</button><button class="btn" data-act="jsoncopy">Copiar ficha atual</button><button class="btn" data-act="exemplo">Voltar ao exemplo</button></div>
</div>`;
}

/* ---------- Sobre ---------- */
function pSobre() {
  return `${topo('Sobre', 'O que o motor assume e o quanto confio em cada parte.')}
  <div class="card"><div class="scroll"><table class="tbl"><thead><tr><th>Parte</th><th>Fórmula usada</th><th>Confiança</th></tr></thead><tbody>
  <tr><td>Chance de crítico, pesado e acerto</td><td>d ÷ (d + 1.000), d = rating (+ aba Chefes) menos Tolerância ou Esquiva. Acerto é aproximação grosseira.</td><td class="z-good"><b>Alta</b> (acerto: baixa)</td></tr>
  <tr><td>Crítico</td><td>Fixa o dano no máximo da faixa de Dano Base e multiplica por (1 + Dano Crítico).</td><td class="z-good"><b>Alta</b></td></tr>
  <tr><td>Pesado</td><td>Multiplica por (1 + Dano de Ataque Pesado); independente do crítico.</td><td class="z-good"><b>Alta</b></td></tr>
  <tr><td>Ampliação no dano</td><td>1 + A ÷ (A + 1.000), medida até 1.136,5. Não vale no ataque básico.</td><td class="z-good"><b>Alta</b></td></tr>
  <tr><td>Ampliação na cura</td><td>1 + 1,014 · A ÷ (A + 3.060).</td><td class="z-good"><b>Alta</b></td></tr>
  <tr><td>Cura</td><td>(1 + Cura) · (1 + Cura Recebida) · maestria; pesado dobra, Dano Crítico não age. Chance de crítico/pesado da cura usa o alvo da cura (hipótese).</td><td class="z-warn"><b>Média</b></td></tr>
  <tr><td>Cura contínua (ticks)</td><td>(1 + Cura Contínua) · Amplificação (curva de cura) · (1 + Cura Recebida). A Cura não soma.</td><td class="z-warn"><b>Média</b></td></tr>
  <tr><td>Recarga e Velocidade de Ataque</td><td>Skills ganham (1 + V ÷ 100) com teto 120%; ataque básico (1 + VA ÷ 100) com teto 150%.</td><td class="z-good"><b>Alta</b> (parte de recarga: média)</td></tr>
  <tr><td>Defesa</td><td>K ÷ (K + Defesa): 2.500 físico, 860 mágico; Resistência de habilidade K 900; Redução é percentual direto.</td><td class="z-warn"><b>Média</b></td></tr>
  <tr><td>Tolerância do chefe</td><td>130 a 1.500 entre os chefes medidos (masmorra, raid e archboss); padrão 300. Esquiva de pesado perto de 0.</td><td class="z-warn"><b>Média</b></td></tr>
  <tr><td>PvP</td><td>Não medido. Este app só descreve PvE.</td><td class="z-crit"><b>Sem dado</b></td></tr></tbody></table></div>
  <p class="note">O dano é calculado para uma skill de referência (475% do Dano Base + 232, como o Raio em Cadeia) e para o ataque básico, misturados pela parte de skills que você definir. Uma rotação real tem skills diferentes: trate o resultado como direção, não como DPS exato.</p></div>
  <div class="card" style="margin-top:16px"><h2>Aparência e instalação</h2><div class="row"><div class="seg" role="group" aria-label="Tema">${[['auto', 'Automático'], ['dark', 'Escuro'], ['light', 'Claro']].map(([k, n]) => `<button aria-pressed="${D.data.tema === k}" data-act="tema" data-k="${k}">${n}</button>`).join('')}</div></div>
  <p class="note">No Chrome ou Edge: menu do navegador, “Instalar app”. No celular: “Adicionar à tela inicial”. Funciona sem internet depois da primeira abertura (precisa ser aberto por um endereço http, não pelo arquivo direto). Suas builds ficam só neste aparelho.</p></div>`;
}

/* ---------- sheet de contexto (alvo, foco, premissas) ---------- */
function ctxSheet() {
  const t = T(), o = O();
  $('#sheet').innerHTML = `<div class="sheet-h"><h2>Alvo e foco</h2><button class="btn sm" data-act="close">Fechar</button></div><div class="sheet-b">
    <div class="field"><span>Foco da otimização</span><div class="seg" role="group">${Object.entries(TL.FOCOS).map(([k, f]) => `<button aria-pressed="${F() === k}" data-act="foco" data-k="${k}">${f.nome}</button>`).join('')}</div></div>
    <div class="field"><span>Alvo</span><div class="seg" role="group">${[['chefe', 'Chefe'], ['mob', 'Mob comum'], ['boneco', 'Boneco']].map(([k, n]) => `<button aria-pressed="${t.tipo === k}" data-act="tipo" data-k="${k}">${n}</button>`).join('')}</div>
      <span class="muted" style="text-transform:none;letter-spacing:0;font-size:12.5px">Chefe usa os bônus da aba Chefes da ficha (inclui archboss).</span></div>
    <div class="field"><span>Tolerância de crítico do alvo: <b class="num" id="tv">${fmt(t.tol)}</b></span><input type="range" min="0" max="2000" step="10" value="${t.tol}" data-ctx="tol" ${t.tipo === 'boneco' ? 'disabled' : ''}>
      <div class="pills">${BOSSES.map(([n, v]) => `<button class="pill${t.tol === v ? ' on' : ''}" data-act="boss" data-v="${v}">${n} ${v}</button>`).join('')}</div></div>
    <label class="field"><span>Esquiva de pesado do alvo</span><input type="number" min="0" step="any" value="${t.esq}" data-ctx="esq"></label>
    <div class="field"><span>Parte do dano que vem de skills: <b class="num" id="ps">${fmt(o.parte_skill * 100)}%</b></span><input type="range" min="0" max="100" step="5" value="${o.parte_skill * 100}" data-ctx="ps"></div>
    <div class="field"><span>Parte das skills limitada por recarga: <b class="num" id="pr">${fmt(o.parte_recarga * 100)}%</b></span><input type="range" min="0" max="100" step="5" value="${o.parte_recarga * 100}" data-ctx="pr"></div></div>`;
}

/* ---------- leitura de print (OCR) ---------- */
const NOMES = {}; CAMPOS.forEach(([g, cs]) => cs.forEach(([k, n]) => NOMES[k] = n));
const FAIXAS = { crit: [0, 8000], pesado: [0, 8000], acerto: [0, 4000], dc: [0, 600], dap: [0, 600], amp: [0, 4000], bonus: [0, 2000], recarga: [0, 200], vel_ataque: [0, 250], cura: [0, 800], cura_cont: [0, 800], cura_rec: [0, 300], def_corpo: [0, 20000], def_mag: [0, 20000], resist: [0, 4000], reducao: [0, 100], vida: [1000, 500000], dano_min: [1, 20000], dano_max: [1, 30000], crit_chefe: [0, 3000], pesado_chefe: [0, 3000], amp_magico: [0, 100] };
const ESSENCIAIS = ['dano_min', 'dano_max', 'crit', 'pesado', 'dc', 'dap', 'amp'];
ui.ocr = { itens: [], linhas: [], busy: false, status: '', erro: '' };
function ocrHtml() {
  const o = ui.ocr;
  if (o.busy) return `<p class="note" id="ocrst" role="status">${esc(o.status || 'Preparando…')}</p>`;
  let h = o.erro ? `<p class="note z-crit">${esc(o.erro)}</p>` : '';
  if (!o.linhas.length) return h;
  if (!o.itens.length) return h + `<p class="note">Não reconheci nenhum campo. Tente um print mais nítido, só com a ficha.</p>`;
  const faltam = ESSENCIAIS.filter(k => !o.itens.find(i => i.k === k));
  h += `<p class="note">Confira os valores. Os que parecem fora do normal vêm com ▲.</p><table class="tbl"><thead><tr><th></th><th>Campo</th><th>Valor lido</th><th>Linha de origem</th></tr></thead><tbody>
    ${o.itens.map((i, n) => { const f = FAIXAS[i.k], ruim = f && (i.v < f[0] || i.v > f[1]);
      return `<tr><td><input type="checkbox" data-oc="${n}" ${i.on ? 'checked' : ''} aria-label="Aplicar ${esc(NOMES[i.k] || i.k)}"></td><td>${esc(NOMES[i.k] || i.k)}</td><td><input type="number" step="any" value="${i.v}" data-ov="${n}" style="width:8em"> ${ruim ? '<span class="z-warn" title="Fora do normal">▲</span>' : ''}</td><td class="muted" style="font-size:12px">${esc(i.fonte)}</td></tr>`; }).join('')}</tbody></table>
    ${faltam.length ? `<p class="note">Não achei: ${faltam.map(k => NOMES[k]).join(', ')}. Mande outro print com essas linhas, ou preencha à mão.</p>` : ''}
    <div class="row" style="margin-top:10px"><button class="btn main" data-act="ocapply">Aplicar ${o.itens.filter(i => i.on).length} campos</button><button class="btn" data-act="occlear">Descartar</button></div>
    <details class="note"><summary>O que o leitor viu</summary><pre style="white-space:pre-wrap;font-size:12px">${esc(o.linhas.join('\n'))}</pre></details>`;
  return h;
}
const ocrRender = () => { const el = $('#ocrout'); if (el) el.innerHTML = ocrHtml(); };
async function ocrArquivos(files) {
  if (cur().rascunho && ui.metodo !== 'print') { ui.metodo = 'print'; refresh(); }
  const o = ui.ocr; o.busy = true; o.erro = ''; o.status = 'Preparando o leitor…'; ocrRender();
  for (const f of files) {
    try {
      const linhas = await TLOCR.ler(f, m => { if (m.status) { o.status = (m.status === 'recognizing text' ? 'Lendo o texto' : 'Baixando o leitor') + (m.progress ? ` ${Math.round(m.progress * 100)}%` : ''); const el = $('#ocrst'); if (el) el.textContent = o.status; } });
      o.linhas.push(...linhas);
    } catch (e) { o.erro = e.message || 'Falha ao ler a imagem.'; }
  }
  o.itens = TLOCR.parse(o.linhas).itens.map(i => ({ ...i, on: true })); o.busy = false; ocrRender();
}
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'jsonfile' && t.files.length) { t.files[0].text().then(s => { $('#json').value = s; document.querySelector('[data-act=jsonapply]').click(); }); t.value = ''; }
  else if (t.id === 'ocrfile' && t.files.length) { ocrArquivos([...t.files]); t.value = ''; }
  else if (t.dataset.oc !== undefined) { ui.ocr.itens[t.dataset.oc].on = t.checked; ocrRender(); }
  else if (t.dataset.ov !== undefined) { ui.ocr.itens[t.dataset.ov].v = Number(t.value) || 0; }
});
document.addEventListener('dragover', e => { if (e.target.closest && e.target.closest('.drop')) e.preventDefault(); });
document.addEventListener('drop', e => { if (e.target.closest && e.target.closest('.drop')) { e.preventDefault(); const f = [...e.dataTransfer.files].filter(x => x.type.startsWith('image/')); if (f.length) ocrArquivos(f); } });
document.addEventListener('paste', e => {
  if (page() !== 'ficha') return;
  const f = [...(e.clipboardData ? e.clipboardData.files : [])].filter(x => x.type.startsWith('image/')); if (f.length) { e.preventDefault(); ocrArquivos(f); }
});
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  if (a.dataset.act === 'ocapply') {
    let n = 0; for (const i of ui.ocr.itens) if (i.on) { cur().b[i.k] = i.v; n++; }
    if (cur().rascunho) marcar(cur(), ui.ocr.itens.filter(i => i.on).map(i => i.k)); else cur().exemplo = false;
    D.save(); ui.ocr = { itens: [], linhas: [], busy: false, status: '', erro: '' }; toast(cur().rascunho ? `${n} campos carregados. Confira e confirme embaixo.` : `${n} campos aplicados`); refresh();
  } else if (a.dataset.act === 'occlear') { ui.ocr = { itens: [], linhas: [], busy: false, status: '', erro: '' }; ocrRender(); }
});

/* ---------- roteador ---------- */
const VIEWS = { inicio: pInicio, otimizar: pOtimizar, curvas: pCurvas, whatif: pWhatif, builds: pBuilds, ficha: pFicha, sobre: pSobre };
const page = () => { const h = location.hash.replace(/^#\/?/, ''); return VIEWS[h] ? h : 'inicio'; };
function render() {
  const p = page();
  $('#view').innerHTML = VIEWS[p]();
  $$('.nav a, .bnav a').forEach(a => a.getAttribute('href') === '#/' + p ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  document.title = (PAGES.find(x => x[0] === p)[1]) + ' · Muu-chan Builds TL';
  window.scrollTo(0, 0);
}
const refresh = () => { const y = window.scrollY; $('#view').innerHTML = VIEWS[page()](); window.scrollTo(0, y); };
function tema() {
  const t = D.data.tema; if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
}

/* ---------- eventos ---------- */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const act = a.dataset.act, d = D.data, id = a.dataset.id;
  switch (act) {
    case 'goto': location.hash = '#/' + a.dataset.p; break;
    case 'ctx': ctxSheet(); $('#sheet').showModal(); break;
    case 'close': $('#sheet').close(); refresh(); break;
    case 'foco': d.foco = a.dataset.k; D.save(); ctxSheet(); break;
    case 'tipo': d.alvo.tipo = a.dataset.k; if (a.dataset.k === 'boneco') { d.alvo.tol = 0; d.alvo.esq = 0; } D.save(); ctxSheet(); break;
    case 'boss': d.alvo.tol = Number(a.dataset.v); D.save(); ctxSheet(); break;
    case 'stat': ui.curva = a.dataset.k; render(); { const on = $('.scrollx .pill.on'); if (on && on.scrollIntoView) on.scrollIntoView({ inline: 'center', block: 'nearest' }); } break;
    case 'tema': d.tema = a.dataset.k; D.save(); tema(); refresh(); break;
    case 'usar': d.active = id; D.save(); toast('Build ativa trocada'); refresh(); break;
    case 'editar': d.active = id; D.save(); location.hash = '#/ficha'; break;
    case 'dup': { const x = d.builds.find(v => v.id === id); const n = { id: 'b' + Date.now(), nome: x.nome + ' (cópia)', b: { ...x.b } }; d.builds.push(n); d.active = n.id; D.save(); refresh(); break; }
    case 'criar': { const n = { id: 'b' + Date.now(), nome: 'Minha build', rascunho: true, anterior: d.active, tocados: [], b: { ...TL.BUILD } }; d.builds.push(n); d.active = n.id; ui.metodo = a.dataset.m || 'print'; ui.ocr = { itens: [], linhas: [], busy: false, status: '', erro: '' }; D.save(); if (location.hash === '#/ficha') render(); else location.hash = '#/ficha'; break; }
    case 'metodo': ui.metodo = a.dataset.k; refresh(); break;
    case 'cancelar': { const c = cur(); d.builds = d.builds.filter(v => v.id !== c.id); d.active = d.builds.find(v => v.id === c.anterior) ? c.anterior : d.builds[0].id; D.save(); toast('Criação cancelada'); location.hash = '#/inicio'; break; }
    case 'confirmar': { const c = cur(); c.rascunho = false; c.exemplo = false; delete c.anterior; if (!c.tocados || !c.tocados.length) toast('Build criada com os valores do exemplo'); else toast('Build criada'); delete c.tocados; D.save(); location.hash = '#/otimizar'; break; }
    case 'nova': { const n = { id: 'b' + Date.now(), nome: 'Nova build', b: { ...B() } }; d.builds.push(n); d.active = n.id; D.save(); location.hash = '#/ficha'; break; }
    case 'del': if (d.builds.length > 1) { d.builds = d.builds.filter(v => v.id !== id); if (d.active === id) d.active = d.builds[0].id; D.save(); refresh(); } break;
    case 'wfadd': if (d.whatif.length < 6) { d.whatif.push({ chave: 'amp', delta: 100 }); D.save(); refresh(); } break;
    case 'wfrm': d.whatif.splice(Number(a.dataset.i), 1); D.save(); refresh(); break;
    case 'preset': d.whatif = PRESETS[Number(a.dataset.i)][1].map(([chave, delta]) => ({ chave, delta })); D.save(); refresh(); break;
    case 'exemplo': cur().b = { ...TL.BUILD }; cur().exemplo = true; D.save(); toast('Exemplo carregado'); refresh(); break;
    case 'jsoncopy': { const txt = jsonDe(cur()); $('#json').value = txt; (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('Ficha copiada'), () => { $('#json').select(); toast('Selecionei o texto: copie com Ctrl+C'); }); break; }
    case 'exportar': { const x = d.builds.find(v => v.id === id), txt = jsonDe(x); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => toast('JSON copiado. É só colar para quem for receber.'), () => baixar(x)); break; }
    case 'baixar': baixar(d.builds.find(v => v.id === id)); break;
    case 'jsonapply': try { const j = JSON.parse($('#json').value), b = j.build || j; let n = 0; const ks = []; for (const k in TL.BUILD) if (typeof b[k] === 'number') { cur().b[k] = b[k]; n++; ks.push(k); } if (cur().rascunho) { marcar(cur(), ks); if (typeof j.nome === 'string' && j.nome.trim() && cur().nome === 'Minha build') cur().nome = j.nome.trim().slice(0, 60); } else cur().exemplo = false; D.save(); toast(n ? `${n} campos carregados` : 'Nenhum campo reconhecido'); refresh(); } catch (err) { toast('JSON inválido'); } break;
  }
});
document.addEventListener('input', e => {
  const t = e.target, d = D.data;
  if (t.dataset.k && !t.dataset.act) { cur().b[t.dataset.k] = Number(t.value) || 0; if (cur().rascunho) { marcar(cur(), [t.dataset.k]); const el = $('.cb-t'); if (el) el.innerHTML = cbTexto(cur()); } else cur().exemplo = false; D.save(); }
  else if (t.id === 'nome') { cur().nome = t.value; D.save(); }
  else if (t.dataset.nome) { d.builds.find(x => x.id === t.dataset.nome).nome = t.value; D.save(); }
  else if (t.dataset.wf !== undefined) { d.whatif[t.dataset.wf][t.dataset.f] = t.value; D.save(); $('#wfo').innerHTML = wfOut(); }
  else if (t.dataset.cmp) { ui['cmp' + t.dataset.cmp] = t.value; $('#cmp').innerHTML = cmpHtml(); }
  else if (t.dataset.ctx) {
    const v = Number(t.value) || 0;
    if (t.dataset.ctx === 'tol') { d.alvo.tol = v; $('#tv').textContent = fmt(v); }
    if (t.dataset.ctx === 'esq') d.alvo.esq = Math.max(0, v);
    if (t.dataset.ctx === 'ps') { d.opc.parte_skill = v / 100; $('#ps').textContent = fmt(v) + '%'; }
    if (t.dataset.ctx === 'pr') { d.opc.parte_recarga = v / 100; $('#pr').textContent = fmt(v) + '%'; }
    D.save();
  }
});
document.addEventListener('change', e => { if (e.target.dataset.wf !== undefined && e.target.dataset.f === 'chave') $('#wfo').innerHTML = wfOut(); });
$('#sheet').addEventListener('close', refresh);
window.addEventListener('hashchange', render);

/* ---------- inicio ---------- */
$('#nav').innerHTML = PAGES.map(([k, n]) => `<a href="#/${k}">${icon(k)}<span>${n}</span></a>`).join('');
$('#bnav').innerHTML = MOBILE.map(k => `<a href="#/${k}">${icon(k)}<span>${PAGES.find(x => x[0] === k)[1]}</span></a>`).join('');
tema(); render();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
