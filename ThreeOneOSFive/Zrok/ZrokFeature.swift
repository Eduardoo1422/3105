import Foundation

/// Runtime lifecycle of a feature toggle as seen from the UI.
/// Mirrors the internal concept used by the previous implementation; the real
/// persistence/activation will eventually be driven by the backend, but the
/// UI state machine stays local.
enum FeatureState: Equatable {
    case inactive
    case processing
    case active
    case restoring
    case error(String)

    var isProcessing: Bool {
        switch self {
        case .processing, .restoring: return true
        default: return false
        }
    }
}

/// A grouping of features, sourced from the backend (categories endpoint).
struct FeatureCategory: Identifiable, Equatable {
    let id: String
    let name: String
    let order: Int
    let iconName: String?

    init(id: String, name: String, order: Int = 0, iconName: String? = nil) {
        self.id = id
        self.name = name
        self.order = order
        self.iconName = iconName
    }
}

/// A single activatable feature.
///
/// Public UI-facing fields: `name`, `description`, `category`, `iconName`,
/// `state`, `version`.
///
/// Internal replacement metadata (`targetBundleId`, `targetRelativePath`,
/// `targetFilename`, `storageKey`): these are kept on the model strictly so the
/// `ZrokFeatureManager` can hand them to `FileReplacementService` later. They
/// are **never** surfaced to any View.
struct Feature: Identifiable, Equatable {
    let id: UUID
    let featureId: String
    let resourceId: String?
    let name: String
    let description: String?
    let category: FeatureCategory
    let iconName: String
    var state: FeatureState
    let version: String?
    let updatedAt: Date?
    let order: Int

    // Internal (not exposed in UI):
    let targetBundleId: String?
    let targetRelativePath: String?
    let targetFilename: String?
    let storageKey: String?

    init(
        id: UUID = UUID(),
        featureId: String,
        resourceId: String? = nil,
        name: String,
        description: String? = nil,
        category: FeatureCategory,
        iconName: String,
        state: FeatureState = .inactive,
        version: String? = nil,
        updatedAt: Date? = nil,
        order: Int = 0,
        targetBundleId: String? = nil,
        targetRelativePath: String? = nil,
        targetFilename: String? = nil,
        storageKey: String? = nil
    ) {
        self.id = id
        self.featureId = featureId
        self.resourceId = resourceId
        self.name = name
        self.description = description
        self.category = category
        self.iconName = iconName
        self.state = state
        self.version = version
        self.updatedAt = updatedAt
        self.order = order
        self.targetBundleId = targetBundleId
        self.targetRelativePath = targetRelativePath
        self.targetFilename = targetFilename
        self.storageKey = storageKey
    }
}
