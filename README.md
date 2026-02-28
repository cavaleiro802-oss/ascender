# ▲ ASCENDER — Guia de Instalação

## Pré-requisitos
- Node.js 18+ instalado
- Banco MySQL criado no Railway (já feito!)

## 1. Configurar variáveis de ambiente

Copie o arquivo de exemplo:
```
cp .env.example .env
```

Edite o `.env` e preencha:
```
DATABASE_URL=mysql://root:SUA_SENHA@centerbeam.proxy.rlwy.net:25335/railway
SESSION_SECRET=qualquer_string_longa_aqui_ex_ascender2024secreto
OWNER_OPEN_ID=   (deixe vazio por enquanto)
```

## 2. Instalar dependências
```
npm install
```

## 3. Criar as tabelas no banco
```
npm run db:push
```

## 4. Rodar em desenvolvimento
```
npm run dev
```
O site abre em http://localhost:5173

## 5. Virar Admin Supremo

1. Acesse o site e faça login com Google
2. No Railway, abra o banco → tabela `users`
3. Copie o valor da coluna `openId` do seu usuário
4. Cole no `.env` em `OWNER_OPEN_ID=`
5. Reinicie o servidor (`Ctrl+C` e `npm run dev` de novo)
6. Faça login novamente — você será Admin Supremo

## 6. Subir em produção
```
npm run build
npm start
```

## Estrutura do projeto
```
ascender/
├── client/          → Frontend React
│   └── src/
│       ├── pages/   → Páginas do site
│       ├── components/ → Componentes reutilizáveis
│       ├── hooks/   → Hooks React
│       └── lib/     → Configurações (tRPC etc)
├── server/          → Backend Node.js
│   ├── index.ts     → Servidor Express
│   ├── routers.ts   → Todas as rotas/APIs
│   ├── db.ts        → Funções do banco de dados
│   └── auth.ts      → Autenticação Google
├── drizzle/         → Schema e migrações do banco
└── .env             → Suas configurações (não committar!)
```
