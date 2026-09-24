import SwiftUI

struct SwagFeatureSection: View {
    @EnvironmentObject var featureManager: SwagFeatureManager
    let category: FeatureCategory
    
    var body: some View {
        VStack(alignment: .leading, spacing: 15) {
            Text(category.name)
                .font(.headline)
                .foregroundColor(.white)
            
            ForEach(featureManager.features.filter { $0.category == category }) { feature in
                SwagFeatureRow(feature: feature)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
