import SwiftUI

struct SwagHomeView: View {
    @EnvironmentObject var featureManager: SwagFeatureManager
    @EnvironmentObject var fileOpCoordinator: FileOperationCoordinator
    
    var body: some View {
        ZStack {
            Color.black.edgesIgnoringSafeArea(.all)
            
            ScrollView {
                VStack(spacing: 30) {
                    SwagGameHeader()
                    
                    ForEach(featureManager.categories) { category in
                        SwagFeatureSection(category: category)
                    }
                }
                .padding()
            }
        }
        .preferredColorScheme(.dark)
        .onAppear {
            featureManager.setCoordinator(fileOpCoordinator)
        }
    }
}
