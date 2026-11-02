/* Constantes do Traveler's Friend (sem dependências). */

export const CITY_OPTIONS = [
  { id: "sp", nome: "São Paulo, SP" },
  { id: "rj", nome: "Rio de Janeiro, RJ", soon: true },
  { id: "bh", nome: "Belo Horizonte, MG", soon: true },
  { id: "ssa", nome: "Salvador, BA", soon: true },
  { id: "cwb", nome: "Curitiba, PR", soon: true }
];

export const CATEGORIES = {
  ponto: "Pontos turísticos",
  museu: "Museus",
  parque: "Parques",
  show: "Shows",
  teatro: "Teatro & concertos",
  festival: "Festivais",
  gastronomia: "Gastronomia",
  compras: "Compras & shoppings",
  noite: "Bares & noite",
  exposicao: "Exposições temporárias",
  trilha: "Trilhas & natureza",
  esporte: "Esportes & estádios"
};

// Classificação indicativa (padrão ClassInd).
//  desc  → como descrevemos a classificação de um lugar
//  faixa → como a pessoa escolhe a idade da pessoa mais nova do grupo (campo "Idade mínima")
export const AGE_OPTIONS = [
  { v: 0, label: "Livre", desc: "Livre para todos os públicos", faixa: "Menos de 10 anos", faixaDesc: "Mostra só o que é livre para todos" },
  { v: 10, label: "10 anos", desc: "Não recomendado para menores de 10", faixa: "10 ou 11 anos", faixaDesc: "Mostra até a classificação 10" },
  { v: 12, label: "12 anos", desc: "Não recomendado para menores de 12", faixa: "12 ou 13 anos", faixaDesc: "Mostra até a classificação 12" },
  { v: 14, label: "14 anos", desc: "Não recomendado para menores de 14", faixa: "14 ou 15 anos", faixaDesc: "Mostra até a classificação 14" },
  { v: 16, label: "16 anos", desc: "Não recomendado para menores de 16", faixa: "16 ou 17 anos", faixaDesc: "Mostra até a classificação 16" },
  { v: 18, label: "18 anos", desc: "Não recomendado para menores de 18", faixa: "18 anos ou mais", faixaDesc: "Mostra tudo, inclusive baladas e bares 18+" }
];

export const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const WEEKDAYS_FULL = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
export const STORAGE_KEY = "travelerfriend:v1";
export const MAX_DAYS = 21;
export const WALK_LIMIT_KM = 1.2;
// Limite para uma recomendação contar como "perto": na capital pela distância;
// fora dela (Grande SP, mais espalhada e com menos trânsito) pelo tempo estimado do trecho.
export const PERTO = { capitalKm: 3, foraMin: 30 };

// Meios de transporte entre lugares do roteiro.
export const MODES = {
  pe: { icon: "🚶", label: "A pé" },
  bike: { icon: "🚲", label: "Bicicleta" },
  metro: { icon: "🚇", label: "Metrô" },
  trem: { icon: "🚆", label: "Trem (CPTM)" },
  onibus: { icon: "🚌", label: "Ônibus" },
  carro: { icon: "🚗", label: "App / carro" }
};

// Refeições do dia.
// "janela" é o intervalo em que ainda faz sentido encaixar a refeição; "min" é o tempo abaixo do qual avisamos.
export const MEALS = {
  cafe: { label: "Café da manhã", icon: "☕", min: 15, janela: [6 * 60, 10 * 60 + 30] },
  almoco: { label: "Almoço", icon: "🍽", min: 30, janela: [11 * 60, 15 * 60] },
  jantar: { label: "Jantar", icon: "🍝", min: 30, janela: [18 * 60, 22 * 60 + 30] }
};

// Ilustração de cada categoria (usada quando o lugar não tem foto livre).
export const CAT_ICON = {
  ponto: "📍", museu: "🏛️", parque: "🌳", show: "🎤", teatro: "🎭", festival: "🎪",
  gastronomia: "🍽️", compras: "🛍️", noite: "🍸", exposicao: "🖼️", trilha: "🥾", esporte: "⚽"
};
