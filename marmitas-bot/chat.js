/**
 * chat.js - Gerenciador da Interface Conversacional e Painel do Carrinho
 */

import { SecurityGuardrails } from "./validators.js";

export class ChatUI {
  constructor(cartService, menuService, onSendMessage) {
    this.cartService = cartService;
    this.menuService = menuService;
    this.onSendMessage = onSendMessage;

    // Elementos DOM
    this.messagesContainer = document.getElementById("chat-messages");
    this.chatInput = document.getElementById("chat-input");
    this.sendBtn = document.getElementById("send-btn");
    this.typingIndicator = document.getElementById("typing-indicator");
    this.cartItemsList = document.getElementById("cart-items-list");
    this.cartSubtotal = document.getElementById("cart-subtotal");
    this.cartDelivery = document.getElementById("cart-delivery");
    this.cartTotal = document.getElementById("cart-total");
    this.cartBadge = document.getElementById("cart-badge");
    this.deliveryAddressDisplay = document.getElementById("delivery-address-display");
    this.orderStatusBadge = document.getElementById("order-status-badge");
    this.menuPreviewList = document.getElementById("menu-preview-list");

    this._setupEvents();
    this._renderMenuPreview();
  }

  _setupEvents() {
    this.sendBtn.addEventListener("click", () => this._handleSend());

    this.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this._handleSend();
      }
    });

    // Ouvinte reativo do carrinho de compras
    this.cartService.subscribe((summary) => {
      this.renderCart(summary);
    });

    // Botões de sugestão rápida (Quick Prompts)
    document.querySelectorAll(".quick-chip").forEach(chip => {
      chip.addEventListener("click", (e) => {
        const promptText = e.target.getAttribute("data-prompt") || e.target.textContent;
        this.chatInput.value = promptText;
        this._handleSend();
      });
    });
  }

  _handleSend() {
    const text = this.chatInput.value.trim();
    if (!text) return;

    this.chatInput.value = "";
    this.chatInput.style.height = "auto";

    // Adiciona mensagem do usuário na tela
    this.appendMessage("user", text);

    // Notifica controlador do App
    if (this.onSendMessage) {
      this.onSendMessage(text);
    }
  }

  setTyping(isTyping) {
    if (this.typingIndicator) {
      this.typingIndicator.style.display = isTyping ? "flex" : "none";
      if (isTyping) {
        this.scrollToBottom();
      }
    }
  }

  appendMessage(role, text, meta = {}) {
    const messageEl = document.createElement("div");
    messageEl.className = `message message-${role}`;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const isBot = role === "assistant";

    const avatar = isBot 
      ? `<div class="avatar avatar-bot">🍲</div>` 
      : `<div class="avatar avatar-user">👤</div>`;

    const sanitizedContent = SecurityGuardrails.sanitizeHTML(text).replace(/\n/g, "<br>");

    messageEl.innerHTML = `
      ${avatar}
      <div class="message-bubble">
        <div class="message-sender">${isBot ? "SaborBot" : "Você"} <span class="message-time">${time}</span></div>
        <div class="message-text">${sanitizedContent}</div>
        ${meta.badge ? `<div class="message-badge">${SecurityGuardrails.sanitizeHTML(meta.badge)}</div>` : ""}
      </div>
    `;

    this.messagesContainer.appendChild(messageEl);
    this.scrollToBottom();
  }

  scrollToBottom() {
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  /**
   * Renderiza a listagem visual do cardápio na aba lateral
   */
  _renderMenuPreview() {
    if (!this.menuPreviewList) return;
    const items = this.menuService.getAll();

    this.menuPreviewList.innerHTML = items.map(item => {
      const availBadge = item.available 
        ? `<span class="badge badge-success">Disponível</span>`
        : `<span class="badge badge-danger">Esgotado</span>`;

      return `
        <div class="menu-card ${!item.available ? 'item-unavailable' : ''}">
          <div class="menu-card-header">
            <h4 class="menu-card-title">${item.name}</h4>
            <span class="menu-card-price">R$ ${item.price.toFixed(2)}</span>
          </div>
          <p class="menu-card-desc">${item.description}</p>
          <div class="menu-card-footer">
            ${availBadge}
            <button class="btn-quick-add" data-item-id="${item.id}" ${!item.available ? 'disabled' : ''}>
              ${item.available ? 'Pedir no Chat' : 'Indisponível'}
            </button>
          </div>
        </div>
      `;
    }).join("");

    this.menuPreviewList.querySelectorAll(".btn-quick-add").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.target.getAttribute("data-item-id");
        const item = this.menuService.findById(id);
        if (item && item.available) {
          this.chatInput.value = `Quero pedir 1x ${item.name}`;
          this._handleSend();
        }
      });
    });
  }

  /**
   * Renderiza o carrinho atualizado em tempo real
   */
  renderCart(summary) {
    if (this.cartBadge) {
      this.cartBadge.textContent = summary.totalItems;
      this.cartBadge.style.display = summary.totalItems > 0 ? "inline-block" : "none";
    }

    if (this.cartSubtotal) this.cartSubtotal.textContent = summary.formattedSubtotal;
    if (this.cartDelivery) this.cartDelivery.textContent = summary.formattedDeliveryFee;
    if (this.cartTotal) this.cartTotal.textContent = summary.formattedTotal;

    if (this.orderStatusBadge) {
      const statusMap = {
        DRAFT: { text: "Montando Pedido", class: "status-draft" },
        CONFIRMED: { text: "Pedido Confirmado! 🎉", class: "status-confirmed" },
        CANCELLED: { text: "Cancelado", class: "status-cancelled" }
      };
      const st = statusMap[summary.orderStatus] || statusMap.DRAFT;
      this.orderStatusBadge.textContent = st.text;
      this.orderStatusBadge.className = `order-badge ${st.class}`;
    }

    if (this.deliveryAddressDisplay) {
      if (summary.deliveryAddress) {
        this.deliveryAddressDisplay.innerHTML = `
          <strong>📍 Entrega:</strong> ${SecurityGuardrails.sanitizeHTML(summary.deliveryAddress)}
          <br><small class="text-muted">(${summary.deliveryInfo?.estimatedTime || 'Estimativa: 30 a 45 min'})</small>
        `;
      } else {
        this.deliveryAddressDisplay.innerHTML = `<em>📍 Nenhum endereço informado ainda.</em>`;
      }
    }

    if (!this.cartItemsList) return;

    if (summary.items.length === 0) {
      this.cartItemsList.innerHTML = `
        <div class="empty-cart-state">
          <div class="empty-cart-icon">🛒</div>
          <p>Seu carrinho está vazio.</p>
          <small>Peça marmitas digitando no chat!</small>
        </div>
      `;
      return;
    }

    this.cartItemsList.innerHTML = summary.items.map(item => {
      const customPills = [];
      if (item.customization.removedIngredients?.length) {
        customPills.push(`<span class="custom-pill pill-remove">Sem: ${item.customization.removedIngredients.join(", ")}</span>`);
      }
      if (item.customization.cookingPoint) {
        customPills.push(`<span class="custom-pill pill-point">Ponto: ${item.customization.cookingPoint}</span>`);
      }
      if (item.customization.spiceLevel) {
        customPills.push(`<span class="custom-pill pill-spice">Pimenta: ${item.customization.spiceLevel}</span>`);
      }

      return `
        <div class="cart-item-row">
          <div class="cart-item-info">
            <span class="cart-item-name">${item.name}</span>
            <span class="cart-item-unit">R$ ${item.unitPrice.toFixed(2)} un</span>
            <div class="cart-item-customs">${customPills.join(" ")}</div>
          </div>
          <div class="cart-item-actions">
            <div class="qty-control">
              <button class="btn-qty btn-minus" data-id="${item.cartItemId}">-</button>
              <span class="qty-num">${item.quantity}</span>
              <button class="btn-qty btn-plus" data-id="${item.cartItemId}">+</button>
            </div>
            <span class="cart-item-subtotal">R$ ${item.subtotal.toFixed(2)}</span>
            <button class="btn-remove-item" data-id="${item.cartItemId}" title="Remover item">🗑️</button>
          </div>
        </div>
      `;
    }).join("");

    // Adiciona listeners para os botões do carrinho
    this.cartItemsList.querySelectorAll(".btn-plus").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const found = summary.items.find(i => i.cartItemId === id);
        if (found) this.cartService.updateQuantity(id, found.quantity + 1);
      });
    });

    this.cartItemsList.querySelectorAll(".btn-minus").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const found = summary.items.find(i => i.cartItemId === id);
        if (found) this.cartService.updateQuantity(id, found.quantity - 1);
      });
    });

    this.cartItemsList.querySelectorAll(".btn-remove-item").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.cartService.removeItem(id);
      });
    });
  }
}
