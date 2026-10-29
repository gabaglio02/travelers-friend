/*
 * Configuração do site.
 *  apiBase: endereço do servidor da agenda.
 *    ""   → mesmo endereço do site (quando o site é servido pelo serve.js)
 *    "https://api.seudominio.com" → servidor em outro lugar
 *    null → não buscar no servidor; usar só os arquivos em js/data/
 */
window.TF_CONFIG = {
  apiBase: ""
};
