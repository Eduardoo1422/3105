import Foundation

/// Abstraction that feeds categories/features (and later status/license/compat)
/// to the UI. Concrete implementations:
/// - `MockFeatureRepository`  : local, always-available mock (dev + current default)
/// - `APIFeatureRepository`   : real backend client (wired in when the API is ready)
protocol FeatureRepository {
    func fetchCategories() async throws -> [FeatureCategory]
    func fetchFeatures() async throws -> [Feature]
    func fetchAppStatus() async throws -> AppStatus
    func fetchLicenseInfo() async throws -> LicenseInfo
    func fetchCompatibility() async throws -> [CompatibilityEntry]
    func activate(feature: Feature) async throws -> FeatureState
    func deactivate(feature: Feature) async throws -> FeatureState
}

enum RepositoryError: Error, LocalizedError {
    case notImplemented
    case network(Error)
    case decoding(Error)

    var errorDescription: String? {
        switch self {
        case .notImplemented: return "Operação não implementada"
        case .network(let e): return "Erro de rede: \(e.localizedDescription)"
        case .decoding(let e): return "Erro de decodificação: \(e.localizedDescription)"
        }
    }
}

/// Default implementations so a `FeatureRepository` can adopt only the methods
/// it supports (e.g. the mock only overrides `fetchCategories`/`fetchFeatures`/
/// status/license/compat; activation stays as a local mock).
extension FeatureRepository {
    func fetchAppStatus() async throws -> AppStatus { .online() }
    func fetchLicenseInfo() async throws -> LicenseInfo { .init(status: .inactive, daysRemaining: nil, expiresAt: nil) }
    func fetchCompatibility() async throws -> [CompatibilityEntry] { [] }
    func activate(feature: Feature) async throws -> FeatureState { throw RepositoryError.notImplemented }
    func deactivate(feature: Feature) async throws -> FeatureState { throw RepositoryError.notImplemented }
}

// MARK: - Mock (current production default while the API is not ready)

final class MockFeatureRepository: FeatureRepository {
    func fetchCategories() async throws -> [FeatureCategory] {
        // Simulate a tiny network latency.
        try await Task.sleep(nanoseconds: 200_000_000)
        return [
            FeatureCategory(id: "aimbot", name: "AIMBOT", order: 0),
            FeatureCategory(id: "visual", name: "VISUAL", order: 1),
        ]
    }

    func fetchFeatures() async throws -> [Feature] {
        try await Task.sleep(nanoseconds: 200_000_000)
        let categories = try await fetchCategories()
        let aimbot = categories.first { $0.id == "aimbot" }!
        let visual = categories.first { $0.id == "visual" }!
        return [
            Feature(
                featureId: "feat-aimbot-1",
                resourceId: "res-aimbot-1",
                name: "Aim Assist",
                description: "Melhora a precisão",
                category: aimbot,
                iconName: "scope",
                state: .inactive,
                order: 0
            ),
            Feature(
                featureId: "feat-aimbot-2",
                resourceId: "res-aimbot-2",
                name: "No Recoil",
                description: "Remove o recolhimento da arma",
                category: aimbot,
                iconName: "scope",
                state: .inactive,
                order: 1
            ),
            Feature(
                featureId: "feat-visual-1",
                resourceId: "res-visual-1",
                name: "Hologram Vision",
                category: visual,
                iconName: "eye.fill",
                state: .inactive,
                order: 0
            ),
        ]
    }

    // Local mock state while no backend is wired.
    func fetchAppStatus() async throws -> AppStatus { .online() }

    func fetchLicenseInfo() async throws -> LicenseInfo {
        // Static mock license info — NOT a live backend call.
        LicenseInfo(
            status: .active,
            daysRemaining: 29,
            expiresAt: Calendar.current.date(byAdding: .day, value: 29, to: Date())
        )
    }

    func fetchCompatibility() async throws -> [CompatibilityEntry] {
        CompatibilityBuilder.defaultEntries()
    }

    // Mock activation simply flips state; no file operations are performed yet.
    func activate(feature: Feature) async throws -> FeatureState {
        try await Task.sleep(nanoseconds: 200_000_000)
        return .active
    }

    func deactivate(feature: Feature) async throws -> FeatureState {
        try await Task.sleep(nanoseconds: 200_000_000)
        return .inactive
    }
}
