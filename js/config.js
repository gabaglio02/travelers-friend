/*
 * Configuração do site.
 *  apiBase: endereço do servidor da agenda.
 *    ""   → mesmo endereço do site (quando o site é servido pelo serve.js)
 *    "https://api.seudominio.com" → servidor em outro lugar
 *    null → não buscar no servidor; usar só os arquivos em js/data/
 */
window.TF_CONFIG = {
  apiBase: "",
  // Supabase: endereço e chave PÚBLICA ("anon") — feitos para ir ao navegador; quem protege os dados
  // são as regras de Row Level Security (supabase/*.sql). Ficam aqui para os endereços de teste da
  // Vercel funcionarem mesmo sem as variáveis de ambiente. NUNCA coloque a chave service_role aqui.
  supabaseUrl: "https://kjogfdggtboywpdiverv.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtqb2dmZGdndGJveXdwZGl2ZXJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzMjY0MTMsImV4cCI6MjEwODkwMjQxM30.0jrypq3EhEPpiU5BtR9Mhm7PCndLVvToTbgDl2JWIGk"
};
