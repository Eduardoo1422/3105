import SwiftUI

struct ZrokFeatureSection: View {
    @EnvironmentObject var featureManager: ZrokFeatureManager
    let category: FeatureCategory
    
    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            Text(category.name)
                .font(.headline)
                .foregroundColor(.white)
            
            ForEach(featureManager.features.filter { $0.category == category }) { feature in
                ZrokFeatureRow(feature: feature)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
