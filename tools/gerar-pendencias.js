// Gera "docs/O que ficou de fora - Fase 2.docx" a partir de docs/pendencias.json:
// lugares e eventos pesquisados que NÃO entraram no site, com o motivo e o que faria entrar.
// Regra: toda pesquisa nova acrescenta aqui o que ficou de fora (o usuário usa a lista para ligar ou pesquisar).
// Uso: numa pasta com o pacote docx instalado (npm install docx),
//   NODE_PATH=<pasta>/node_modules node tools/gerar-pendencias.js [pasta-do-projeto]
const fs = require("fs"), path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  HeadingLevel, AlignmentType, PageOrientation, BorderStyle, LevelFormat
} = require("docx");

const raiz = process.argv[2] || path.join(__dirname, "..");
const dados = JSON.parse(fs.readFileSync(path.join(raiz, "docs/pendencias.json"), "utf8"));
const saida = path.join(raiz, "docs/O que ficou de fora - Fase 2.docx");
const GRUPOS = dados.grupos.map((g) => ({ titulo: g.titulo, itens: g.itens.map((i) => [i.oque, i.cidade, i.motivo, i.paraEntrar]) }));

const LARG = [3000, 2000, 5100, 3500]; // paisagem A4: 16838 − 2 × 1080 de margem ≈ 14678; soma = 13600
const TOTAL = LARG.reduce((a, b) => a + b, 0);
const borda = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };
const bordas = { top: borda, bottom: borda, left: borda, right: borda };
const celula = (texto, i, cab) => new TableCell({
  width: { size: LARG[i], type: WidthType.DXA }, borders: bordas,
  shading: cab ? { type: ShadingType.CLEAR, fill: "0B0B0B", color: "auto" } : undefined,
  margins: { top: 60, bottom: 60, left: 100, right: 100 },
  children: [new Paragraph({ children: [new TextRun({ text: texto, bold: cab || i === 0, color: cab ? "FFFFFF" : "0B0B0B", size: 19 })] })]
});
const tabela = (itens) => new Table({
  width: { size: TOTAL, type: WidthType.DXA }, columnWidths: LARG,
  rows: [
    new TableRow({ tableHeader: true, children: ["O quê", "Cidade", "Por que não entrou", "O que faria entrar"].map((t, i) => celula(t, i, true)) }),
    ...itens.map((linha) => new TableRow({ children: linha.map((t, i) => celula(t, i, false)) }))
  ]
});

const total = GRUPOS.reduce((t, g) => t + g.itens.length, 0);
const doc = new Document({
  styles: { default: { document: { run: { font: "Calibri", size: 21 } } } },
  numbering: { config: [{ reference: "pontos", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 360, hanging: 240 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
      margin: { top: 1000, bottom: 1000, left: 1080, right: 1080 } } },
    children: [
      new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("Traveler's Friend — o que ficou de fora da Fase 2")] }),
      new Paragraph({ children: [new TextRun({ text: `Atualizado em ${dados.atualizadoEm.split("-").reverse().join("/")}`, color: "6B6B6B" })] }),
      new Paragraph({ spacing: { before: 200 }, children: [new TextRun(
        `Lugares e eventos que apareceram nas pesquisas (prefeituras, imprensa local e guias de turismo) e não foram colocados no site: ${total} itens. ` +
        "A regra foi só cadastrar o que tivesse informação firme: horário, preço e acesso de fonte recente ou oficial, sem divergência séria.")] }),
      new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: "Motivos mais comuns", bold: true })] }),
      ...["Horário ou preço só em fonte antiga, sem data ou que diverge de outra fonte.",
        "Evento que já aconteceu em 2026 e ainda não tem data em 2027 (alguns viraram dica no detalhe do lugar).",
        "Lugar fechado, em reforma, sem visitação ao público ou só com agendamento.",
        "Atividade de risco (cachoeiras e trilhas sem estrutura, airsoft) sem informação de segurança confiável.",
        "Citado nos guias, mas não pesquisado a fundo (fica para uma próxima rodada)."]
        .map((t) => new Paragraph({ numbering: { reference: "pontos", level: 0 }, children: [new TextRun(t)] })),
      ...GRUPOS.flatMap((g) => [
        new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 320, after: 120 }, children: [new TextRun(g.titulo)] }),
        tabela(g.itens)
      ])
    ]
  }]
});
Packer.toBuffer(doc).then((b) => { fs.writeFileSync(saida, b); console.log("ok", saida, total, "itens"); });
