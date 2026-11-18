/**
 * menu.js - Gestão e catálogo determinístico do Cardápio
 * 
 * Fonte da verdade de itens, ingredientes, preços e limites de personalização.
 * O LLM não pode inventar preços nem itens fora desta lista.
 */

export const MENU_ITEMS = [
  {
    id: "marmita-bife-acebolado",
    name: "Marmita de Bife Acebolado",
    category: "Carnes",
    price: 28.90,
    available: true,
    description: "Suculento bife de alcatra acebolado, arroz branco soltinho, feijão carioca caseiro e farofa de milho.",
    ingredients: [
      { name: "cebola", removable: true, defaultIncluded: true },
      { name: "alho", removable: true, defaultIncluded: true },
      { name: "farofa de milho", removable: true, defaultIncluded: true },
      { name: "feijao", removable: true, defaultIncluded: true },
      { name: "arroz", removable: true, defaultIncluded: true }
    ],
    customizationOptions: {
      meatCookingPoints: ["malpassado", "ao ponto", "bem passado"],
      defaultCookingPoint: "ao ponto",
      spiceLevels: ["sem pimenta", "pouca pimenta", "com pimenta"],
      defaultSpiceLevel: "pouca pimenta"
    },
    aliases: [
      "bife acebolado",
      "bife",
      "carne acebolada",
      "marmita de bife",
      "alcatra acebolada"
    ]
  },
  {
    id: "marmita-frango-grelhado",
    name: "Marmita de Frango Grelhado",
    category: "Aves",
    price: 24.50,
    available: true,
    description: "Filé de peito grelhado com ervas finas, arroz integral, feijão preto e mix de legumes cozidos no vapor.",
    ingredients: [
      { name: "alho", removable: true, defaultIncluded: true },
      { name: "legumes", removable: true, defaultIncluded: true },
      { name: "ervas finas", removable: true, defaultIncluded: true },
      { name: "feijao preto", removable: true, defaultIncluded: true },
      { name: "arroz integral", removable: true, defaultIncluded: true }
    ],
    customizationOptions: {
      spiceLevels: ["sem pimenta", "pouca pimenta", "com pimenta"],
      defaultSpiceLevel: "sem pimenta",
      extraSeasoning: true
    },
    aliases: [
      "frango grelhado",
      "frango",
      "filé de frango",
      "peito de frango",
      "marmita de frango"
    ]
  },
  {
    id: "marmita-feijoada-completa",
    name: "Marmita de Feijoada Tradicional",
    category: "Especiais do Dia",
    price: 32.00,
    available: true,
    description: "Feijoada com carnes nobres (carne seca, lombo, costelinha e paio), arroz, couve refogada e torresmo crocante.",
    ingredients: [
      { name: "couve", removable: true, defaultIncluded: true },
      { name: "torresmo", removable: true, defaultIncluded: true },
      { name: "laranja", removable: true, defaultIncluded: true },
      { name: "alho", removable: true, defaultIncluded: true }
    ],
    customizationOptions: {
      spiceLevels: ["sem pimenta", "pouca pimenta", "bem apimentada"],
      defaultSpiceLevel: "pouca pimenta"
    },
    aliases: [
      "feijoada",
      "feijoada completa",
      "feijuca",
      "marmita de feijoada"
    ]
  },
  {
    id: "marmita-vegetariana-grao-bico",
    name: "Marmita Veggie Estrogonofe de Grão-de-Bico",
    category: "Vegetarianos",
    price: 26.00,
    available: true,
    description: "Estrogonofe cremoso de grão-de-bico com cogumelos frescos, batata palha artesanal e arroz branco.",
    ingredients: [
      { name: "cogumelos", removable: true, defaultIncluded: true },
      { name: "batata palha", removable: true, defaultIncluded: true },
      { name: "alho", removable: true, defaultIncluded: true },
      { name: "cebola", removable: true, defaultIncluded: true }
    ],
    customizationOptions: {
      spiceLevels: ["sem pimenta", "pouca pimenta"],
      defaultSpiceLevel: "sem pimenta"
    },
    aliases: [
      "vegetariana",
      "veggie",
      "estrogonofe de grao de bico",
      "grao de bico",
      "cogumelos",
      "marmita vegana"
    ]
  },
  {
    id: "marmita-parmegiana-carne",
    name: "Marmita Filé à Parmegiana",
    category: "Carnes",
    price: 34.90,
    available: false, // Produto esgotado para testes determinísticos de indisponibilidade
    description: "Filé empanado crocante coberto com molho de tomate caseiro e queijo mussarela gratinado, acompanhado de arroz e purê.",
    ingredients: [
      { name: "queijo", removable: false, defaultIncluded: true },
      { name: "pure", removable: true, defaultIncluded: true },
      { name: "molho", removable: false, defaultIncluded: true }
    ],
    customizationOptions: {},
    aliases: [
      "parmegiana",
      "parmegiana de carne",
      "file parmegiana"
    ]
  }
];

export class MenuService {
  constructor(items = MENU_ITEMS) {
    this.items = items;
  }

  getAll() {
    return this.items;
  }

  getAvailableItems() {
    return this.items.filter(item => item.available);
  }

  findById(id) {
    return this.items.find(item => item.id === id) || null;
  }

  /**
   * Busca determinística por similaridade ou aliases
   */
  findByQuery(query) {
    if (!query || typeof query !== "string") return null;
    const cleanQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    // 1. Match exato por ID
    let found = this.items.find(item => item.id.toLowerCase() === cleanQuery);
    if (found) return found;

    // 2. Match por alias
    found = this.items.find(item => 
      item.aliases.some(alias => {
        const cleanAlias = alias.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return cleanAlias === cleanQuery || cleanQuery.includes(cleanAlias) || cleanAlias.includes(cleanQuery);
      })
    );
    if (found) return found;

    // 3. Match por nome do prato
    found = this.items.find(item => {
      const cleanName = item.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return cleanName.includes(cleanQuery) || cleanQuery.includes(cleanName);
    });

    return found || null;
  }

  /**
   * Valida se a customização de um item é permitida pelas regras do cardápio
   */
  validateCustomization(item, customization = {}) {
    const errors = [];
    const sanitized = {
      removedIngredients: [],
      cookingPoint: null,
      spiceLevel: null,
      notes: ""
    };

    if (!item) {
      return { valid: false, errors: ["Item não identificado."], sanitized: null };
    }

    // Validação de ingredientes removíveis
    if (Array.isArray(customization.removedIngredients)) {
      for (const ingredientName of customization.removedIngredients) {
        const normIng = ingredientName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        const foundIng = item.ingredients.find(ing => {
          const cleanName = ing.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return cleanName.includes(normIng) || normIng.includes(cleanName);
        });

        if (!foundIng) {
          errors.push(`O ingrediente "${ingredientName}" não faz parte da receita da ${item.name}.`);
        } else if (!foundIng.removable) {
          errors.push(`O item "${foundIng.name}" é a base do prato e não pode ser removido.`);
        } else {
          sanitized.removedIngredients.push(foundIng.name);
        }
      }
    }

    // Validação de ponto da carne
    if (customization.cookingPoint) {
      const normPoint = customization.cookingPoint.toLowerCase().trim();
      const validPoints = item.customizationOptions?.meatCookingPoints || [];
      if (validPoints.length === 0) {
        errors.push(`${item.name} não possui opção de ponto de cozimento.`);
      } else if (!validPoints.includes(normPoint)) {
        errors.push(`Ponto "${customization.cookingPoint}" inválido. Opções válidas: ${validPoints.join(", ")}.`);
      } else {
        sanitized.cookingPoint = normPoint;
      }
    }

    // Validação de nível de pimenta
    if (customization.spiceLevel) {
      const normSpice = customization.spiceLevel.toLowerCase().trim();
      const validSpices = item.customizationOptions?.spiceLevels || [];
      if (validSpices.length === 0) {
        errors.push(`${item.name} não possui ajuste de pimenta.`);
      } else if (!validSpices.includes(normSpice)) {
        errors.push(`Ajuste de pimenta "${customization.spiceLevel}" não reconhecido. Opções: ${validSpices.join(", ")}.`);
      } else {
        sanitized.spiceLevel = normSpice;
      }
    }

    if (customization.notes && typeof customization.notes === "string") {
      sanitized.notes = customization.notes.slice(0, 150).trim();
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitized
    };
  }
}
