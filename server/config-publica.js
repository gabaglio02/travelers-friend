/*
 * Configuração que o navegador pode ver (GET /api/config).
 * A chave "anon"/"publishable" do Supabase é pública por natureza: quem protege os dados
 * são as regras de Row Level Security do supabase/schema.sql. Nunca coloque a service_role aqui.
 *
 * Aceita os nomes de variável que a integração Supabase da Vercel cria.
 */
module.exports = function configPublica() {
  const env = process.env;
  return {
    supabaseUrl: env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || null,
    supabaseAnonKey: env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      || env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || null
  };
};
