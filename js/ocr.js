/* Leitura da ficha por print (OCR no aparelho, Tesseract.js carregado so quando preciso). */
window.TLOCR = (() => {
  const SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  let carregando = null, worker = null;

  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[|_]/g, ' ').replace(/[~≈]/g, ' ~ ').replace(/\s+/g, ' ');

  // "1.617,8" -> 1617.8 ; "2.726" -> 2726 ; "22,1" -> 22.1 ; tolera virgula e ponto trocados pelo OCR
  function numero(txt) {
    let s = txt.replace(/\s/g, '').replace('−', '-');
    const neg = s.startsWith('-'); s = s.replace(/^[+-]/, '');
    const pts = (s.match(/\./g) || []).length, vir = (s.match(/,/g) || []).length;
    let v;
    if (pts && vir) { const dec = s.lastIndexOf(',') > s.lastIndexOf('.') ? ',' : '.'; const mil = dec === ',' ? '.' : ','; v = parseFloat(s.split(mil).join('').replace(dec, '.')); }
    else if (vir) { const dep = s.length - s.lastIndexOf(',') - 1; v = dep <= 2 ? parseFloat(s.replace(',', '.')) : parseFloat(s.replace(/,/g, '')); }
    else if (pts) { const dep = s.length - s.lastIndexOf('.') - 1; v = (dep === 3 && (pts === 1 || /^\d{1,3}(\.\d{3})+$/.test(s))) ? parseFloat(s.replace(/\./g, '')) : parseFloat(s.replace(/\.(?=.*\.)/g, '')); }
    else v = parseFloat(s);
    return isNaN(v) ? null : (neg ? -v : v);
  }
  const NUM = String.raw`[+\-−]?\s?\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|[+\-−]?\s?\d+(?:[.,]\d+)?`;

  // Regras em ordem: as primeiras "consomem" o trecho para as seguintes nao o confundirem. chave null = so descarta.
  const REGRAS = [
    [null, 'esquiva de ataque pesado magic[a-z]*(?: contra chefes?)?'],
    [null, 'resistencia a dano de ataque pesado'], [null, 'resistencia a dano critico'], [null, 'duracao da (?:vantagem|desvantagem)'],
    [null, 'tolerancia [a-z ]*?magic[a-z]*(?: contra chefes?)?'],
    ['crit_chefe', 'acerto critico magic[a-z]* contra chefes?'],
    ['pesado_chefe', 'pesado magic[a-z]* contra chefes?'],
    ['crit', 'acerto critico magic[a-z]*'],
    ['pesado', 'ataque pesado magic[a-z]*'],
    ['acerto', 'acerto magic[a-z]*'],
    ['amp_magico', 'ampliacao de dano magic[a-z]*'],
    ['amp', 'ampliacao de dano de habilidade'],
    ['cura_cont', 'cura continua de habilidade(?! direc)'],
    [null, 'cura continua de habilidade direc[a-z]*'],
    ['cura_rec', 'cura recebida'],
    ['resist', 'resistencia a dano de habilidade'],
    ['dap', 'dano de ataque pesado'],
    ['dc', 'dano critico'],
    ['bonus', 'bonus de dano(?! contra)'],
    ['recarga', 'velocidade de recarga'],
    ['vel_ataque', 'velocidade de ataque'],
    ['reducao', 'reducao de dano(?! de| contra)'],
    ['def_corpo', 'defesa corpo a corpo'],
    ['def_mag', 'defesa magica'],
    ['vida', 'vida maxima'],
    ['dano_base', 'dano base'],
    ['cura', '(?:^| )cura(?! continua| recebida| de | do )'],
  ];

  // Le o texto de uma linha e devolve [{k, v, fonte}]
  function linha(txt) {
    let t = norm(txt), out = [];
    for (const [k, pat] of REGRAS) {
      const re = new RegExp('(' + pat + ')(?:\\D{0,10}?(' + NUM + ')(?:\\s*[~≈\\-—–−]+\\s*(' + NUM + '))?)?', 'g');
      t = t.replace(re, (m, _l, a, b, off, str) => {
        if (!k) return ' '.repeat(m.length);
        if (k === 'dano_base') { if (a && b) { out.push({ k: 'dano_min', v: numero(a), fonte: txt.trim() }, { k: 'dano_max', v: numero(b), fonte: txt.trim() }); } return ' '.repeat(m.length); }
        if (a != null && !(k === 'vel_ataque' && /^\s*s\b/.test(str.slice(off + m.length)))) { const v = numero(a); if (v != null) out.push({ k, v, fonte: txt.trim() }); }
        return ' '.repeat(m.length);
      });
    }
    return out;
  }
  function parse(linhas) {
    const por = {}, todos = [];
    for (const l of linhas) for (const it of linha(l)) { todos.push(it); if (!(it.k in por)) por[it.k] = it; }
    return { itens: Object.values(por), todos };
  }

  function carregar() {
    if (window.Tesseract) return Promise.resolve();
    return carregando || (carregando = new Promise((ok, erro) => {
      const s = document.createElement('script'); s.src = SRC; s.onload = ok; s.onerror = () => { carregando = null; erro(new Error('Não consegui baixar o leitor de texto. Confira a internet.')); }; document.head.append(s);
    }));
  }
  // Prepara a imagem: amplia e inverte (texto claro em fundo escuro vira escuro em fundo claro)
  async function preparar(file) {
    const bmp = await createImageBitmap(file);
    const k = bmp.width < 1400 ? 2.5 : bmp.width < 2200 ? 1.5 : 1;
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingQuality = 'high'; x.drawImage(bmp, 0, 0, c.width, c.height);
    const im = x.getImageData(0, 0, c.width, c.height), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; const v = Math.max(0, Math.min(255, (255 - g) * 1.25 - 10)); d[i] = d[i + 1] = d[i + 2] = v; }
    x.putImageData(im, 0, 0); return c;
  }
  async function ler(file, prog) {
    await carregar();
    if (!worker) worker = await Tesseract.createWorker('por', 1, { logger: m => prog && prog(m) });
    await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
    const { data } = await worker.recognize(await preparar(file));
    return data.text.split('\n').map(s => s.trim()).filter(Boolean);
  }
  return { ler, parse, linha, numero };
})();
