"""Testes contra numeros ja medidos nos videos (a engine tem que reproduzi-los)."""
from engine import *

ok = True


def check(nome, obtido, esperado, tol):
    global ok
    bom = abs(obtido - esperado) <= tol
    ok &= bom
    print(("OK  " if bom else "ERRO"), nome, round(obtido, 3), "esperado", esperado, "tol", tol)


# 1) Chance de pesado no chefe: rating efetivo 2.550,8 contra Esquiva 0 -> 71,8%
check("pesado 2550,8", chance(2550.8) * 100, 71.8, 0.1)
# 2) Defesa: dano do mob 681 contra Defesa 215 com K=2500 -> 627 (medido 627)
check("defesa K=2500", 681 * K_DEF_FIS / (K_DEF_FIS + 215), 627, 1)
# 3) Dano de skill (Raio em Cadeia, crit com R max): Amp 615/900,5/1136,5 -> 21.923/23.409/24.330 (build completa)
for amp, bonus, esperado in ((615, 62, 21923), (900.5, 76, 23409), (1136.5, 76, 24330)):
    v = (4.75 * 1346 + 232) * 1.9 * f_amp(amp) * 1.03 * 1.221 + bonus
    check(f"Raio em Cadeia crit Amp {amp}", v, esperado, 3)
# 4) Cura Celere (crit = R max): Varinha 294~651, Cura 216,61, CR 4, ED 14: Amp 555 -> 13.670, Amp 871 -> 14.487
for amp, esperado in ((555, 13670), (871, 14487)):
    v = (3.15 * 651 + 1100) * (1 + 2.1661) * f_amp_cura(amp) * 1.04 * 1.14
    check(f"Cura Celere crit Amp {amp}", v, esperado, 5)
# 5) Razao de Amp na cura 615 -> 1.136,5 = 1,090
check("razao Amp cura", f_amp_cura(1136.5) / f_amp_cura(615), 1.090, 0.002)

print("\nTUDO OK" if ok else "\nHA ERROS")
raise SystemExit(0 if ok else 1)
