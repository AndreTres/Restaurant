# Sabores de mi Tierra - Admin

Painel administrativo mobile-first para gestão do restaurante boliviano.

## O que tem

- Login simples (`admin` / `admin`)
- Dashboard com resumo do salão
- CRUD de produtos (cardápio)
- CRUD de garçons
- CRUD de mesas (7 externas + 4 internas)
- Pedidos editáveis (adicionar/remover itens) e finalização
- Taxa de serviço de **10%** no total do pedido
- Histórico de pedidos finalizados com filtros (semana / mês / data)

## Stack

- **Next.js + TypeScript** (frontend e API no mesmo projeto)
- **SQLite** nativo do Node.js (`node:sqlite`) - sem dependência nativa extra
- CSS simples com animações sutis

## Como rodar

```bash
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Fluxo rápido no celular

1. Entrar com `admin` / `admin`
2. Ir em **Pedidos → Novo**
3. Escolher mesa, garçom e produtos
4. Acompanhar status e finalizar quando pagar
5. Conferir em **Histórico**

## Estrutura

```
src/
  app/           # páginas e rotas de API
  components/    # UI reutilizável
  lib/           # banco, auth, helpers
data/            # arquivo SQLite (criado automaticamente)
```

## Observações

- A identidade visual definitiva pode ser aplicada depois.
- Autenticação é propositalmente simples para o MVP (cookie de sessão).
- Dados de exemplo são criados na primeira execução.
