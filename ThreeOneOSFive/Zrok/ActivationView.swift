import SwiftUI

struct ZrokHomeView: View {
    @EnvironmentObject var featureManager: ZrokFeatureManager
    @EnvironmentObject var fileOpCoordinator: FileOperationCoordinator
    
    var body: some View {
        ZStack {
            Color.black.edgesIgnoringSafeArea(.all)
            
            ScrollView {
                VStack(spacing: 30) {
                    ZrokGameHeader()
                    
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
        }
    }
}
