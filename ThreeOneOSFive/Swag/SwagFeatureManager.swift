import SwiftUI
import Combine

class SwagFeatureManager: ObservableObject {
    @Published var features: [Feature] = []
    @Published var categories: [FeatureCategory] = []
    
    private let repository: FeatureRepository
    private var fileOpCoordinator: FileOperationCoordinator?
    
    init(repository: FeatureRepository = MockFeatureRepository()) {
        self.repository = repository
        loadData()
    }
    
    func setCoordinator(_ coordinator: FileOperationCoordinator) {
        self.fileOpCoordinator = coordinator
    }
    
    func loadData() {
        Task {
            do {
                let fetchedCategories = try await repository.fetchCategories()
                let fetchedFeatures = try await repository.fetchFeatures()
                await MainActor.run {
                    self.categories = fetchedCategories
                    self.features = fetchedFeatures
                }
            } catch {
                print("Error loading data: \(error)")
            }
        }
    }
    
    func toggleFeature(_ feature: Feature) {
        guard let index = features.firstIndex(where: { $0.id == feature.id }) else { return }
        
        switch features[index].state {
        case .inactive:
            activateFeature(index)
        case .active:
            restoreFeature(index)
        default:
            break
        }
    }
    
    private func activateFeature(_ index: Int) {
        features[index].state = .processing
        
        // Operação futura: Usar self.fileOpCoordinator e metadados da feature
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            self.features[index].state = .active
        }
    }
    
    private func restoreFeature(_ index: Int) {
        features[index].state = .restoring
        
        // Operação futura
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            self.features[index].state = .inactive
        }
    }
}
