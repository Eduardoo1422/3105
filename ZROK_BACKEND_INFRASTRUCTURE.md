# ZROK — DOCUMENTAÇÃO DE BACKEND, BANCO DE DADOS E INFRAESTRUTURA

Este documento apresenta a auditoria técnica completa e detalhada da infraestrutura, backend, banco de dados, API, sistema de licenças, bot do Telegram e painel web administrativo do projeto **Zrok**.

---

## 1. BACKEND

O backend do Zrok (`backend/`) foi projetado como uma API REST centralizada e robusta em Node.js com TypeScript e Express.js.

### Organização de Pastas
```text
backend/
├── prisma/
│   └── schema.prisma         # Schema e definições do Prisma ORM
├── src/
│   ├── app.ts                # Ponto de entrada (Express, middlewares globais, rotas e inicialização do bot)
│   ├── auth/                 # Lógica de autenticação
│   ├── bot/
│   │   └── bot.ts            # Bot do Telegram via Telegraf
│   ├── config/
│   │   └── index.ts          # Configurações de ambiente centralizadas
│   ├── controllers/
│   │   . admin.controller.ts # Controladores para rotas administrativas (Licenças, Categorias, Features, Recursos, Configs)
│   │   └── api.controller.ts # Controladores para autenticação, validação de licença, bootstrap e download de recursos
│   ├── db/
│   │   └── index.ts          # Instância do PrismaClient
│   ├── middleware/
│   │   . admin.ts            # Middleware de verificação de papel administrativo (ADMIN)
│   │   └── auth.ts           # Middleware de validação de token JWT
│   ├── routes/
│   │   └── api.routes.ts     # Roteador central da API (/api/v1)
│   ├── services/
│   │   ├── core.service.ts   # Lógica de autenticação e gerenciamento de usuários
│   │   ├── data.service.ts   # Gerenciamento de Categorias, Features, Versões e Storage de arquivos
│   │   └── license.service.ts# Lógica de criação, validação, pausa, retomada e revogação de licenças
│   ├── tests/                # Testes automatizados (Jest, supertest, mocks)
│   └── utils/
│       └── validation.ts     # Schemas de validação de entrada com Zod
├── .env.example              # Exemplo de variáveis de ambiente
├── Dockerfile                # Configuração Docker do backend
└── docker-compose.yml        # Orquestração local (PostgreSQL + API)
```

### Autenticação, Autorização e Sessões
- **Autenticação:** Baseada em tokens JWT (`jsonwebtoken`) gerados no login administrativo (`/api/v1/auth/login`).
- **Middleware de Autenticação (`authMiddleware`):** Extrai o token do cabeçalho `Authorization: Bearer <token>`, decodifica-o utilizando `JWT_SECRET` e injeta `req.user` (`userId`, `username`, `role`).
- **Middleware Administrativo (`adminMiddleware`):** Verifica se `req.user.role === 'ADMIN'`, bloqueando acessos não autorizados a rotas protegidas.
- **Validação de Dados:** Utiliza o pacote `Zod` (`backend/src/utils/validation.ts`) para validar rigidamente os corpos das requisições em rotas críticas.
- **Tratamento de Erros e Logs:** Tratamento centralizado de erros no Express (`app.ts`) e auditoria de ações críticas gravadas na tabela `AuditLog`.

---

## 2. BANCO DE DADOS

O banco de dados oficial é o **PostgreSQL**, gerenciado através do **Prisma ORM**.

### Schema Completo (`prisma/schema.prisma`)

#### Tabela `User`
- `id`: String (UUID, PK)
- `username`: String (Unique)
- `password`: String (Hash bcrypt)
- `role`: String (Default: `"ADMIN"`)
- `createdAt`, `updatedAt`: Timestamps

#### Tabela `LicenseKey`
- `id`: String (UUID, PK)
- `keyIdentifier`: String (Unique) - Ex: `ZROK-XXXX-YYYY`
- `keyHash`: String (Unique) - Hash bcrypt do segredo bruto
- `status`: Enum `LicenseStatus` (`ACTIVE`, `PAUSED`, `INACTIVE`, `REVOKED`, `EXPIRED`)
- `durationDays`: Int (Default: `30`)
- `expiresAt`: DateTime?
- `activatedAt`: DateTime? (Ativação diferida no primeiro uso)
- `pausedIndividual`: Boolean (Default: `false`)
- `pausedGlobal`: Boolean (Default: `false`)
- `remainingTimeAtPause`: BigInt?
- `lastPauseAt`: DateTime?
- `revokedAt`: DateTime?
- `maxDevices`: Int (Default: `1`)
- `notes`: String?
- `createdBy`: String?
- `createdAt`, `updatedAt`: Timestamps
- Relacionamento: `devices` (One-to-Many com `Device`)

#### Tabela `Device`
- `id`: String (UUID, PK)
- `deviceIdentifier`: String
- `licenseKeyId`: String (FK para `LicenseKey`)
- `platform`: String?
- `appVersion`: String?
- `firstSeenAt`, `lastSeenAt`: Timestamps
- `active`: Boolean (Default: `true`)
- Índice Único composto: `@@unique([deviceIdentifier, licenseKeyId])`

#### Tabela `Category`
- `id`: String (UUID, PK), `name`: String, `slug`: String (Unique), `enabled`: Boolean, Timestamps.
- Relacionamento: `features` (One-to-Many com `Feature`).

#### Tabela `Feature`
- `id`: String (UUID, PK), `name`: String, `description`: String, `categoryId`: String (FK), `iconName`: String, `enabled`: Boolean, Timestamps.
- Relacionamento: `resources` (One-to-Many com `Resource`).

#### Tabela `Resource`
- `id`: String (UUID, PK), `featureId`: String (FK), `filename`: String, `mimeType`: String, `fileSize`: Int, `sha256`: String, `targetBundleId`: String, `targetRelativePath`: String, `targetFilename`: String, Timestamps.
- Relacionamento: `versions` (One-to-Many com `ResourceVersion`).

#### Tabela `ResourceVersion`
- `id`: String (UUID, PK), `resourceId`: String (FK), `version`: String, `filename`: String, `storageKey`: String, `fileSize`: Int, `sha256`: String, `targetBundleId`: String, `targetRelativePath`: String, `targetFilename`: String, `releaseNotes`: String?, `createdAt`.

#### Tabela `AuditLog`
- `id`: String (UUID, PK), `action`: String, `actorId`: String?, `targetId`: String?, `details`: String?, `createdAt`.

#### Tabela `AppConfig`
- `id`: String (PK, default `"default"`), `config`: String (JSON stringificado), `updatedAt`.

---

## 3. API E COMUNICAÇÃO

Endpoints definidos em `backend/src/routes/api.routes.ts`:

| Método | Caminho | Controller / Handler | Auth / Role | Finalidade |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | `AuthController.login` | Público | Autenticação do Administrador (JWT) |
| `POST` | `/api/v1/license/validate` | `LicenseController.validate` | Público | Validação de licença e vinculação de dispositivo |
| `GET` | `/api/v1/bootstrap` | `FeatureController.bootstrap` | Público | Retorna catálogo de features e recursos ativos |
| `GET` | `/api/v1/config/published` | `AdminConfigController.getPublished`| Público | Configuração publicada do aplicativo |
| `POST` | `/api/v1/device/sync-status` | `AdminConfigController.syncStatus` | Público | Sincronização de status do dispositivo |
| `POST` | `/api/v1/client/resource/:id/download` | `ResourceClientController.download` | Público (Valida Licença) | Download de recurso protegido por licença válida |
| `POST` | `/api/v1/admin/license` | `AdminLicenseController.create` | Auth + Admin | Criação de nova chave de licença |
| `POST` | `/api/v1/admin/category` | `AdminCategoryController.create` | Auth + Admin | Criação de categoria |
| `GET` | `/api/v1/admin/category` | `AdminCategoryController.list` | Auth + Admin | Listagem de categorias |
| `POST` | `/api/v1/admin/feature` | `AdminFeatureController.create` | Auth + Admin | Criação de funcionalidade (feature) |
| `POST` | `/api/v1/admin/resource` | `AdminResourceController.upload` | Auth + Admin | Upload de arquivo/patch (`.3105`) com validação de magic bytes |
| `GET` | `/api/v1/admin/resource` | `AdminResourceController.list` | Auth + Admin | Listagem de recursos |
| `GET` | `/api/v1/admin/resource/:id` | `AdminResourceController.get` | Auth + Admin | Detalhes de um recurso |
| `GET` | `/api/v1/admin/config` | `AdminConfigController.get` | Auth + Admin | Obtenção de configurações administrativas |
| `PUT` | `/api/v1/admin/config/draft` | `AdminConfigController.updateDraft` | Auth + Admin | Atualização de rascunho de configuração |
| `POST` | `/api/v1/admin/config/publish` | `AdminConfigController.publish` | Auth + Admin | Publicação de configuração |
| `GET` | `/api/v1/admin/resource/:id/download`| `ResourceDownloadController.download`| Auth + Admin | Download de recurso pelo painel admin |

---

## 4. SISTEMA DE LICENÇAS

Implementado em `backend/src/services/license.service.ts`:
- **Geração:** O administrador gera uma chave (`keyIdentifier` e `rawSecret`). O segredo bruto é hasheado com bcrypt (`keyHash`) e salvo no banco.
- **Ativação Diferida:** A validade (`durationDays`) começa a contar apenas no **primeiro uso** (`activatedAt = now`, `expiresAt = now + durationDays`).
- **Validação:** Verifica se a licença está ativa, não revogada, não expirada e compara o segredo bruto com o hash via `bcrypt.compare`.
- **Limitação de Dispositivos:** Controlada pelo campo `maxDevices` e tabela `Device`. Se o dispositivo já estiver vinculado, atualiza `lastSeenAt`; caso contrário, verifica o limite e cria um registro vinculado.
- **Pausa e Retomada:** Permite pausar licenças (individual ou globalmente). Ao pausar, o tempo restante (`remainingTimeAtPause`) é congelado; ao retomar, a data de expiração (`expiresAt`) é recalculada com base no tempo remanescente.

---

## 5. BOT DO TELEGRAM

Implementado em `backend/src/bot/bot.ts` usando a biblioteca `Telegraf`:
- **Segurança:** Middleware restritivo que valida se o ID do remetente (`ctx.from.id`) está presente na lista autorizada (`TELEGRAM_ADMIN_IDS`).
- **Comandos Disponíveis:**
  - `/start`: Exibe o painel de controle interativo com status do sistema.
  - `/status`: Mostra a saúde dos componentes (API, DB, Bot, Resources, Auth).
  - `/key_create <days> [maxDevices]`: Cria uma nova chave de licença diretamente pelo chat.
  - `/key_list`: Lista as licenças mais recentes.
  - `/key_info <keyIdentifier>`: Exibe detalhes completos de uma licença e seus dispositivos vinculados.
  - `/key_pause <keyIdentifier>`: Congela a validade de uma licença.
  - `/key_resume <keyIdentifier>`: Retoma a validade de uma licença.
  - `/key_revoke <keyIdentifier>`: Solicita confirmação para revogar uma licença.
- **Menus Interativos:** Utiliza teclados inline (`Telegraf Markup`) para navegação rápida entre licenças, recursos, dispositivos, estatísticas e logs de auditoria.

---

## 6. PAINEL ADMINISTRATIVO WEB

Implementado em `web/` (`React 19`, `Vite`, `TypeScript`):
- **Estrutura:**
  - `src/App.tsx`: Gerenciamento de estado de autenticação e abas principais.
  - `src/components/Login.tsx`: Tela de login administrativo.
  - `src/components/Sidebar.tsx`: Navegação lateral entre abas (`dashboard`, `licenses`, `editor`, `settings`).
  - `src/components/Header.tsx`: Cabeçalho contextual.
  - `src/components/Toast.tsx`: Notificações flutuantes.
  - `src/components/views/`: Views específicas (`DashboardView`, `LicenseKeysView`, `AppEditorView`, `SettingsView`, etc.).
  - `src/services/api.ts`: Cliente HTTP com injeção automática do token JWT Bearer do armazenamento local (`zrok_admin_token`).

---

## 7. INFRAESTRUTURA E DEPLOY

- **Orquestração Local:** `backend/docker-compose.yml` sobe um container PostgreSQL 15-alpine (`port 5432`) e o container da API (`port 3000`).
- **Dockerfile:** Utiliza imagem base `node:20-bookworm-slim`, instala OpenSSL (exigido pelo Prisma), compila o TypeScript (`npm run build`) e expõe a porta `3000`.
- **Variáveis de Ambiente (`.env.example`):**
  - `DATABASE_URL` / `DIRECT_URL`
  - `API_PORT` (default `3000`)
  - `JWT_SECRET`
  - `TELEGRAM_BOT_TOKEN`
  - `TELEGRAM_ADMIN_IDS`
  - `STORAGE_PATH` (default `./uploads`)
- **CORS:** Configurado explicitamente no Express para aceitar origens locais (`http://localhost:5173`) e de produção (`https://3105-teal.vercel.app`).

---

## 8. SEGURANÇA

- **Proteção de Endpoints:** Rotas administrativas protegidas por dupla camada (`authMiddleware` + `adminMiddleware`).
- **Hash de Senhas e Segredos:** Uso de `bcrypt` para senhas de administradores e hashes de chaves de licença.
- **Validação de Uploads:** Verificação de tamanho máximo (`MAX_UPLOAD_SIZE`), validação de pacotes `.3105` através de magic bytes (`3105PATCH\0`) e prevenção rigorosa contra *Path Traversal* no `StorageService`.
- **Validação de Entrada:** Uso de esquemas estritos com `Zod`.

---

## 9. DEPENDÊNCIAS E SERVIÇOS EXTERNOS

### Backend (`backend/package.json`)
- `@prisma/client` (^5.0.0): ORM para PostgreSQL.
- `express` (^4.18.2): Framework web HTTP.
- `telegraf` (^4.12.2): Biblioteca para o Bot do Telegram.
- `jsonwebtoken` (^9.0.0): Autenticação JWT.
- `bcrypt` (^5.1.0): Hashing seguro.
- `multer` (^2.4.0): Upload de arquivos.
- `zod` (^3.21.4): Validação de esquemas.
- `cors` (^2.8.6): Controle de CORS.
- `dotenv` (^16.3.1): Variáveis de ambiente.

### Frontend Web (`web/package.json`)
- `react` (^19.2.8), `react-dom` (^19.2.8): Biblioteca UI.
- `vite` (^8.3.0): Build tool e dev server.
- `oxlint` (^1.81.0): Linter de código.

---

## 10. DIAGRAMA DA ARQUITETURA

```mermaid
graph TD
    ClientApp[Aplicativo iOS 3105/Zrok] -->|HTTPS REST| API[API Backend Node.js / Express]
    WebAdmin[Painel Web Admin (React)] -->|HTTPS REST + JWT| API
    TelegramUser[Administrador Telegram] -->|Telegram Bot API| Bot[Telegram Bot (Telegraf)]
    
    Bot -->|Internal Calls / Services| API
    API -->|Prisma ORM| DB[(PostgreSQL)]
    API -->|Filesystem / Atomic Write| Storage[Storage Local / Uploads]
```

---

## 11. DIAGNÓSTICO

1. **O backend está realmente funcional?** Sim, possui estrutura completa em TypeScript, rotas definidas, controladores e serviços implementados.
2. **O banco está corretamente estruturado?** Sim, o schema do Prisma cobre usuários, licenças, dispositivos, categorias, features, recursos, versões, logs de auditoria e configurações.
3. **Existem migrations pendentes?** O schema Prisma está definido; as migrações dependem da execução do Prisma no ambiente de banco ativo.
4. **A API está completa?** Sim, cobre autenticação, validação de licenças, bootstrap, gerenciamento de recursos e painel administrativo.
5. **O sistema de licenças está funcional?** Sim, implementa criação, ativação diferida, limites de dispositivos, pausa/retomada com congelamento de tempo e revogação.
6. **O bot está integrado?** Sim, integrado via Telegraf com comandos administrativos completos e verificação de permissões por ID de Telegram.
7. **O painel web consegue executar suas operações?** Sim, possui views para dashboard, licenças, editor e configurações, comunicando-se via `apiRequest` com token JWT.
8. **A infraestrutura está preparada para produção?** Sim, possui Dockerfile otimizado com OpenSSL, Docker Compose, variáveis de ambiente configuráveis e tratamento de CORS.
9. **Quais são os principais riscos?** Exposição de chaves em ambientes mal configurados e dependência de conectividade para validação de licenças.
10. **O que precisa ser corrigido ou implementado?** Testes automatizados adicionais e validação em ambiente real de produção.
