import SwiftUI

struct ZrokHomeView: View {
    @EnvironmentObject var featureManager: ZrokFeatureManager
    @EnvironmentObject var fileOpCoordinator: FileOperationCoordinator
    @EnvironmentObject var patchStore: PatchProjectStore
    @EnvironmentObject var repositoryStore: PackageRepositoryStore
    @State private var selectedTab = 0

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black.ignoresSafeArea()

            // Main Tab Content
            Group {
                switch selectedTab {
                case 0:
                    SwagFunctionsView()
                case 1:
                    NavigationStack {
                        FileBrowserView(
                            containerPath: (try? PatchWorkspaceService.documentsRootURL().path) ?? NSHomeDirectory(),
                            title: "Files"
                        )
                    }
                case 2:
                    NavigationStack {
                        PatchProjectsView()
                    }
                case 3:
                    NavigationStack {
                        CleanerView()
                    }
                case 4:
                    NavigationStack {
                        WallpaperLabView()
                    }
                default:
                    SwagFunctionsView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // Bottom Navigation Capsule Bar (Matching reference 3105-navegacao.jpg)
            SwagBottomNavView(selectedTab: $selectedTab)
        }
        .preferredColorScheme(.dark)
        .onAppear {
            featureManager.setCoordinator(fileOpCoordinator)
            featureManager.syncService.fetchPublishedConfig(manual: false)
        }
    }
}
