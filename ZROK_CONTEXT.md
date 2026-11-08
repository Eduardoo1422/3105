# ZROK — DOCUMENTO MESTRE DO PROJETO

## 1. Resumo Executivo
O **Zrok** (historicamente derivado e estruturado sobre a base do projeto **3105**) é um ecossistema multiplataforma avançado composto por:
1. **Aplicativo iOS Nativo (SwiftUI / Objective-C):** Um gerenciador de conteúdo, hub de patches portáteis (`.3105`), navegador de arquivos de containers de aplicativos e App Groups, laboratório de wallpapers (`.tendies`), temas de discagem (`.3105pass`) e utilitários de sistema compatível com iOS 17.0–18.7.1, iOS 26.0–26.6.1 e iOS 27 (Developer Betas), operando sem necessidade de jailbreak persistente ou daemon de injeção.
2. **Backend API (`backend/`):** Uma aplicação Node.js com TypeScript, Express.js, Prisma ORM (para PostgreSQL), autenticação JWT, validação via Zod e integração com um bot do Telegram (`Telegraf`) para gerenciamento de licenças, chaves de ativação, catálogo e controle administrativo.
3. **Frontend Web / Painel Admin (`web/`):** Uma aplicação web moderna construída com React 19, TypeScript e Vite para administração e gerenciamento do ecossistema Zrok.

---

## 2. Visão e Objetivo do Produto
O Zrok tem como objetivo central unificar a descoberta, instalação e gerenciamento de conteúdo personalizado para dispositivos iOS (patches, temas, wallpapers e recursos) em uma interface limpa, segura e intuitiva, conectada a um backend robusto de licenciamento e distribuição de atualizações.

---

## 3. Problema que Resolve
- Complexidade na aplicação manual de patches em containers de aplicativos e App Groups no iOS.
- Incompatibilidade de UUIDs dinâmicos de containers entre diferentes dispositivos e reinstalações (solucionada pelo mapeamento por Bundle Identifier).
- Falta de um hub centralizado, seguro e verificado para distribuição de temas, wallpapers e patches portáteis.
- Ausência de um sistema central de controle de licenças e chaves de ativação para gerenciar o acesso ao ecossistema.

---

## 4. Público-Alvo
- Usuários avançados de iOS em busca de personalização e gerenciamento de dados de aplicativos.
- Desenvolvedores e criadores de patches/temas para iOS.
- Administradores de comunidades que utilizam bots do Telegram para distribuição de chaves e suporte.

---

## 5. Funcionalidades
- **Marketplace de Repositórios:** Navegação por fontes de conteúdo (For You, New, Sources) com progresso de download e instalação.
- **Biblioteca Instalada (Installed):** Gerenciamento centralizado de patches, wallpapers, temas e recursos com indicadores de atualização.
- **Workspace de Patches (`.3105`):** Suporte a múltiplos escopos (`Application` e `AppGroup`), edição de arquivos plist/JSON com mesclagem inteligente e suporte a campos configuráveis pelo usuário (`settings.json`).
- **Navegador de Arquivos (Files):** Abas independentes, busca, importação de múltiplos arquivos, compactação/extração ZIP, editor simples de plist e favoritos.
- **Cleaner & Wallpaper Lab:** Limpeza de caches e diretórios temporários (`Library/Caches`, `tmp`) e gerenciamento de wallpapers `.tendies`.
- **Sistema de Licenciamento & Bot:** Validação de chaves de ativação via API REST e bot do Telegram.

---

## 6. Arquitetura Técnica
- **iOS App:** Arquitetura MVVM baseada em SwiftUI, combinada com códigos de baixo nível em Objective-C (`kexploit/`, `exploit/`) para escape de sandbox e interação com o sistema.
- **Backend:** Arquitetura em camadas (Controllers, Services, Routes, Middleware, Bot, DB/Prisma).
- **Frontend Web:** Componentes React modulares com Vite.

---

## 7. Tecnologias Utilizadas
- **iOS:** Swift 5, SwiftUI, UIKit, Objective-C.
- **Backend:** Node.js, TypeScript, Express.js, Prisma ORM, PostgreSQL, Telegraf.js, Zod, Bcrypt, JWT, Multer.
- **Frontend Web:** React 19, Vite, TypeScript, Oxlint.
- **Ferramentas e Automação:** Git, GitHub Actions, Docker.

---

## 8. Estrutura Completa do Projecto
```text
/home/guest/Zrok-primeira-versão/
├── .gitattributes
├── .gitignore
├── builder.json
├── CHANGELOG.md
├── fix_pbxproj.py
├── LICENSE
├── README.md
├── README.vi.md
├── register_swag.py
├── Swag-External-teste-ios.zip
├── THIRD_PARTY_NOTICES.md
├── backend/
│   ├── .env.example
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── jest.config.js
│   ├── package-lock.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── app.ts
│       ├── auth/
│       ├── bot/
│       │   └── bot.ts
│       ├── config/
│       │   └── index.ts
│       ├── controllers/
│       │   ├── admin.controller.ts
│       │   └── api.controller.ts
│       ├── db/
│       │   └── index.ts
│       ├── middleware/
│       │   └── admin.ts
│       ├── routes/
│       ├── services/
│       ├── tests/
│       └── utils/
├── docs/
│   ├── API_ARCHITECTURE.md
│   ├── PATCH_GUIDE.md
│   ├── PATCH_GUIDE.vi.md
│   ├── REPOSITORY_GUIDE.vi.md
│   ├── SWAG_EXTERNAL_ARCHITECTURE_AUDIT.md
│   ├── images/
│   └── releases/
├── ThreeOneOSFive/
│   ├── App.swift
│   ├── ContentView.swift
│   ├── Info.plist
│   ├── Assets.xcassets/
│   ├── en.lproj/
│   ├── exploit/
│   ├── helpers/
│   ├── kexploit/
│   ├── vi.lproj/
│   ├── views/
│   ├── zh-Hans.lproj/
│   └── Zrok/
│       ├── ActivationView.swift
│       ├── CompatibilityBuilder.swift
│       ├── FeatureRepository.swift
│       ├── InfoView.swift
│       ├── RemoteAppConfigSyncService.swift
│       ├── ZrokDesign.swift
│       ├── ZrokFeature.swift
│       ├── ZrokFeatureManager.swift
│       ├── ZrokFeatureRow.swift
│       ├── ZrokFeatureSection.swift
│       ├── ZrokGameHeader.swift
│       ├── ZrokKeychainStore.swift
│       ├── ZrokModels.swift
│       ├── ZrokPatchDownloadManager.swift
│       └── ZrokPublishedTabsView.swift
├── ThreeOneOSFive.xcodeproj/
└── web/
    ├── src/
    ├── package.json
    ├── vite.config.ts
    └── ...
```

---

## 9. Fluxos de Funcionamento
1. **Ativação e Boot:** O aplicativo iOS inicializa, verifica suporte e compatibilidade de sistema, autentica via chave de ativação (`ActivationView` / `ZrokKeychainStore`) e sincroniza configurações (`RemoteAppConfigSyncService`).
2. **Sincronização de Patches e Repositórios:** O app busca atualizações no backend via API REST (`/api/v1/bootstrap`), baixando pacotes `.3105` assinados/estruturados.
3. **Aplicação de Patch:** O usuário edita o workspace de patches, sincroniza e aplica as modificações mapeadas por Bundle ID (`Application` / `AppGroup`).

---

## 10. APIs e Integrações
- Endpoints REST em Express.js para autenticação, gerenciamento de licenças, chaves de dispositivo e metadados de funcionalidades.
- Bot do Telegram para automação de comandos administrativos.

---

## 11. Banco de Dados
- **ORM:** Prisma.
- **Schema principal (`prisma/schema.prisma`):** Gerenciamento de usuários, chaves de licença, dispositivos vinculados e metadados de recursos.

---

## 12. Infraestrutura
- Configuração Docker (`backend/docker-compose.yml`, `backend/Dockerfile`).
- Deploy configurado para Render / Vercel (conforme histórico de commits e documentação).

---

## 13. Histórico de Desenvolvimento
- Evolução a partir da base **3105** (versão 2.0 lançada em agosto de 2026).
- Integração do backend Zrok Core, Prisma, suporte a Docker e painel web administrativo em React.
- Adição de fluxos de ativação e sincronização remota específicos do Zrok.

---

## 14. Decisões Técnicas
- **Mapeamento por Bundle Identifier:** Evita dependência de UUIDs voláteis de containers no iOS.
- **Arquitetura Desacoplada:** Backend em Node.js/TypeScript centralizando regras de negócio e licenças, com app nativo SwiftUI e frontend web separado.

---

## 15. Funcionalidades Concluídas
- Base nativa iOS com suporte a exploits de kernel (iOS 17–18) e versões recentes (iOS 26–27).
- Sistema de workspace de patches (`.3105`) com suporte a plist/JSON e `settings.json`.
- Navegador de arquivos e containers de aplicativos.
- Estrutura completa do Backend Node.js / Prisma / Telegraf Bot.
- Frontend web administrativo (React + Vite).

---

## 16. Funcionalidades Pendentes
- Refinamento completo da integração end-to-end entre o aplicativo iOS e a nova API de licenças do Zrok.
- Expansão de testes automatizados no backend (`editor_workflow.test.ts`, `patch_replacement.test.ts`).

---

## 17. Bugs e Problemas Conhecidos
- Dependência estrita de versões de build do iOS e certificados de assinatura empresarial para execução das funcionalidades de nível de sistema no iOS.

---

## 18. Estado Atual
O projeto encontra-se em estágio avançado de consolidação da transição da base 3105 para o ecossistema Zrok, com o backend, o painel web e o aplicativo iOS estruturados, possuindo alterações locais pendentes de commit na árvore de trabalho (`ThreeOneOSFive.xcodeproj`, `web/src/`).

---

## 19. Como Executar o Projeto
- **Backend:**
  ```bash
  cd backend
  npm install
  npx prisma generate
  npm run dev
  ```
- **Web Frontend:**
  ```bash
  cd web
  npm install
  npm run dev
  ```
- **iOS App:**
  Abrir `ThreeOneOSFive.xcodeproj` no Xcode e selecionar o esquema `3105` / Zrok.

---

## 20. Próximos Passos
1. Concluir a revisão e testes dos fluxos de ativação e sincronização de licenças entre o app iOS e o backend.
2. Executar e validar os testes automatizados do backend.
3. Consolidar o versionamento e documentação final de lançamento do Zrok.

---

## 21. Dúvidas que Ainda Precisam ser Esclarecidas
- Status exato da emissão de certificados de assinatura para os testes finais em dispositivos físicos iOS.

---

## 22. Referências aos Arquivos que Comprovam as Informações
- `README.md` e `CHANGELOG.md` (Visão geral do app iOS e versão 2.0).
- `builder.json` (Metadados do projeto e identificadores).
- `docs/API_ARCHITECTURE.md`, `docs/PATCH_GUIDE.md`, `docs/SWAG_EXTERNAL_ARCHITECTURE_AUDIT.md`.
- `backend/package.json`, `backend/prisma/schema.prisma`.
- `web/package.json`.
- `ThreeOneOSFive/Zrok/` (Código de integração específica do Zrok).
