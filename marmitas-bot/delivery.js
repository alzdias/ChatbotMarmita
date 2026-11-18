/**
 * delivery.js - Regras e cálculos determinísticos de taxa de entrega
 */

import { CONFIG } from "./config.js";

export class DeliveryService {
  constructor(rules = CONFIG.DELIVERY_RULES) {
    this.rules = rules;
  }

  getAvailableZones() {
    return this.rules.ZONES;
  }

  /**
   * Identifica o bairro/zona no endereço e calcula a taxa
   * @param {string} addressTexto - Endereço completo digitado pelo cliente
   * @param {number} subtotal - Subtotal atual dos produtos no carrinho
   */
  calculateDelivery(addressTexto, subtotal = 0) {
    if (!addressTexto || typeof addressTexto !== "string" || addressTexto.trim().length < 5) {
      return {
        valid: false,
        fee: 0,
        zoneName: null,
        isFreeShipping: false,
        estimatedTime: null,
        message: "Endereço incompleto ou não fornecido."
      };
    }

    const cleanAddress = addressTexto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Busca zona correspondente
    let matchedZone = this.rules.ZONES.find(zone => {
      const cleanZone = zone.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return cleanAddress.includes(cleanZone);
    });

    if (!matchedZone) {
      // Zona padrão
      matchedZone = {
        name: "Taxa Geral de Entrega",
        fee: this.rules.DEFAULT_FEE,
        minTimeMin: 35,
        maxTimeMin: 50
      };
    }

    // Regra de Frete Grátis acima do valor mínimo
    const isFreeShipping = subtotal >= this.rules.FREE_SHIPPING_MIN_VALUE;
    const finalFee = isFreeShipping ? 0 : matchedZone.fee;

    return {
      valid: true,
      address: addressTexto.trim(),
      zoneName: matchedZone.name,
      baseFee: matchedZone.fee,
      fee: finalFee,
      isFreeShipping,
      estimatedTime: `${matchedZone.minTimeMin} a ${matchedZone.maxTimeMin} minutos`,
      message: isFreeShipping 
        ? `Frete Grátis aplicado (compras acima de R$ ${this.rules.FREE_SHIPPING_MIN_VALUE.toFixed(2)})!` 
        : `Taxa calculada: R$ ${finalFee.toFixed(2)} (${matchedZone.name})`
    };
  }
}
