/**
 * app.js - Inicializador da Aplicação e Configurações de Conexão com LLM
 */

import { CONFIG } from "./config.js";
import { MenuService } from "./menu.js";
import { DeliveryService } from "./delivery.js";
import { CartService } from "./cart.js";
import { AgentService } from "./agent.js";
import { ChatUI } from "./chat.js";

class MarmitaApp {
  constructor() {
    this.menuService = new MenuService();
    this.deliveryService = new DeliveryService();
    this.cartService = new CartService(this.menuService, this.deliveryService);
    this.agentService = new AgentService(this.menuService, this.cartService, CONFIG);

    this.currentProvider = localStorage.getItem(CONFIG.STORAGE_KEYS.PROVIDER) || CONFIG.DEFAULT_PROVIDER;
    this.apiKey = sessionStorage.getItem(CONFIG.STORAGE_KEYS.API_KEY) || "";
    this.currentModel = localStorage.getItem(CONFIG.STORAGE_KEYS.MODEL) || CONFIG.DEFAULT_MODEL[this.currentProvider] || "";

    this.chatUI = null;
  }

  init() {
    this.chatUI = new ChatUI(
      this.cartService,
      this.menuService,
      (userText) => this.handleUserMessage(userText)
    );

    this._setupSettingsModal();
    this._setupMobileTabs();

    // Mensagem de boas-vindas inicial do SaborBot
    setTimeout(() => {
      this.chatUI.appendMessage(
        "assistant",
        "Olá! Seja muito bem-vindo à Marmitaria Sabor & Arte! 🍲\nEu sou o SaborBot, seu atendente virtual. Como posso ajudar você hoje? Deseja dar uma olhadinha no nosso cardápio do dia?"
      );
    }, 400);

    // Renderiza estado inicial do carrinho
    this.chatUI.renderCart(this.cartService.getSummary());
  }

  async handleUserMessage(userText) {
    this.chatUI.setTyping(true);

    try {
      const response = await this.agentService.processMessage(
        userText,
        this.currentProvider,
        this.apiKey,
        this.currentModel
      );

      this.chatUI.setTyping(false);

      const meta = {};
      if (response.status === "VALIDATION_FAILED") {
        meta.badge = "Ação rejeitada por Guardrail de Segurança";
      } else if (response.securityBlocked) {
        meta.badge = "Aviso de Segurança";
      }

      this.chatUI.appendMessage("assistant", response.speech, meta);
    } catch (err) {
      this.chatUI.setTyping(false);
      console.error("Erro no processamento da mensagem:", err);
      this.chatUI.appendMessage(
        "assistant",
        "Desculpe, ocorreu uma instabilidade temporária no processamento da mensagem. Pode tentar novamente?"
      );
    }
  }

  _setupSettingsModal() {
    const settingsBtn = document.getElementById("btn-open-settings");
    const settingsModal = document.getElementById("settings-modal");
    const closeBtn = document.getElementById("btn-close-modal");
    const saveBtn = document.getElementById("btn-save-settings");
    const providerSelect = document.getElementById("provider-select");
    const apiKeyInput = document.getElementById("api-key-input");
    const apiKeyContainer = document.getElementById("api-key-container");
    const providerBadge = document.getElementById("active-provider-badge");

    const updateBadge = () => {
      const names = {
        mock: "Modo Local Offline (Mock Engine)",
        gemini: "Google Gemini API",
        openai: "OpenAI GPT-4o-mini",
        groq: "Groq Llama-3.3"
      };
      if (providerBadge) {
        providerBadge.textContent = names[this.currentProvider] || this.currentProvider;
      }
    };
    updateBadge();

    if (providerSelect) {
      providerSelect.value = this.currentProvider;
      if (apiKeyInput) apiKeyInput.value = this.apiKey;
      if (apiKeyContainer) {
        apiKeyContainer.style.display = this.currentProvider === "mock" ? "none" : "block";
      }

      providerSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        if (apiKeyContainer) {
          apiKeyContainer.style.display = val === "mock" ? "none" : "block";
        }
      });
    }

    if (settingsBtn && settingsModal) {
      settingsBtn.addEventListener("click", () => {
        settingsModal.classList.add("modal-open");
      });
    }

    if (closeBtn && settingsModal) {
      closeBtn.addEventListener("click", () => {
        settingsModal.classList.remove("modal-open");
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener("click", () => {
        this.currentProvider = providerSelect.value;
        this.apiKey = apiKeyInput ? apiKeyInput.value.trim() : "";
        
        localStorage.setItem(CONFIG.STORAGE_KEYS.PROVIDER, this.currentProvider);
        if (this.apiKey) {
          sessionStorage.setItem(CONFIG.STORAGE_KEYS.API_KEY, this.apiKey);
        } else {
          sessionStorage.removeItem(CONFIG.STORAGE_KEYS.API_KEY);
        }

        updateBadge();
        if (settingsModal) settingsModal.classList.remove("modal-open");
        alert("Configurações salvas com sucesso!");
      });
    }
  }

  _setupMobileTabs() {
    const tabBtns = document.querySelectorAll(".mobile-tab-btn");
    const mainPanels = {
      chat: document.getElementById("panel-chat"),
      cart: document.getElementById("panel-cart"),
      menu: document.getElementById("panel-menu")
    };

    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        tabBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const target = btn.getAttribute("data-tab");
        Object.keys(mainPanels).forEach(key => {
          if (mainPanels[key]) {
            if (key === target) {
              mainPanels[key].classList.add("active-panel");
            } else {
              mainPanels[key].classList.remove("active-panel");
            }
          }
        });
      });
    });
  }
}

// Inicialização após o DOM carregar
window.addEventListener("DOMContentLoaded", () => {
  const app = new MarmitaApp();
  app.init();
  window.marmitaApp = app; // Exposição para fins de depuração e inspeção
});
