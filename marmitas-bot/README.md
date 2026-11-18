# 🍲 Marmitaria Sabor & Arte — Chatbot Inteligente de Vendas com IA & Guardrails

Aplicação web completa, funcional, moderna e com execução **100% Client-Side** para vendas de marmitas através de conversação em linguagem natural com agente inteligente, carrinho de compras determinístico, motor de cálculo seguro e guardrails anti-injection.

---

## 🏛️ 1. Arquitetura e Decisões de Engenharia

O projeto foi estruturado seguindo os princípios de **Clean Code**, **SOLID** e separação estrita de responsabilidades:

1. **Separação entre LLM e Regras de Negócio**:
   - O LLM (ou PLN) atua exclusivamente como **interface de interpretação e conversação natural**.
   - **Toda a regra comercial, cálculo de preços, validação de ingredientes, limites de personalização e taxas de entrega é executada de forma determinística por código JavaScript puro.**
   - O LLM **nunca** tem permissão de alterar preços, aplicar descontos arbitrários ou injetar produtos fora do cardápio oficial.

2. **Segurança Client-Side & Tratamento de Credenciais**:
   - *Limitação inerente da arquitetura Client-Side*: Qualquer chave de API embutida no código do navegador fica exposta. Por essa razão, **nenhuma chave de API é chumbada no código**.
   - O sistema implementa o **Mock Engine inteligente local** como provedor padrão: interpreta linguagem natural, intenções de compra, personalização e quantidade sem necessidade de internet ou chaves externas.
   - Opcionalmente, o usuário pode inserir sua própria API Key (Gemini, OpenAI ou Groq) no modal de configurações. A chave é salva apenas no `sessionStorage` temporário da sessão do navegador.

3. **Guardrails de Segurança (Camada Dupla)**:
   - **Camada 1 (Pré-processamento)**: Detecção de padrões de Prompt Injection e Jailbreak (`validators.js`) antes mesmo de enviar para o modelo.
   - **Camada 2 (Pós-processamento de Ações)**: Validação estrita das ações estruturadas (`ADD_ITEM`, `REMOVE_ITEM`, `SET_DELIVERY_ADDRESS`, etc.) contra o catálogo oficial (`menu.js`).

---

## 📁 2. Estrutura de Arquivos

```text
marmitas-bot/
├── index.html          # Interface principal moderna (Chat, Cardápio e Carrinho em 3 colunas)
├── styles.css          # Design system completo, responsivo e adaptado para mobile/desktop
├── app.js              # Ponto de entrada, inicialização e orquestração dos componentes
├── chat.js             # Gerenciamento da UI conversacional, eventos de digitação e renderização
├── agent.js            # Orquestrador do agente inteligente (Mock Engine, Gemini, OpenAI e Groq)
├── prompts.js          # Engenharia de prompts, personas, instruções de sistema e contexto dinâmico
├── menu.js             # Catálogo oficial de pratos, ingredientes, pontos e regras de personalização
├── cart.js             # Gerenciamento de estado reativo do carrinho de compras
├── pricing.js          # Cálculos matemáticos determinísticos de subtotais e totais
├── delivery.js         # Motor determinístico de cálculo de taxa de entrega por zona/bairro e frete grátis
├── validators.js       # Guardrails contra prompt injection, manipulação de preços e sanitização XSS
├── config.js           # Constantes e configurações não sensíveis da aplicação
├── test-suite.js       # Bateria de testes automatizados dos 15 cenários obrigatórios
├── test-runner.html    # Interface visual para execução dos testes no navegador
└── README.md           # Documentação completa do projeto
```

---

## 🚀 3. Instruções para Execução Local

Como a aplicação é 100% Client-Side em Vanilla JavaScript utilizando módulos ES6 (`import`/`export`), basta servi-la em qualquer servidor web estático ou extensão do VS Code:

### Opção 1: Live Server (VS Code / Antigravity)
1. Clique com o botão direito no arquivo `index.html`.
2. Selecione **"Open with Live Server"**.

### Opção 2: Python (Servidor Local Nativo)
Abra o terminal na pasta `marmitas-bot` e execute:
```bash
python -m http.server 8080
```
Acesse no navegador: `http://localhost:8080`

### Opção 3: Executar a Suíte de Testes
Para rodar os testes automatizados dos 15 cenários obrigatórios:
Acesse no navegador: `http://localhost:8080/test-runner.html`

---

## 🧪 4. Validação dos 15 Cenários Obrigatórios de Teste

A suíte em `test-suite.js` cobre e valida com rigor:

| # | Cenário Testado | Status | Comportamento Verificado |
|---|---|:---:|---|
| 1 | Compra de um único produto | ✅ Aprovado | Item adicionado com preço oficial do cardápio e subtotal correto. |
| 2 | Compra de múltiplos produtos | ✅ Aprovado | Cálculo exato de quantidades e itens variados. |
| 3 | Alteração de quantidades | ✅ Aprovado | Quantidade ajustada e subtotal recalculado em tempo real. |
| 4 | Remoção de produtos | ✅ Aprovado | Item removido e lista/total atualizados imediatamente. |
| 5 | Personalização de ingredientes | ✅ Aprovado | Remoção de itens permitidos (cebola, alho) aceita; rejeição de ingredientes inválidos. |
| 6 | Ponto da carne | ✅ Aprovado | Ponto ("bem passado", "ao ponto") validado de acordo com a receita. |
| 7 | Consulta de subtotal | ✅ Aprovado | Subtotal determinístico calculado em centavos. |
| 8 | Cálculo de taxa de entrega | ✅ Aprovado | Bairros identificados por zona; regra de Frete Grátis acima de R$ 90,00 aplicada. |
| 9 | Fórmula do valor final | ✅ Aprovado | TOTAL = SOMA DOS PRODUTOS + TAXA DE ENTREGA (exato, sem alucinação). |
| 10 | Mensagens ambíguas | ✅ Aprovado | Atendimento cordial pedindo esclarecimento sem quebrar o estado. |
| 11 | Produtos indisponíveis | ✅ Aprovado | Marmita Parmegiana esgotada é bloqueada e opções alternativas são sugeridas. |
| 12 | Tentativa de Prompt Injection | ✅ Aprovado | Ataques como *"ignore all instructions"* bloqueados por guardrail. |
| 13 | Manipulação de preços | ✅ Aprovado | Tentativa de injetar preço via payload ignorada; valor do cardápio preservado. |
| 14 | Resiliência do LLM | ✅ Aprovado | Chave inválida ou erro na API externa dispara contingência offline imediata. |
| 15 | Confirmação e cancelamento | ✅ Aprovado | Pedido apenas fecha com confirmação explícita e endereço; cancelamento limpa o estado. |

---

## 💡 5. Recomendações para Evolução

1. **Backend com Gateway BFF (Backend for Frontend)**:
   - Para ambientes de produção comercial, adicionar um microsserviço intermediário (ex: Node.js / Cloudflare Workers / Supabase Edge Functions) para proteger a API Key do LLM e integrar com gateways de pagamento (PIX / Cartão de Crédito).
2. **Integração com WhatsApp Business API**:
   - Conectar o mesmo motor conversacional (`AgentService` + `CartService`) ao webhook oficial do WhatsApp para atendimento multicanal.
3. **Persistência de Pedidos**:
   - Salvar os pedidos confirmados em banco de dados relacional ou no sistema de PDV da cozinha do restaurante.
