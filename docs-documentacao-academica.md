# Sistema Web para Gerenciamento de Confeitaria

## 1. Tema do projeto

O projeto consiste no desenvolvimento de uma plataforma web para gerenciamento de uma confeitaria. A solução conecta a experiência de compra do cliente com a organização interna do negócio, centralizando catálogo, pedidos, produção, pagamentos, receitas e estoque.

## 2. Problema identificado

Confeitarias podem receber pedidos por diferentes canais, registrar informações manualmente e controlar ingredientes sem uma visão única da operação. Isso aumenta o risco de erros de comunicação, atrasos, divergências de preço e falta de insumos. O sistema propõe um fluxo digital único para reduzir esses problemas.

## 3. Objetivo geral

Desenvolver um sistema web responsivo que permita aos clientes realizar encomendas de forma simples e à equipe da confeitaria administrar produtos, pedidos, produção, pagamentos e estoque em um painel protegido por autenticação.

## 4. Objetivos específicos

O cliente poderá consultar o catálogo, adicionar produtos ao carrinho, escolher retirada ou entrega, indicar data e horário, selecionar forma de pagamento, confirmar o pedido e acompanhar seu status por código. A equipe poderá cadastrar produtos, controlar pedidos, organizar a agenda, acompanhar pagamentos, cadastrar receitas e visualizar alertas de estoque baixo.

## 5. Escopo validado

Antes da implementação, foram validados os seguintes pontos: a primeira versão terá dois perfis essenciais, cliente e administrador; o checkout aceitará pedidos sem cadastro; o pagamento poderá ser controlado manualmente; a entrega terá taxa fixa inicialmente; e a baixa de ingredientes será calculada quando houver uma receita ativa para o produto.

## 6. Fluxo do pedido

O cliente escolhe um produto e suas opções, adiciona o item ao carrinho e informa os dados de checkout. O servidor valida os campos, calcula o total e cria o pedido como **Pedido recebido**. Uma tarefa de produção é criada automaticamente para a data escolhida. Se houver receita cadastrada, os ingredientes são calculados e os movimentos de estoque são registrados.

A equipe acompanha o pedido no painel e altera o status para **Em produção**, **Pronto**, **Saiu para entrega** e **Entregue**, conforme a modalidade escolhida. O cliente pode acompanhar a linha do tempo imediatamente após confirmar o pedido ou posteriormente informando o código numérico do pedido.

## 7. Tecnologias

| Camada | Tecnologia | Uso no projeto |
|---|---|---|
| Interface | React, TypeScript e Tailwind CSS | Loja, checkout e painel |
| Componentes | shadcn/ui e Lucide | Formulários, badges, ações e navegação |
| API | tRPC e Zod | Procedimentos tipados e validação |
| Servidor | Node.js e Express | Regras de negócio e autenticação |
| Persistência | MySQL e Drizzle ORM | Entidades, consultas e migrações |
| Testes | Vitest | Validação dos fluxos principais |

## 8. Conclusão

A plataforma demonstra a integração entre front-end, back-end, API, autenticação e banco de dados relacional em um caso de uso real. O domínio da confeitaria torna o sistema aplicável a uma pequena empresa, permitindo que a solução evolua posteriormente com pagamento online, cálculo de entrega por distância, perfis adicionais, relatórios avançados e notificações.
