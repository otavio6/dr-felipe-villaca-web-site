# Galeria antes/depois

Cinco cards com comparador arrastável na home, cinco na landing page. A barra
divide a foto: à esquerda o antes, à direita o depois.

---

## Como o código decide o modo

O array `RESULTS`, dentro do `<script>` do `index.html`, define cada card:

```js
{ cat:'lipohd', slug:'lipo-hd', nome:'Lipoescultura HD', modo:'wipe', rec:'...' }
```

| `modo` | Comportamento | Foto exigida |
|---|---|---|
| `wipe` | barra arrastável | **800x920**, par com enquadramento casado |
| `lado` | lado a lado, sem barra | **400x920** (metade do card) |

Hoje os cinco pares estão em `wipe`.

**Trocar a flag sem regerar a foto quebra o card.** Um 400x920 entra no
`object-fit: cover` do container, que tem proporção 4/4.6, e sai com zoom de 2x.

As fotos vivem em `assets/img/resultados/`, em pares `.jpg` + `.webp`.

---

## Como preparar um par novo

1. **Alinhar por marco anatômico.** Umbigo para abdômen, sulco glúteo para
   glúteo e lipedema. A largura do quadril serve de referência de escala — é ela
   que faz o corpo não "saltar" ao arrastar a barra.
2. **Exportar 800x920**, jpg e webp.
3. Somar a entrada em `RESULTS` com `modo:'wipe'` e o botão de filtro
   correspondente.
4. **Fazer o mesmo na `lp.html`** — ela tem galeria própria e duplicada.

### Se os fundos das duas fotos forem diferentes

Precisa uniformizar antes, senão a cor do fundo salta no meio do arrasto. Recorte
não resolve: a perna afina e sobra fundo ao lado da coxa em qualquer enquadramento.

**Use modelo de segmentação, não heurística de cor.** Está documentado abaixo por
que — a via heurística já foi tentada, publicada, e revertida.

---

## Uniformização de fundo: o que funciona

`briaai/RMBG-1.4` via `@huggingface/transformers`, rodando local. ~1,2s por imagem.
Recorta a pessoa, e o fundo é substituído por `#18181b` nas duas fotos do par.
Nenhum pixel do corpo é alterado — o contorno vem da foto original.

Detalhes de implementação que custaram tempo:

- O `sharp` aninhado dentro de `@huggingface/transformers` quebra com
  `colourspace: parameter space not set`. Solução: fazer o pré-processamento
  (resize 1024, `/255`, mean 0.5) com o `sharp` de topo e mandar o tensor direto ao
  modelo, sem passar pelo `RawImage` deles.
- `@imgly/background-removal-node` não serve: o host de pesos responde 404, e o
  parser de URI dele trata caminho do Windows como "protocolo `c:`".

**Verificação:** pixels remanescentes na cor da parede original caem para 0,04% nas
fotos de fundo creme. Nas de fundo escuro ficam ~20%, mas a parede original delas já
é praticamente a cor do fundo novo — indistinguível.

---

## Heurística de cor NÃO funciona neste acervo

Duas abordagens falharam e foram revertidas da produção em 2026-07-30:

**Varredura por linha, parando na variação de cor.** Para na sombra da parede,
achando que é a silhueta, e deixa faixas do fundo original para trás. Foi ao ar e
apareceu como manchas creme na borda esquerda das fotos.

**Flood fill bloqueado por gradiente (Sobel).** O contorno do corpo nessas fotos tem
gradiente de apenas **7-18**, contra **0-3** da parede. Medido com sonda, não
suposto. Qualquer limiar que cubra a parede sombreada também atravessa a silhueta —
o preenchimento inundou as duas coxas inteiras do `gluteo-antes`.

**Causa raiz:** existe pele com a mesma cor **e** o mesmo contraste de borda que a
parede. Coxa em sombra no antes do glúteo; parede sombreada no depois do lipedema.
Nenhum ajuste de parâmetro separa isso.

---

## Regra de integridade

**Nenhum filtro visual pode ser aplicado só ao "antes".**

A `lp.html` tinha `filter: grayscale(1) brightness(.92)` no `.ba .before`. Com as
imagens de demonstração era só estética; com foto real de paciente, dessatura e
escurece o antes e faz o resultado parecer maior do que foi. Removido.

O site cita a Resolução CFM nº 2.336/2023 logo abaixo da galeria. O aviso atual diz
que não há edição de contorno, silhueta ou retoque do resultado, e que **nos pares
fotografados em locais distintos apenas o fundo foi padronizado**. Se o
processamento das imagens mudar, o aviso muda no mesmo passo.

---

## Originais

Ficam soltos em `assets/img/`, fora do versionamento (`.gitignore` bloqueia
`assets/img/*`, exceto `resultados/`). São os masters das pacientes, com EXIF de GPS
e data.

Dois deles — `Abdominoplastia - Depois` e `Glúteo - Depois` — são **HEIC sem
extensão**, 3024x4032. O Windows não decodifica HEIC sem a extensão instalada, e
`System.Drawing`/WIC falham. Usar `heic-decode` + `sharp` via npm.

---

## Estado atual

| Card | Modo | Fundo |
|---|---|---|
| Lipoescultura HD | wipe | original, já casado |
| Mamoplastia | wipe | original, já casado |
| Abdominoplastia | wipe | original, já casado |
| Remodelamento Glúteo | wipe | uniformizado por RMBG-1.4 |
| Lipedema | wipe | uniformizado por RMBG-1.4 |

Remodelamento Costal não tem par fotografado — por isso não aparece.
