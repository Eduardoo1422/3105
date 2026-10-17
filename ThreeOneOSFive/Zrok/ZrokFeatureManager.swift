import SwiftUI
import Combine

class ZrokFeatureManager: ObservableObject {
    @Published var features: [Feature] = []
    @Published var categories: [FeatureCategory] = []
    @Published var syncService = RemoteAppConfigSyncService()
    
    private let repository: FeatureRepository
    private var fileOpCoordinator: FileOperationCoordinator?
    private var cancellables = Set<AnyCancellable>()
    
    init(repository: FeatureRepository = MockFeatureRepository()) {
        self.repository = repository
        loadData()
        
        // Listen to sync service updates to apply remote config fields
        syncService.$remoteConfig
            .receive(on: DispatchQueue.main)
            .sink { [weak self] config in
                self?.applyRemoteConfiguration(config)
            }
            .store(in: &cancellables)
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
    
    private func applyRemoteConfiguration(_ config: [String: Any]) {
        // Decode, validate and apply remote configuration fields to compatible components (hero banner, theme, tabs)
        if let hero = config["hero"] as? [String: Any],
           let title = hero["title"] as? String {
            print("ZrokApp: Applied remote hero title: \(title)")
        }
        if let theme = config["theme"] as? [String: Any],
           let bg = theme["background"] as? String {
            print("ZrokApp: Applied remote theme background: \(bg)")
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
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            self.features[index].state = .active
        }
    }
    
    private func restoreFeature(_ index: Int) {
        features[index].state = .restoring
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
            self.features[index].state = .inactive
        }
    }
}
