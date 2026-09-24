import Foundation

/// Top-level application availability as surfaced by the backend.
/// `unknown` is the local default until the (future) `/api/v1/app/status`
/// endpoint is available or the mock provides a value.
enum AppStatus: Equatable {
    case unknown
    case online(message: String? = nil)
    case offline(reason: String? = nil)
    case maintenance(until: Date? = nil)

    var isOnline: Bool {
        if case .online = self { return true }
        return false
    }

    var displayText: String {
        switch self {
        case .unknown: return "Desconhecido"
        case .online: return "Online"
        case .offline: return "Offline"
        case .maintenance: return "Manutenção"
        }
    }
}

/// License state shown to the user. Internal identifiers (deviceId, licenseId)
/// are intentionally NOT part of this struct so they can never leak to a View.
struct LicenseInfo: Equatable {
    enum Status: Equatable {
        case active
        case expired
        case inactive
        case unknown
    }

    let status: Status
    let daysRemaining: Int?
    let expiresAt: Date?

    var displayStatusText: String {
        switch status {
        case .active: return "Ativa"
        case .expired: return "Expirada"
        case .inactive: return "Inativa"
        case .unknown: return "Desconhecida"
        }
    }
}

/// A compatibility row, e.g. "iOS 18.0 – 18.7.1". Source is local first
/// (`ExploitSupportPolicy`), overridable by the (future) `/api/v1/app/compat`
/// endpoint.
struct CompatibilityEntry: Identifiable, Equatable {
    enum Status: Equatable {
        case supported
        case partial
        case unsupported

        var label: String {
            switch self {
            case .supported: return "Supported"
            case .partial: return "Partial"
            case .unsupported: return "Unsupported"
            }
        }
    }

    let id = UUID()
    let version: String
    let status: Status
    let note: String?
}
