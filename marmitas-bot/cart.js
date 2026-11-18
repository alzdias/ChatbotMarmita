/**
 * cart.js - Gerenciamento do Estado do Carrinho de Compras
 * 
 * Mantém consistência dos itens, personalizações por unidade,
 * e gera eventos de atualização para a interface e cálculos de preço.
 */

import { PricingEngine } from "./pricing.js";

export class CartService {
  constructor(menuService, deliveryService) {
    this.menuService = menuService;
    this.deliveryService = deliveryService;
    this.items = []; // Array de itens { cartItemId, product, unitPrice, quantity, customization }
    this.deliveryAddress = null;
    this.deliveryInfo = null;
    this.orderStatus = "DRAFT"; // DRAFT, PENDING_CONFIRMATION, CONFIRMED, CANCELLED
    this.listeners = [];
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  notify() {
    const summary = this.getSummary();
    for (const listener of this.listeners) {
      try {
        listener(summary);
      } catch (err) {
        console.error("Erro no ouvinte do carrinho:", err);
      }
    }
  }

  /**
   * Adiciona um item ao carrinho
   */
  addItem(productIdOrQuery, quantity = 1, customization = {}) {
    const product = typeof productIdOrQuery === "object" && productIdOrQuery.id
      ? productIdOrQuery
      : (this.menuService.findById(productIdOrQuery) || this.menuService.findByQuery(productIdOrQuery));

    if (!product) {
      return { success: false, message: `Produto não encontrado no cardápio.` };
    }

    if (!product.available) {
      return { success: false, message: `Desculpe, a "${product.name}" está indisponível hoje.` };
    }

    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    
    // Valida personalizações
    const customResult = this.menuService.validateCustomization(product, customization);
    if (!customResult.valid) {
      return { success: false, message: customResult.errors.join(" ") };
    }

    // Cria ID único para cada variação de customização
    const customKey = JSON.stringify(customResult.sanitized);
    const existing = this.items.find(i => i.product.id === product.id && JSON.stringify(i.customization) === customKey);

    if (existing) {
      existing.quantity += qty;
    } else {
      this.items.push({
        cartItemId: "item_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
        product: {
          id: product.id,
          name: product.name,
          category: product.category,
          description: product.description
        },
        unitPrice: Number(product.price), // Preço SEMPRE vem do cardápio oficial!
        quantity: qty,
        customization: customResult.sanitized
      });
    }

    this.recalculateDelivery();
    this.notify();
    return { success: true, message: `${qty}x "${product.name}" adicionado(s) ao carrinho.` };
  }

  /**
   * Remove item por nome ou ID
   */
  removeItem(productIdOrQuery) {
    const product = this.menuService.findById(productIdOrQuery) || this.menuService.findByQuery(productIdOrQuery);
    const targetId = product ? product.id : productIdOrQuery;

    const initialCount = this.items.length;
    this.items = this.items.filter(item => item.product.id !== targetId && item.cartItemId !== targetId);

    if (this.items.length < initialCount) {
      this.recalculateDelivery();
      this.notify();
      return { success: true, message: `Item removido do seu carrinho com sucesso.` };
    }
    return { success: false, message: `Item não encontrado no carrinho para remoção.` };
  }

  /**
   * Atualiza a quantidade de um item
   */
  updateQuantity(productIdOrQuery, quantity) {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      return this.removeItem(productIdOrQuery);
    }

    const product = this.menuService.findById(productIdOrQuery) || this.menuService.findByQuery(productIdOrQuery);
    const targetId = product ? product.id : productIdOrQuery;

    const item = this.items.find(i => i.product.id === targetId || i.cartItemId === targetId);
    if (!item) {
      return { success: false, message: `Item não encontrado no carrinho.` };
    }

    item.quantity = qty;
    this.recalculateDelivery();
    this.notify();
    return { success: true, message: `Quantidade de "${item.product.name}" alterada para ${qty}.` };
  }

  /**
   * Define o endereço de entrega e recalcula taxa
   */
  setDeliveryAddress(address) {
    if (!address || typeof address !== "string" || address.trim().length < 4) {
      return { success: false, message: "Endereço inválido ou muito curto." };
    }

    this.deliveryAddress = address.trim();
    this.recalculateDelivery();
    this.notify();
    return { 
      success: true, 
      deliveryInfo: this.deliveryInfo,
      message: `Endereço registrado: ${this.deliveryAddress}. Taxa: ${this.deliveryInfo.formattedFee || 'R$ ' + this.deliveryInfo.fee.toFixed(2)}`
    };
  }

  recalculateDelivery() {
    if (this.deliveryAddress) {
      const subtotal = PricingEngine.calculateSubtotal(this.items);
      this.deliveryInfo = this.deliveryService.calculateDelivery(this.deliveryAddress, subtotal);
    } else {
      this.deliveryInfo = null;
    }
  }

  clear() {
    this.items = [];
    this.deliveryAddress = null;
    this.deliveryInfo = null;
    this.orderStatus = "DRAFT";
    this.notify();
  }

  confirmOrder() {
    if (this.items.length === 0) {
      return { success: false, message: "O carrinho está vazio. Adicione itens antes de confirmar." };
    }
    if (!this.deliveryAddress) {
      return { success: false, message: "Por favor, informe o endereço de entrega antes de finalizar." };
    }

    this.orderStatus = "CONFIRMED";
    this.notify();
    return {
      success: true,
      message: "Pedido confirmado com sucesso! Já foi enviado para nossa cozinha.",
      summary: this.getSummary()
    };
  }

  cancelOrder() {
    this.orderStatus = "CANCELLED";
    this.clear();
    return { success: true, message: "Pedido cancelado e carrinho reiniciado." };
  }

  getSummary() {
    const fee = this.deliveryInfo ? this.deliveryInfo.fee : 0;
    const pricingSummary = PricingEngine.calculateOrderSummary(this.items, fee);

    return {
      items: this.items.map(item => ({
        cartItemId: item.cartItemId,
        productId: item.product.id,
        name: item.product.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        subtotal: PricingEngine.roundMoney(item.unitPrice * item.quantity),
        customization: item.customization
      })),
      deliveryAddress: this.deliveryAddress,
      deliveryInfo: this.deliveryInfo,
      orderStatus: this.orderStatus,
      ...pricingSummary
    };
  }
}
