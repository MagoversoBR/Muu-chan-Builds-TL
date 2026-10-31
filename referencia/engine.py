"""Motor de formulas de Throne and Liberty (estimativa por modelagem matemática).

Referencia em Python; a pagina do otimizador usa a mesma logica em JavaScript (engine.js).
Tudo aqui e aproximado e nao garantido: ver os comentarios de cada formula.
"""
from copy import deepcopy

K_CHANCE = 1000      # chance = d/(d+1000)           (medido)
K_AMP = 1000         # Amp de dano  1+A/(A+1000)     (medido ate 1.136,5)
K_AMP_CURA = 3060    # Amp de cura  1+1,014A/(A+3060) (medido ate 1.136,5)
K_DEF_FIS = 2500     # Defesa fisica                  (medido, 1 mob)
K_DEF_MAG = 860      # Defesa magica                  (medido, 1 mob)
K_RES = 900          # Resistencia de habilidade      (indicativo)
V_TETO = 120         # teto de Velocidade de Recarga  (tooltip)
AS_TETO = 150        # teto de Velocidade de Ataque   (maximo do jogo, informado pelo jogador)

# Build de exemplo: ficha do mago full (videos da raid, 29/10/2026)
BUILD = dict(
    dano_min=555, dano_max=1491,
    crit=2726, pesado=1617.8, acerto=1356,
    crit_chefe=12, pesado_chefe=933,
    dc=22.1, dap=141, dap_extra=14,       # dap_extra: buff condicional do set Asas (0,2 x ~70% de uptime)
    amp=850.5, bonus=62, amp_magico=3,    # amp_magico: Foco Malevolo (+2,6~3%)
    recarga=105.8, vel_ataque=123.6,
    cura=15.08, cura_cont=0, cura_rec=4, esc_div=0,
    def_corpo=4180, def_mag=4195, resist=338, reducao=44, vida=30293,
)
# Alvo: chefe medio (Tolerancia mediana dos chefes medidos ~300; Esquiva de pesado ~0)
ALVO = dict(tipo="chefe", tol=300, esq=0, aliado_tol=0, aliado_esq=0)
# Referencia de skill (Raio em Cadeia 475% + 232, +90% contra monstros) e pesos
OPC = dict(coef=4.75, fixo=232, monstro=1.9, parte_skill=0.85, parte_recarga=0.5)


def chance(d):
    d = max(0.0, d)
    return d / (d + K_CHANCE)


def f_amp(a):
    return 1 + a / (a + K_AMP)


def f_amp_cura(a):
    return 1 + 1.014 * a / (a + K_AMP_CURA)


def chance_acerto(a):
    # Muito aproximado: so 2 pontos medidos (miss 52% com Acerto 62 e 6% com 1.346)
    return (a + 18) / (a + 105)


def chances(b, t):
    chefe = t["tipo"] == "chefe"
    pc = chance(b["crit"] + (b["crit_chefe"] if chefe else 0) - t["tol"])
    ph = chance(b["pesado"] + (b["pesado_chefe"] if chefe else 0) - t["esq"])
    return pc, ph


def dano(b, t, o):
    """Dano esperado por golpe (skill de referencia e ataque basico) e taxas."""
    pc, ph = chances(b, t)
    rm, rx = (b["dano_min"] + b["dano_max"]) / 2, b["dano_max"]
    dc, dap = b["dc"] / 100, (b["dap"] + b["dap_extra"]) / 100
    mag = 1 + b["amp_magico"] / 100
    acerto = chance_acerto(b["acerto"])
    pes = 1 + ph * dap
    c, f = o["coef"], o["fixo"]
    skill = acerto * (((1 - pc) * (c * rm + f) + pc * (c * rx + f) * (1 + dc))
                      * f_amp(b["amp"]) * o["monstro"] * mag * pes + b["bonus"])
    basico = acerto * (((1 - pc) * rm + pc * rx * (1 + dc)) * mag * pes + b["bonus"])
    s = o["parte_recarga"]
    taxa_skill = (1 - s) + s * (1 + min(b["recarga"], V_TETO) / 100)
    taxa_basico = 1 + min(b["vel_ataque"], AS_TETO) / 100
    return dict(skill=skill * taxa_skill, basico=basico * taxa_basico)


def cura(b, t, o):
    """Cura Celere (direta) e cura continua (ticks); chances usam a Tolerancia/Esquiva do ALVO da cura (hipotese)."""
    pc = chance(b["crit"] - t["aliado_tol"])
    ph = chance(b["pesado"] - t["aliado_esq"])
    rm, rx = (b["dano_min"] + b["dano_max"]) / 2, b["dano_max"]
    dap = (b["dap"]) / 100            # o buff condicional do set nao vale em cura (medido)
    mult = (1 + b["cura"] / 100) * f_amp_cura(b["amp"]) * (1 + b["cura_rec"] / 100) * (1 + b["esc_div"] / 100)
    direta = ((1 - pc) * (3.15 * rm + 1100) + pc * (3.15 * rx + 1100)) * mult * (1 + ph * dap)
    # ticks de cura continua: aproximado, (1+Cura Continua) com Amp e Cura Recebida
    ticks = (1 + b["cura_cont"] / 100) * f_amp_cura(b["amp"]) * (1 + b["cura_rec"] / 100) * (1 + ph * dap) * (0.488 * rm + 225) * 3.0
    return dict(direta=direta, ticks=ticks)


def dano_recebido(b):
    fis = K_DEF_FIS / (K_DEF_FIS + b["def_corpo"]) * (1 - b["reducao"] / 100)
    mag = K_DEF_MAG / (K_DEF_MAG + b["def_mag"]) * K_RES / (K_RES + b["resist"])
    return dict(fis=fis, mag=mag)


def metricas(b, t=ALVO, o=OPC):
    d, c, r = dano(b, t, o), cura(b, t, o), dano_recebido(b)
    return dict(skill=d["skill"], basico=d["basico"], cura=c["direta"], hot=c["ticks"],
                vida_fis=b["vida"] / r["fis"], vida_mag=b["vida"] / r["mag"])


def indices(b, base, t=ALVO, o=OPC):
    """Tudo relativo a build base (=100)."""
    m, m0 = metricas(b, t, o), metricas(base, t, o)
    w = o["parte_skill"]
    out = {k: 100 * m[k] / m0[k] for k in m}
    out["dano"] = w * out["skill"] + (1 - w) * out["basico"]
    out["sobrev"] = (out["vida_fis"] + out["vida_mag"]) / 2
    return out


# Stats ajustaveis: (chave, nome, passo, unidade do passo)
PASSOS = [
    ("dano_base", "Dano Base (%)", 5, "+5%"),
    ("crit", "Chance de crítico (rating)", 100, "+100"),
    ("pesado", "Chance de ataque pesado (rating)", 100, "+100"),
    ("acerto", "Chance de acerto (rating)", 100, "+100"),
    ("dc", "Dano Crítico (%)", 10, "+10"),
    ("dap", "Dano de Ataque Pesado (%)", 10, "+10"),
    ("amp", "Ampliação de Dano de Habilidade", 100, "+100"),
    ("bonus", "Bônus de Dano", 10, "+10"),
    ("recarga", "Velocidade de Recarga (%)", 10, "+10"),
    ("vel_ataque", "Velocidade de Ataque (%)", 10, "+10"),
    ("cura", "Cura (%)", 10, "+10"),
    ("cura_cont", "Cura Contínua de Habilidade (%)", 10, "+10"),
    ("cura_rec", "Cura Recebida (%)", 10, "+10"),
    ("def_corpo", "Defesa corpo a corpo", 100, "+100"),
    ("def_mag", "Defesa mágica", 100, "+100"),
    ("resist", "Resistência a Dano de Habilidade", 100, "+100"),
    ("reducao", "Redução de Dano (%)", 10, "+10"),
    ("vida", "Vida máxima", 1000, "+1.000"),
]


def aplicar(b, chave, delta):
    n = deepcopy(b)
    if chave == "dano_base":
        n["dano_min"] *= 1 + delta / 100
        n["dano_max"] *= 1 + delta / 100
    else:
        n[chave] = max(0, n[chave] + delta)
    return n


def marginais(b, t=ALVO, o=OPC):
    out = []
    for chave, nome, passo, rot in PASSOS:
        ind = indices(aplicar(b, chave, passo), b, t, o)
        out.append((chave, nome, rot, {k: ind[k] - 100 for k in ("dano", "cura", "hot", "sobrev")}))
    return out


if __name__ == "__main__":
    for chave, nome, rot, g in marginais(BUILD):
        print(f"{nome:42s} {rot:7s} dano {g['dano']:+.2f}%  cura {g['cura']:+.2f}%  hot {g['hot']:+.2f}%  sobrev {g['sobrev']:+.2f}%")
