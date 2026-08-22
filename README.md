# Miette — Plataforma de Gerenciamento de Confeitaria

A Miette é uma plataforma web full-stack para conectar a loja digital da confeitaria à sua operação interna. Clientes podem consultar o catálogo, montar um carrinho, escolher retirada ou entrega, definir data e horário, informar pagamento e acompanhar pedidos. A equipe pode administrar pedidos, catálogo, produção, dashboard e estoque.

## Arquitetura

| Camada | Tecnologia |
|---|---|
| Front-end | React 19, TypeScript, Tailwind CSS e shadcn/ui |
| Back-end | Node.js, Express e TypeScript |
| API | tRPC 11 com contratos tipados |
| Banco de dados | MySQL |
| ORM | Drizzle ORM |
| Armazenamento futuro | S3 para fotos de produtos |

## Módulos implementados

A área pública possui catálogo responsivo, busca, carrinho, checkout sem cadastro obrigatório, retirada ou entrega, cálculo do total, seleção de pagamento e confirmação de pedido. O pedido inicia em **Pedido recebido** e pode avançar por **Em produção**, **Pronto**, **Saiu para entrega** e **Entregue**.

O painel administrativo exige autenticação e apresenta dashboard com faturamento, quantidade de pedidos, pendências, produção, ticket médio e alertas de estoque. Também inclui gerenciamento de catálogo com criação, edição e remoção lógica de produtos, lista de pedidos com avanço de status e cadastro de ingredientes com estoque mínimo.

Quando existem receitas associadas a um produto, a criação do pedido calcula o consumo dos ingredientes e registra a saída no estoque. As tabelas de receitas e itens de receita já fazem parte do modelo para a evolução do módulo de ficha técnica.

## Perfis de acesso

O perfil `user` representa clientes autenticados e o perfil `admin` possui acesso às rotas administrativas. O checkout público permite pedidos sem cadastro. As rotas de catálogo público e criação de pedido são abertas; dashboard, pedidos administrativos e estoque usam `adminProcedure`.

## Banco de dados

O schema em `drizzle/schema.ts` inclui usuários, categorias, produtos, opções, ingredientes, receitas, itens de receita, pedidos, itens de pedidos, pagamentos e movimentações de estoque. A migração segura das novas tabelas foi aplicada sem remover a tabela legada `records`.

## Como abrir no VS Code

Extraia o ZIP e abra a pasta `sistema-codificacao` no VS Code. No terminal integrado, execute `pnpm install`. Depois, valide com `pnpm check`, `pnpm test` e `pnpm build`. Para iniciar o desenvolvimento local, execute `pnpm dev`.

As credenciais e variáveis de ambiente são fornecidas pelo ambiente Manus. Não publique arquivos `.env` com segredos. Para conectar em outro MySQL, configure `DATABASE_URL` e as variáveis de autenticação equivalentes do template.

## Principais arquivos

| Arquivo | Responsabilidade |
|---|---|
| `client/src/pages/Home.tsx` | Loja, carrinho, checkout e painel administrativo |
| `server/routers.ts` | Routers tRPC e autorização |
| `server/db.ts` | Consultas Drizzle, criação de pedidos e baixa de estoque |
| `drizzle/schema.ts` | Entidades relacionais da confeitaria |
| `server/bakery.test.ts` | Testes dos fluxos principais |
| `docs-arquitetura-confeitaria.md` | Arquitetura detalhada aprovada |
 
 
