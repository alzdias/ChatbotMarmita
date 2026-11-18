/**
 * config.js - Configurações centrais da aplicação
 * 
 * NOTA DE SEGURANÇA E ARQUITETURA:
 * A aplicação é 100% client-side (sem backend próprio).
 * Chaves de API de provedores como OpenAI/Gemini/Groq NUNCA devem ser fixadas em código público (hardcoded).
 * Permitimos que o usuário insira sua API Key em tempo de execução via interface (armazenada apenas em sessionStorage/localStorage do navegador)
 * OU utilize o Mock Engine integrado (modo offline inteligente) que opera sem necessidade de chave externa.
 */

export const CONFIG = {
  APP_NAME: "Marmitaria Sabor & Arte",
  APP_SLOGAN: "Marmitas caseiras fresquinhas todos os dias",
  CURRENCY: "BRL",
  LOCALE: "pt-BR",
  
  // Taxa de entrega determinística baseada em bairros/zonas
  DELIVERY_RULES: {
    DEFAULT_FEE: 7.00,
    FREE_SHIPPING_MIN_VALUE: 90.00, // Frete grátis acima de R$ 90
    ZONES: [
      { name: "Centro", fee: 5.00, minTimeMin: 20, maxTimeMin: 35 },
      { name: "Zona Sul", fee: 7.00, minTimeMin: 30, maxTimeMin: 45 },
      { name: "Zona Norte", fee: 9.00, minTimeMin: 35, maxTimeMin: 50 },
      { name: "Zona Leste", fee: 10.00, minTimeMin: 40, maxTimeMin: 55 },
      { name: "Zona Oeste", fee: 8.50, minTimeMin: 30, maxTimeMin: 45 },
      { name: "Outros Bairros", fee: 12.00, minTimeMin: 45, maxTimeMin: 60 }
    ]
  },

  // Provedores LLM suportados diretamente do navegador
  LLM_PROVIDERS: {
    MOCK: "mock",
    GEMINI: "gemini",
    OPENAI: "openai",
    GROQ: "groq"
  },

  // Defaults
  DEFAULT_PROVIDER: "mock",
  DEFAULT_MODEL: {
    gemini: "gemini-1.5-flash",
    openai: "gpt-4o-mini",
    groq: "llama-3.3-70b-versatile"
  },

  STORAGE_KEYS: {
    API_KEY: "marmita_bot_api_key",
    PROVIDER: "marmita_bot_provider",
    MODEL: "marmita_bot_model"
  }
};
