/*
 * Fonte "arquivo-local": os eventos com data que já estão nos arquivos do site
 * (js/data/sp.js e js/data/sp-eventos.js). Os arquivos são lidos a cada coleta,
 * então editar sp-eventos.js já atualiza a API sem reiniciar o servidor.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ARQUIVOS = { sp: ["js/data/sp.js", "js/data/sp-eventos.js"] };

module.exports = {
  nome: "arquivo-local",
  ativa: () => true,
  async coletar({ cidade, root }) {
    // Os arquivos foram feitos para o navegador (window.TF_CITIES); rodamos num sandbox com um "window" falso.
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    for (const rel of ARQUIVOS[cidade] || []) {
      vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), sandbox, { filename: rel, timeout: 2000 });
    }
    const dados = sandbox.window.TF_CITIES && sandbox.window.TF_CITIES[cidade];
    if (!dados) return [];
    // Copia via JSON para soltar os objetos do sandbox e descartar campos undefined.
    return JSON.parse(JSON.stringify(dados.lugares.filter((p) => p.datas || p.periodo)));
  }
};
