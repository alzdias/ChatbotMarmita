/**
 * pricing.js - Cálculos matemáticos determinísticos
 * 
 * Requisito obrigatório:
 * "O cálculo deverá ser realizado por funções determinísticas em JavaScript, e não pela interpretação matemática do LLM."
 * TOTAL = SOMA DOS PRODUTOS + TAXA DE ENTREGA.
 */

export class PricingEngine {
  /**
   * Arredonda com segurança monetária em centavos
   */
  static roundMoney(amount) {
    return Math.round((Number(amount) || 0) * 100) / 100;
  }

  /**
   * Calcula o subtotal de uma lista de itens do carrinho
   */
  static calculateSubtotal(cartItems = []) {
    if (!Array.isArray(cartItems)) return 0;
    const total = cartItems.reduce((acc, item) => {
      const price = Number(item.unitPrice) || 0;
      const qty = parseInt(item.quantity, 10) || 0;
      return acc + (price * qty);
    }, 0);
    return this.roundMoney(total);
  }

  /**
   * Calcula o resumo financeiro completo
   */
  static calculateOrderSummary(cartItems = [], deliveryFee = 0) {
    const subtotal = this.calculateSubtotal(cartItems);
    const fee = this.roundMoney(deliveryFee);
    const total = this.roundMoney(subtotal + fee);
    const totalItems = cartItems.reduce((acc, item) => acc + (parseInt(item.quantity, 10) || 0), 0);

    return {
      subtotal,
      deliveryFee: fee,
      total,
      totalItems,
      formattedSubtotal: `R$ ${subtotal.toFixed(2)}`,
      formattedDeliveryFee: fee === 0 ? "GRÁTIS" : `R$ ${fee.toFixed(2)}`,
      formattedTotal: `R$ ${total.toFixed(2)}`
    };
  }
}
