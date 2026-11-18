/**
 * validators.js - Guardrails de Segurança e Validações Rígidas
 * 
 * Protege contra:
 * - Prompt Injection e Jailbreak
 * - Manipulação de preços
 * - Tentativas de bypass de estado comercial
 * - Sanitização de entradas do usuário
 */

export class SecurityGuardrails {
  // Padrões de prompt injection conhecidos
  static INJECTION_PATTERNS = [
    /ignore (all|previous|the above) (instructions|directions|rules)/i,
    /esqueça (todas|as) (instruções|regras|diretrizes)/i,
    /desconsidere (todas|as) (instruções|regras)/i,
    /you are now in developer mode/i,
    /você agora é um/i,
    /now act as a/i,
    /system prompt/i,
    /show me your prompt/i,
    /mostre seu prompt/i,
    /revela tuas instruções/i,
    /override (price|discount|rule)/i,
    /alterar preço/i,
    /desconto de 100%/i,
    /grátis tudo/i,
    /modo dan/i,
    /dan mode/i
  ];

  /**
   * Avalia se a entrada do usuário contém tentativa hostil de prompt injection
   */
  static inspectUserInput(text) {
    if (!text || typeof text !== "string") {
      return { isSuspicious: false, reason: null };
    }

    const trimmed = text.trim();

    for (const pattern of this.INJECTION_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          isSuspicious: true,
          pattern: pattern.toString(),
          reason: "Tentativa de injeção de prompt ou alteração indevida de instruções detectada."
        };
      }
    }

    // Limite razoável de tamanho de caractere para evitar DoS por tokens
    if (trimmed.length > 600) {
      return {
        isSuspicious: true,
        reason: "Mensagem excede o limite máximo permitido de caracteres."
      };
    }

    return { isSuspicious: false, reason: null };
  }

  /**
   * Sanitiza strings contra XSS ao renderizar no DOM
   */
  static sanitizeHTML(str) {
    if (!str || typeof str !== "string") return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Valida estritamente se o payload de ação gerado pelo LLM é seguro e condiz com o cardápio oficial.
   * NUNCA aceita preços vindos do LLM! O preço é SEMPRE puxado da fonte da verdade (menuService).
   */
  static validateLLMAction(action, menuService) {
    if (!action || typeof action !== "object") {
      return { valid: false, error: "Ação estruturada ausente ou inválida." };
    }

    const allowedTypes = [
      "ADD_ITEM",
      "REMOVE_ITEM",
      "UPDATE_QUANTITY",
      "SET_DELIVERY_ADDRESS",
      "CONFIRM_ORDER",
      "CANCEL_ORDER",
      "QUERY_MENU",
      "QUERY_STATUS",
      "CLEAR_CART",
      "CHAT_ONLY"
    ];

    if (!allowedTypes.includes(action.type)) {
      return { valid: false, error: `Tipo de ação desconhecido: ${action.type}` };
    }

    // Se for ação que manipula item, validar existência no cardápio oficial
    if (["ADD_ITEM", "REMOVE_ITEM", "UPDATE_QUANTITY"].includes(action.type)) {
      if (!action.productId && !action.productName) {
        return { valid: false, error: "Produto não especificado na ação." };
      }

      const item = action.productId 
        ? menuService.findById(action.productId) 
        : menuService.findByQuery(action.productName);

      if (!item) {
        return { 
          valid: false, 
          error: `Produto "${action.productName || action.productId}" não existe no cardápio oficial.` 
        };
      }

      if (action.type === "ADD_ITEM" && !item.available) {
        return { 
          valid: false, 
          error: `O produto "${item.name}" está indisponível hoje no cardápio.` 
        };
      }

      // Validar quantidade numérica inteira
      if (action.quantity !== undefined) {
        const qty = parseInt(action.quantity, 10);
        if (isNaN(qty) || qty <= 0 || qty > 50) {
          return { valid: false, error: "Quantidade inválida ou fora dos limites permitidos (1 a 50)." };
        }
      }

      // Validação de customização se presente
      if (action.customization) {
        const customCheck = menuService.validateCustomization(item, action.customization);
        if (!customCheck.valid) {
          return { valid: false, error: customCheck.errors.join(" ") };
        }
      }
    }

    return { valid: true, error: null };
  }
}
