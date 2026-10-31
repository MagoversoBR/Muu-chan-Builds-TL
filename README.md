# Muu-chan Builds TL

Simulador independente de builds de Throne and Liberty, desenvolvido por meio de modelagem matemática e análise empírica de mecânicas observadas no jogo. Os resultados são estimativas (outubro de 2026) e podem diferir dos valores reais.

App de PC e celular (PWA) que mostra onde cada ponto de stat rende mais, onde o retorno já caiu, e o efeito de trocar um stat por outro. Só PvE.

## Aviso

- Projeto gratuito, sem fins lucrativos e **não afiliado** à Amazon Games, à NCSOFT ou a qualquer publicadora do jogo. Nomes e marcas pertencem aos seus donos.
- O app **não acessa o jogo**: não lê memória nem tráfego de rede, não altera arquivos, não injeta nada e não automatiza ações. Só usa números que a própria pessoa digita, cola (JSON) ou envia em print da sua ficha.
- A leitura de print roda no próprio aparelho. As builds ficam salvas só no aparelho, e o app não envia dados para servidor nenhum (as únicas conexões externas são para baixar a fonte do Google Fonts e o leitor de texto, este só na primeira leitura de print).
- Use por sua conta e risco; verifique os termos de serviço do jogo se tiver dúvida.

## Como abrir

- **No PC, mais simples:** dê dois cliques em `abrir.bat`. Ele abre o app no navegador (precisa do Python instalado). Feche a janela preta para parar.
- **Sem instalar nada:** dê dois cliques em `index.html`. Funciona, mas sem instalar como app e sem modo offline.
- **Como app instalado (PC e celular):** o app precisa estar num endereço https. A forma grátis é publicar a pasta no GitHub Pages ou no Cloudflare Pages. Depois, no Chrome ou Edge use "Instalar app"; no celular, "Adicionar à tela inicial". Depois da primeira abertura ele funciona sem internet.

As builds ficam salvas só no aparelho (localStorage). Para levar uma build de um aparelho para outro, use Ficha > "Copiar ficha atual" e cole no outro com "Aplicar JSON".

## Páginas

Início (resumo e alertas), Otimizar (ranking de ganho por stat), Curvas (gráfico de retorno decrescente com ponto de parada), E se? (simulador de trocas), Builds (várias fichas e comparação), Ficha (editar números e importar JSON), Sobre (fórmulas e confiança).

## Arquivos

- `js/engine.js`: motor de fórmulas (a parte que importa; sem interface).
- `js/app.js`: interface e armazenamento.
- `css/app.css`: visual (tema escuro, claro e automático).
- `sw.js` e `manifest.webmanifest`: instalação e modo offline. Ao publicar uma atualização, aumente `VERSAO` em `sw.js`.
- `referencia/engine.py` e `golden.py`: versão em Python do motor e testes contra números medidos nos vídeos (`python golden.py`).

## Ler a ficha de um print (feito)

Em Ficha > "Ler de um print": escolha, arraste ou cole (Ctrl+V) um ou mais prints da ficha (Efeitos Básicos, Ataque e Proteção, aba Chefes). O app lê o texto no próprio aparelho (Tesseract.js; baixa o leitor na primeira vez, então precisa de internet), mostra os números lidos para você conferir e só aplica o que estiver marcado. Testado com recortes reais da ficha em `referencia/ocr-testes/` (14 campos, todos corretos). Prints do jogo inteiro funcionam, mas ficam mais lentos; recortar a ficha melhora.

## Próxima etapa combinada

1. Chat com o Claude dentro do app, usando a sua chave de API (guardada só no aparelho), para ler print e responder "vale a pena?".
