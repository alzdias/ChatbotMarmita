/**
 * agent.js - Orquestrador do Agente de IA com Mock Engine e Provedores Externos
 * 
 * Implementa:
 * - Mock Engine offline robusto (interpreta linguagem natural sem gastar tokens ou exigir chaves de API)
 * - Integração direta via fetch com Gemini, OpenAI e Groq caso o usuário configure sua chave no navegador
 * - Fallback inteligente e tratamento de erro
 */

import { SYSTEM_PROMPT, buildAgentContext } from "./prompts.js";
import { SecurityGuardrails } from "./validators.js";
import { PricingEngine } from "./pricing.js";

export class AgentService {
  constructor(menuService, cartService, config) {
    this.menuService = menuService;
    this.cartService = cartService;
    this.config = config;
    this.conversationHistory = [];
  }

  /**
   * Ponto de entrada para processamento da mensagem do usuário
   */
  async processMessage(userMessage, provider = "mock", apiKey = "", modelName = "") {
    // 1. Guardrail primário de segurança
    const securityCheck = SecurityGuardrails.inspectUserInput(userMessage);
    if (securityCheck.isSuspicious) {
      return {
        speech: `Notei uma mensagem atípica ou comando não autorizado. Por favor, lembre-se de que sou o atendente virtual da Marmitaria e posso te ajudar apenas com a escolha e pedido das nossas deliciosas marmitas! Como posso ajudar você no cardápio de hoje?`,
        actionResult: null,
        securityBlocked: true,
        reason: securityCheck.reason
      };
    }

    // 2. Registrar histórico
    this.conversationHistory.push({ role: "user", content: userMessage });

    let rawResponse = null;

    try {
      if (provider === "mock" || !apiKey) {
        // Motor inteligente local determinístico/regex de PLN
        rawResponse = await this._processWithMockEngine(userMessage);
      } else if (provider === "gemini") {
        rawResponse = await this._callGeminiAPI(userMessage, apiKey, modelName || this.config.DEFAULT_MODEL.gemini);
      } else if (provider === "openai") {
        rawResponse = await this._callOpenAIAPI(userMessage, apiKey, modelName || this.config.DEFAULT_MODEL.openai);
      } else if (provider === "groq") {
        rawResponse = await this._callGroqAPI(userMessage, apiKey, modelName || this.config.DEFAULT_MODEL.groq);
      } else {
        rawResponse = await this._processWithMockEngine(userMessage);
      }
    } catch (apiError) {
      console.warn("Falha ao comunicar com API externa de LLM, acionando Mock Engine de contingência:", apiError);
      rawResponse = await this._processWithMockEngine(userMessage);
      rawResponse.speech = `(Modo Contingência Offline) ${rawResponse.speech}`;
    }

    // 3. Execução das ações determinísticas validadas fora do LLM
    const executionResult = this._executeAction(rawResponse.action, rawResponse.speech);

    // 4. Salva resposta no histórico
    this.conversationHistory.push({ role: "assistant", content: executionResult.speech });

    return executionResult;
  }

  /**
   * Executa a ação sugerida pelo LLM de maneira 100% segura e determinística
   */
  _executeAction(action, llmSpeech) {
    if (!action || action.type === "CHAT_ONLY") {
      return { speech: llmSpeech, actionExecuted: null, status: "OK" };
    }

    // Valida guardrail de ação estruturada
    const validation = SecurityGuardrails.validateLLMAction(action, this.menuService);
    if (!validation.valid) {
      return {
        speech: `${llmSpeech}\n\n⚠️ Observação: Não consegui processar a alteração solicitada pois: ${validation.error}`,
        actionExecuted: null,
        status: "VALIDATION_FAILED"
      };
    }

    let actionFeedback = "";
    switch (action.type) {
      case "ADD_ITEM": {
        const prod = action.productId ? this.menuService.findById(action.productId) : this.menuService.findByQuery(action.productName);
        const res = this.cartService.addItem(prod, action.quantity || 1, action.customization || {});
        actionFeedback = res.message;
        break;
      }

      case "REMOVE_ITEM": {
        const prod = action.productId ? this.menuService.findById(action.productId) : this.menuService.findByQuery(action.productName);
        const res = this.cartService.removeItem(prod || action.productName);
        actionFeedback = res.message;
        break;
      }

      case "UPDATE_QUANTITY": {
        const prod = action.productId ? this.menuService.findById(action.productId) : this.menuService.findByQuery(action.productName);
        const res = this.cartService.updateQuantity(prod || action.productName, action.quantity);
        actionFeedback = res.message;
        break;
      }

      case "SET_DELIVERY_ADDRESS": {
        const res = this.cartService.setDeliveryAddress(action.deliveryAddress);
        actionFeedback = res.message;
        break;
      }

      case "CONFIRM_ORDER": {
        const res = this.cartService.confirmOrder();
        actionFeedback = res.message;
        break;
      }

      case "CANCEL_ORDER": {
        const res = this.cartService.cancelOrder();
        actionFeedback = res.message;
        break;
      }

      case "CLEAR_CART": {
        this.cartService.clear();
        actionFeedback = "Carrinho esvaziado com sucesso.";
        break;
      }

      case "QUERY_MENU":
      case "QUERY_STATUS":
        break;
    }

    return {
      speech: llmSpeech,
      actionFeedback,
      actionExecuted: action.type,
      status: "SUCCESS"
    };
  }

  /**
   * Mock Engine: Parser de Linguagem Natural local de alta precisão
   */
  async _processWithMockEngine(text) {
    const norm = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    const cartSummary = this.cartService.getSummary();

    // 1. Saudação
    if (/^(ola|oi|opa|boa tarde|bom dia|boa noite|e ai)/i.test(norm) && norm.length < 25) {
      return {
        speech: "Olá! Seja muito bem-vindo à Marmitaria Sabor & Arte! 🍲\nHoje temos opções deliciosas e preparadas na hora. Deseja conhecer o cardápio do dia?",
        action: { type: "CHAT_ONLY" }
      };
    }

    // 2. Consulta de Cardápio
    if (norm.includes("cardapio") || norm.includes("opcoes") || norm.includes("o que tem") || norm.includes("quais marmitas") || norm.includes("menu")) {
      const available = this.menuService.getAvailableItems();
      const list = available.map(i => `• ${i.name} (R$ ${i.price.toFixed(2)}): ${i.description}`).join("\n\n");
      return {
        speech: `Nosso cardápio fresquinho de hoje conta com as seguintes opções:\n\n${list}\n\nQual delas você gostaria de experimentar? Você pode pedir pelo nome e também personalizar ingredientes!`,
        action: { type: "QUERY_MENU" }
      };
    }

    // 3. Consulta de Total / Subtotal
    if (norm.includes("quanto fico") || norm.includes("valor total") || norm.includes("subtotal") || norm.includes("resumo")) {
      if (cartSummary.items.length === 0) {
        return {
          speech: "Seu carrinho está vazio no momento. Que tal escolher uma das nossas deliciosas marmitas do cardápio?",
          action: { type: "CHAT_ONLY" }
        };
      }
      return {
        speech: `Seu pedido até agora está assim:\n- Subtotal dos itens: ${cartSummary.formattedSubtotal}\n- Taxa de entrega: ${cartSummary.formattedDeliveryFee}\n- Total geral: ${cartSummary.formattedTotal}\n\nPodemos prosseguir com o endereço de entrega ou quer adicionar algo mais?`,
        action: { type: "QUERY_STATUS" }
      };
    }

    // 4. Cancelamento ou Limpar carrinho
    if (norm.includes("cancelar pedido") || norm.includes("esvaziar carrinho") || norm.includes("limpar pedido")) {
      return {
        speech: "Prontinho! Seu pedido e carrinho foram cancelados e limpos. Se precisar de algo novo, é só me chamar!",
        action: { type: "CANCEL_ORDER" }
      };
    }

    // 5. Confirmação do pedido
    if (norm.includes("confirmar") || norm.includes("fechar pedido") || norm.includes("pode fechar") || norm.includes("pode enviar") || norm.includes("concluir pedido")) {
      if (cartSummary.items.length === 0) {
        return {
          speech: "Seu carrinho ainda está vazio! Adicione ao menos uma marmita antes de confirmarmos.",
          action: { type: "CHAT_ONLY" }
        };
      }
      if (!cartSummary.deliveryAddress) {
        return {
          speech: `O subtotal dos seus pratos é ${cartSummary.formattedSubtotal}. Para onde devemos entregar? Por favor, digite seu endereço completo (rua, número e bairro).`,
          action: { type: "CHAT_ONLY" }
        };
      }
      return {
        speech: `Perfeito! Seu pedido foi confirmado e já está sendo preparado com muito carinho pela nossa cozinha. O total ficou em ${cartSummary.formattedTotal} com entrega para: ${cartSummary.deliveryAddress}. Obrigado pela preferência!`,
        action: { type: "CONFIRM_ORDER" }
      };
    }

    // 6. Detecção de Endereço de entrega
    if (norm.includes("rua") || norm.includes("av.") || norm.includes("avenida") || norm.includes("bairro") || norm.includes("entrega em") || norm.includes("moro em") || norm.includes("entregar na")) {
      let rawAddress = text;
      // Limpeza de prefixos comuns
      rawAddress = rawAddress.replace(/^(por favor entregar na|entregar na|entregar no|entrega em|moro na|moro no|moro em)/i, "").trim();
      return {
        speech: `Entendido! Registrei o endereço: "${rawAddress}". O sistema calculou a taxa de entrega. Deseja conferir o resumo e confirmar o pedido?`,
        action: {
          type: "SET_DELIVERY_ADDRESS",
          deliveryAddress: rawAddress
        }
      };
    }

    // 7. Remoção de itens
    if (norm.includes("retire") || norm.includes("remover") || norm.includes("tirar") || norm.includes("tira a") || norm.includes("retira uma")) {
      const matchedItem = this.menuService.findByQuery(text);
      if (matchedItem) {
        return {
          speech: `Certo! Removi "${matchedItem.name}" do seu pedido.`,
          action: {
            type: "REMOVE_ITEM",
            productId: matchedItem.id
          }
        };
      }
    }

    // 8. "Quero uma de cada"
    if (norm.includes("uma de cada") || norm.includes("um de cada")) {
      const avail = this.menuService.getAvailableItems();
      for (const it of avail) {
        this.cartService.addItem(it, 1);
      }
      return {
        speech: `Com certeza! Adicionei 1 unidade de cada uma das nossas marmitas disponíveis hoje (${avail.map(i => i.name).join(", ")}). Ficou um banquete!`,
        action: { type: "CHAT_ONLY" }
      };
    }

    // 9. Adição de Produto com Personalizações por Linguagem Natural
    const matchedItem = this.menuService.findByQuery(text);
    if (matchedItem) {
      if (!matchedItem.available) {
        return {
          speech: `Ah, sinto muito! A "${matchedItem.name}" fez tanto sucesso que já esgotou hoje. Que tal experimentar nossa suculenta Marmita de Bife Acebolado ou a leve Marmita de Frango Grelhado?`,
          action: { type: "CHAT_ONLY" }
        };
      }

      // Extração de quantidade
      let quantity = 1;
      const qtyMatch = text.match(/\b(uma|um|duas|dois|tres|quatro|cinco|\d+)\b/i);
      if (qtyMatch) {
        const val = qtyMatch[1].toLowerCase();
        if (val === "um" || val === "uma") quantity = 1;
        else if (val === "dois" || val === "duas") quantity = 2;
        else if (val === "tres") quantity = 3;
        else if (val === "quatro") quantity = 4;
        else if (val === "cinco") quantity = 5;
        else quantity = parseInt(val, 10) || 1;
      }

      // Extração de remoção de ingredientes
      const removedIngredients = [];
      if (norm.includes("sem cebola") || norm.includes("retirar cebola") || norm.includes("sem a cebola")) removedIngredients.push("cebola");
      if (norm.includes("sem alho") || norm.includes("retirar alho")) removedIngredients.push("alho");
      if (norm.includes("sem farofa") || norm.includes("retirar farofa")) removedIngredients.push("farofa de milho");
      if (norm.includes("sem legumes") || norm.includes("retirar legumes")) removedIngredients.push("legumes");
      if (norm.includes("sem arroz")) removedIngredients.push("arroz");
      if (norm.includes("sem feijao")) removedIngredients.push("feijao");

      // Ponto da carne
      let cookingPoint = null;
      if (norm.includes("bem passada") || norm.includes("bem passado")) cookingPoint = "bem passado";
      else if (norm.includes("ao ponto")) cookingPoint = "ao ponto";
      else if (norm.includes("mal passada") || norm.includes("mal passado")) cookingPoint = "malpassado";

      // Nível de pimenta
      let spiceLevel = null;
      if (norm.includes("sem pimenta")) spiceLevel = "sem pimenta";
      else if (norm.includes("pouca pimenta")) spiceLevel = "pouca pimenta";
      else if (norm.includes("com pimenta") || norm.includes("bem apimentada")) spiceLevel = "com pimenta";

      const customParts = [];
      if (removedIngredients.length) customParts.push(`sem ${removedIngredients.join(", ")}`);
      if (cookingPoint) customParts.push(`ponto: ${cookingPoint}`);
      if (spiceLevel) customParts.push(spiceLevel);

      const customText = customParts.length > 0 ? ` (${customParts.join(" e ")})` : "";

      return {
        speech: `Excelente escolha! Adicionei ${quantity}x "${matchedItem.name}"${customText} ao seu carrinho por R$ ${(matchedItem.price * quantity).toFixed(2)}. Gostaria de mais alguma marmita ou podemos informar o endereço para entrega?`,
        action: {
          type: "ADD_ITEM",
          productId: matchedItem.id,
          quantity: quantity,
          customization: {
            removedIngredients,
            cookingPoint,
            spiceLevel
          }
        }
      };
    }

    // 10. Fallback cordial de não entendimento
    return {
      speech: `Não compreendi perfeitamente seu pedido. Você gostaria de ver nosso cardápio de marmitas, adicionar algum prato ou consultar o valor do seu carrinho?`,
      action: { type: "CHAT_ONLY" }
    };
  }

  /**
   * Chamada à API do Google Gemini (Direct Client-Side)
   */
  async _callGeminiAPI(userMessage, apiKey, modelName) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const dynamicContext = buildAgentContext(this.menuService.getAll(), this.cartService.getSummary());

    const payload = {
      system_instruction: {
        parts: [{ text: `${SYSTEM_PROMPT}\n\n${dynamicContext}` }]
      },
      contents: [
        ...this.conversationHistory.slice(-6).map(h => ({
          role: h.role === "assistant" ? "model" : "user",
          parts: [{ text: h.content }]
        }))
      ],
      generationConfig: {
        response_mime_type: "application/json",
        temperature: 0.2
      }
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) throw new Error("Resposta vazia da API do Gemini.");

    return JSON.parse(candidateText);
  }

  /**
   * Chamada à API OpenAI
   */
  async _callOpenAIAPI(userMessage, apiKey, modelName) {
    const endpoint = "https://api.openai.com/v1/chat/completions";
    const dynamicContext = buildAgentContext(this.menuService.getAll(), this.cartService.getSummary());

    const messages = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\n${dynamicContext}` },
      ...this.conversationHistory.slice(-6).map(h => ({
        role: h.role,
        content: h.content
      }))
    ];

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return JSON.parse(content);
  }

  /**
   * Chamada à API Groq (Llama / Mixtral com altíssima velocidade)
   */
  async _callGroqAPI(userMessage, apiKey, modelName) {
    const endpoint = "https://api.groq.com/openai/v1/chat/completions";
    const dynamicContext = buildAgentContext(this.menuService.getAll(), this.cartService.getSummary());

    const messages = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\n${dynamicContext}` },
      ...this.conversationHistory.slice(-6).map(h => ({
        role: h.role,
        content: h.content
      }))
    ];

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return JSON.parse(content);
  }
}
