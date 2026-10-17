import SwiftUI

struct ZrokHomeView: View {
    @EnvironmentObject var featureManager: ZrokFeatureManager
    @EnvironmentObject var fileOpCoordinator: FileOperationCoordinator
    
    var body: some View {
        ZStack {
            featureManager.syncService.themeBackground
                .edgesIgnoringSafeArea(.all)
            
            ScrollView {
                VStack(spacing: 20) {
                    ZrokGameHeader(syncService: featureManager.syncService)
                    
                    // Render published dynamic tabs & elements
                    ZrokPublishedTabsView(syncService: featureManager.syncService)
                        .frame(minHeight: 280)
                    
                    ForEach(featureManager.categories) { category in
                        ZrokFeatureSection(category: category)
                    }
                }
                .padding()
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            featureManager.setCoordinator(fileOpCoordinator)
            featureManager.syncService.fetchPublishedConfig(manual: false)
        }
    }
}
