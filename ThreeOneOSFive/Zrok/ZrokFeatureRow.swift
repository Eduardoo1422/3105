import SwiftUI

struct ZrokFeatureRow: View {
    @EnvironmentObject var featureManager: ZrokFeatureManager
    let feature: Feature
    
    var body: some View {
        HStack {
            Image(systemName: feature.iconName)
                .foregroundColor(.white)
                .frame(width: 30)
            
            VStack(alignment: .leading) {
                Text(feature.name)
                    .font(.body)
                    .foregroundColor(.white)
                Text(feature.description)
                    .font(.caption)
                    .foregroundColor(.gray)
            }
            
            Spacer()
            
            statusIndicator
        }
        .padding()
        .background(Color.white.opacity(0.05))
        .cornerRadius(10)
    }
    
    @ViewBuilder
    private var statusIndicator: some View {
        switch feature.state {
        case .inactive:
            toggleButton(isOn: false)
        case .active:
            toggleButton(isOn: true)
        case .processing:
            ProgressView()
                .scaleEffect(0.8)
        case .restoring:
            ProgressView()
                .scaleEffect(0.8)
        case .error:
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundColor(.red)
        }
    }
    
    private func toggleButton(isOn: Bool) -> some View {
        Toggle("", isOn: Binding(
            get: { isOn },
            set: { _ in featureManager.toggleFeature(feature) }
        ))
        .labelsHidden()
    }
}
