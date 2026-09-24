# Arquitetura do SWAG-EXTERNAL (Baseado no 3105)

## A. Estrutura do projeto
O projeto é estruturado em Swift com componentes em Objective-C para interações de baixo nível (kernel, exploração, helpers).
- `ThreeOneOSFive/`: Código principal.
  - `helpers/`: Lógica de negócio, serviços de sistema, gerenciamento de arquivos.
  - `views/`: Interface do usuário (SwiftUI).
  - `exploit/` e `kexploit/`: Código de baixo nível para exploração e interação com o sistema.
- `ThreeOneOSFive.xcodeproj`: Definição do projeto e configurações de build.

## B. Fluxo de inicialização
`App.swift` é o ponto de entrada (`@main`).
1. Inicializa `AppState`, `PatchDraftCoordinator`, `FileOperationCoordinator`, etc.
2. Verifica suporte (compatibilidade) com `AppState.detectSupport()`.
3. Decide entre `OnboardingView` ou `ContentView`.
4. Verifica atualizações (`AppUpdateChecker`).
5. Inicia automaticamente o exploit se aplicável.

## C. Arquitetura atual
Arquitetura MVVM (Model-View-ViewModel) baseada em SwiftUI com serviços injetados via `@EnvironmentObject` no App.
Serviços principais operam sobre `FileManager` e APIs de baixo nível (kernel/sandbox escape).

## D. Componentes que serão preservados
- Exploit engine (`kexploit/`, `exploit/`).
- Gerenciamento de arquivos e operações (`FileOperationCoordinator`, `FileManagerService`).
- Modelos de patches e repositórios (`PatchProjectModels`, `PackageRepositoryModels`).
- Lógica de suporte e compatibilidade.

## E. Componentes da interface que serão substituídos
- `ContentView.swift` (Navegação principal).
- `RepositoryHomeView.swift` e outros `views/`.
- `OnboardingView.swift` (Será adaptado ou refeito).

## F. Componentes que precisarão ser adaptados
- `App.swift` (Inicialização e navegação para se adequar ao fluxo do Swag-External).
- `PatchProjectStore` e `PackageRepositoryStore` (Provável integração com sistema de licenças/keys).
- `Info.plist` (Bundle Identifier, nome do app).

## G. Sistema de patches existente
Gerenciado por `PatchDraftService`, `PatchProjectService`, `PatchTransaction`, `PatchWorkspaceService`.

## H. Sistema de arquivos existente
`FileManagerService`, `FileOperationCoordinator`, `FileReplacementService`, `SecureZIPArchive`, `ZIPArchiveExtractor/Writer`.

## I. Backup/restauração existente
Integrado aos serviços de patches (`PatchProjectStore` e `FileManagerService` parece manipular backups/original).

## J. Dependências
- SwiftUI, UIKit, Foundation.
- Código nativo Objective-C para interação com o sistema.

## K. Licenças
- GPL-3.0 (mantida do 3105).

## L. Riscos de compatibilidade
- Dependências críticas em versões de iOS específicas e exploits de kernel.

## M. Pontos que NÃO devem ser modificados
- Exploit engine (`kexploit/`, `exploit/`).
- Lógica de baixo nível de manipulação de arquivos (serviços em `helpers/`).
- Estrutura de modelos que impactam o sistema de patches.

## N. Plano recomendado para transformar 3105 em Swag-External
1. Renomeação do projeto (interna/meta).
2. Implementação da nova interface sobre a estrutura existente.
3. Inserção do sistema de chaves/licenciamento nos pontos de entrada (App.swift e serviços críticos).
4. Refinamento da navegação e onboarding para o estilo Swag-External.
