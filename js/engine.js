// Motor de formulas de Throne and Liberty (aproximado, engenharia reversa). Espelho de engine.py.
const TL = (() => {
  const K_CHANCE = 1000, K_AMP = 1000, K_AMP_CURA = 3060, K_DEF_FIS = 2500, K_DEF_MAG = 860, K_RES = 900, V_TETO = 120, AS_TETO = 150;

  const BUILD = {
    dano_min: 555, dano_max: 1491, crit: 2726, pesado: 1617.8, acerto: 1356,
    crit_chefe: 12, pesado_chefe: 933, dc: 22.1, dap: 141, dap_extra: 14,
    amp: 850.5, bonus: 62, amp_magico: 3, recarga: 105.8, vel_ataque: 123.6,
    cura: 15.08, cura_cont: 0, cura_rec: 4, esc_div: 0,
    def_corpo: 4180, def_mag: 4195, resist: 338, reducao: 44, vida: 30293,
  };
  const ALVO = { tipo: 'chefe', tol: 300, esq: 0, aliado_tol: 0, aliado_esq: 0 };
  const OPC = { coef: 4.75, fixo: 232, monstro: 1.9, parte_skill: 0.85, parte_recarga: 0.5 };

  const chance = d => { d = Math.max(0, d); return d / (d + K_CHANCE); };
  const fAmp = a => 1 + a / (a + K_AMP);
  const fAmpCura = a => 1 + 1.014 * a / (a + K_AMP_CURA);
  const chanceAcerto = a => (a + 18) / (a + 105);

  function chances(b, t) {
    const chefe = t.tipo === 'chefe';
    return [chance(b.crit + (chefe ? b.crit_chefe : 0) - t.tol), chance(b.pesado + (chefe ? b.pesado_chefe : 0) - t.esq)];
  }

  function dano(b, t, o) {
    const [pc, ph] = chances(b, t);
    const rm = (b.dano_min + b.dano_max) / 2, rx = b.dano_max;
    const dc = b.dc / 100, dap = (b.dap + b.dap_extra) / 100, mag = 1 + b.amp_magico / 100;
    const acerto = chanceAcerto(b.acerto), pes = 1 + ph * dap;
    const skill = acerto * (((1 - pc) * (o.coef * rm + o.fixo) + pc * (o.coef * rx + o.fixo) * (1 + dc)) * fAmp(b.amp) * o.monstro * mag * pes + b.bonus);
    const basico = acerto * (((1 - pc) * rm + pc * rx * (1 + dc)) * mag * pes + b.bonus);
    const s = o.parte_recarga;
    return {
      skill: skill * ((1 - s) + s * (1 + Math.min(b.recarga, V_TETO) / 100)),
      basico: basico * (1 + Math.min(b.vel_ataque, AS_TETO) / 100),
    };
  }

  function cura(b, t) {
    const pc = chance(b.crit - t.aliado_tol), ph = chance(b.pesado - t.aliado_esq);
    const rm = (b.dano_min + b.dano_max) / 2, rx = b.dano_max, dap = b.dap / 100;
    const mult = (1 + b.cura / 100) * fAmpCura(b.amp) * (1 + b.cura_rec / 100) * (1 + b.esc_div / 100);
    const direta = ((1 - pc) * (3.15 * rm + 1100) + pc * (3.15 * rx + 1100)) * mult * (1 + ph * dap);
    const ticks = (1 + b.cura_cont / 100) * fAmpCura(b.amp) * (1 + b.cura_rec / 100) * (1 + ph * dap) * (0.488 * rm + 225) * 3;
    return { direta, ticks };
  }

  function danoRecebido(b) {
    return {
      fis: K_DEF_FIS / (K_DEF_FIS + b.def_corpo) * (1 - b.reducao / 100),
      mag: K_DEF_MAG / (K_DEF_MAG + b.def_mag) * K_RES / (K_RES + b.resist),
    };
  }

  function metricas(b, t, o) {
    const d = dano(b, t, o), c = cura(b, t), r = danoRecebido(b);
    return { skill: d.skill, basico: d.basico, cura: c.direta, hot: c.ticks, vida_fis: b.vida / r.fis, vida_mag: b.vida / r.mag };
  }

  function indices(b, base, t, o) {
    const m = metricas(b, t, o), m0 = metricas(base, t, o), out = {};
    for (const k in m) out[k] = 100 * m[k] / m0[k];
    out.dano = o.parte_skill * out.skill + (1 - o.parte_skill) * out.basico;
    out.sobrev = (out.vida_fis + out.vida_mag) / 2;
    return out;
  }

  // chave, nome, passo, rotulo, grupo, faixa do grafico [min, max]
  const STATS = [
    ['dano_base', 'Dano Base (%)', 5, '+5%', 'ofensivo', [-40, 80]],
    ['crit', 'Chance de crítico', 100, '+100', 'ofensivo', [0, 6000]],
    ['pesado', 'Chance de ataque pesado', 100, '+100', 'ofensivo', [0, 6000]],
    ['acerto', 'Chance de acerto', 100, '+100', 'ofensivo', [0, 3000]],
    ['dc', 'Dano Crítico (%)', 10, '+10', 'ofensivo', [0, 400]],
    ['dap', 'Dano de Ataque Pesado (%)', 10, '+10', 'ofensivo', [0, 400]],
    ['amp', 'Ampliação de Dano de Habilidade', 100, '+100', 'ofensivo', [0, 3000]],
    ['bonus', 'Bônus de Dano', 10, '+10', 'ofensivo', [0, 600]],
    ['recarga', 'Velocidade de Recarga (%)', 10, '+10', 'ofensivo', [0, 140]],
    ['vel_ataque', 'Velocidade de Ataque (%)', 10, '+10', 'ofensivo', [0, 170]],
    ['cura', 'Cura (%)', 10, '+10', 'cura', [0, 600]],
    ['cura_cont', 'Cura Contínua de Habilidade (%)', 10, '+10', 'cura', [0, 600]],
    ['cura_rec', 'Cura Recebida (%)', 10, '+10', 'cura', [0, 200]],
    ['def_corpo', 'Defesa corpo a corpo', 100, '+100', 'defesa', [0, 8000]],
    ['def_mag', 'Defesa mágica', 100, '+100', 'defesa', [0, 8000]],
    ['resist', 'Resistência a Dano de Habilidade', 100, '+100', 'defesa', [0, 2000]],
    ['reducao', 'Redução de Dano (%)', 10, '+10', 'defesa', [0, 80]],
    ['vida', 'Vida máxima', 1000, '+1.000', 'defesa', [10000, 80000]],
  ].map(([chave, nome, passo, rotulo, grupo, faixa]) => ({ chave, nome, passo, rotulo, grupo, faixa }));

  function valor(b, chave) { return chave === 'dano_base' ? 0 : b[chave]; }

  function aplicar(b, chave, delta) {
    const n = { ...b };
    if (chave === 'dano_base') { n.dano_min = b.dano_min * (1 + delta / 100); n.dano_max = b.dano_max * (1 + delta / 100); }
    else n[chave] = Math.max(0, b[chave] + delta);
    return n;
  }

  // Foco: pesos sobre os indices. Em cada foco o ganho e medido nesse indice.
  const FOCOS = {
    dano: { nome: 'Dano', pesos: { dano: 1 } },
    cura: { nome: 'Cura direta', pesos: { cura: 1 } },
    hot: { nome: 'Cura contínua', pesos: { hot: 1 } },
    sobrev: { nome: 'Sobrevivência', pesos: { sobrev: 1 } },
    misto: { nome: 'Dano + sobrevivência', pesos: { dano: 0.7, sobrev: 0.3 } },
  };
  const foco = (ind, f) => Object.entries(FOCOS[f].pesos).reduce((s, [k, w]) => s + w * ind[k], 0);

  // Ganho (em %) do foco ao mexer 'delta' no stat
  const ganho = (b, chave, delta, f, t, o) => foco(indices(aplicar(b, chave, delta), b, t, o), f) - 100;

  // Valor de um ponto do stat na curva: indice do foco com o stat em x, relativo a build atual
  function curva(b, chave, f, t, o, n = 80) {
    const st = STATS.find(s => s.chave === chave), [lo, hi] = st.faixa, base = valor(b, chave), pts = [];
    for (let i = 0; i <= n; i++) {
      const x = lo + (hi - lo) * i / n;
      const bb = aplicar(b, chave, x - base);
      pts.push({ x, y: foco(indices(bb, b, t, o), f), marg: ganho(bb, chave, st.passo, f, t, o) });
    }
    return pts;
  }

  return { BUILD, ALVO, OPC, STATS, FOCOS, chance, fAmp, fAmpCura, chances, metricas, indices, aplicar, valor, ganho, curva, foco, V_TETO };
})();
if (typeof module !== 'undefined') module.exports = TL;
