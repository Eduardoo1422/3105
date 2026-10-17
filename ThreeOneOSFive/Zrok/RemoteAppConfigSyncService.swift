import Foundation
import Combine
import SwiftUI
#if canImport(UIKit)
import UIKit
#endif

/// Centralized environment configuration for ZROK backend connectivity.
/// PRODUCTION NOTE: Configure the true HTTPS backend URL via the `ZROK_API_URL`
/// environment variable or Info.plist.
///
/// LOCAL DEVELOPMENT TESTING ON A REAL IPHONE:
/// To test with a backend running on your development computer from a real iPhone:
/// 1. Ensure your Mac/PC and iPhone are on the same Wi-Fi network.
/// 2. Find your computer's local network IP address (e.g. `192.168.1.50`).
/// 3. Set `ZROK_API_URL` to `http://192.168.1.50:3000/api/v1` in your Xcode scheme environment variables.
struct ZrokEnvironment {
    static let developmentBaseURL = "http://localhost:3000/api/v1"
    
    static var baseURL: String? {
        // 1. Check Info.plist for ZrokAPIUrl key
        if let plistUrl = Bundle.main.object(forInfoDictionaryKey: "ZrokAPIUrl") as? String,
           !plistUrl.isEmpty,
           plistUrl.trimmingCharacters(in: .whitespaces) != "",
           plistUrl != "https://api.yourdomain.com/api/v1" {
            return plistUrl
        }
        // 2. Check process environment variable ZROK_API_URL
        if let envUrl = ProcessInfo.processInfo.environment["ZROK_API_URL"], !envUrl.isEmpty {
            return envUrl
        }
        #if DEBUG
        return developmentBaseURL
        #else
        // In RELEASE mode, localhost fallback is prohibited. Return nil if unconfigured.
        return nil
        #endif
    }
}

/// Safe HEX color to SwiftUI Color converter with fallback.
extension Color {
    init(hex: String, fallback: Color = Color.black) {
        let cleaned = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        guard Scanner(string: cleaned).scanHexInt64(&int) else {
            self = fallback
            return
        }
        let r, g, b, a: UInt64
        switch cleaned.count {
        case 3:
            (r, g, b, a) = ((int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17, 255)
        case 6:
            (r, g, b, a) = (int >> 16, int >> 8 & 0xFF, int & 0xFF, 255)
        case 8:
            (r, g, b, a) = (int >> 24 & 0xFF, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            self = fallback
            return
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}

/// Robust service for fetching published ZROK frontend configuration,
/// strictly validating schema before cache update, polling periodically,
/// handling app lifecycle, and reporting verified synchronization status.
class RemoteAppConfigSyncService: ObservableObject {
    @Published var publishedVersion: Int = 1
    @Published var isSyncing: Bool = false
    @Published var lastError: String? = nil
    @Published var lastSyncAt: Date? = nil
    
    // Observable UI configuration properties
    @Published var heroTitle: String = "ZROK Enterprise v2.0"
    @Published var heroSubtitle: String = "Free Fire Advanced Customization & Patch Center"
    
    @Published var themeBackground: Color = Color(hex: "#0b0f19")
    @Published var themeCardBackground: Color = Color(hex: "#131c31")
    @Published var themeTextColor: Color = Color(hex: "#f8fafc")
    @Published var themeSecondaryText: Color = Color(hex: "#94a3b8")
    @Published var themeButtonColor: Color = Color(hex: "#3b82f6")
    @Published var themeAccentColor: Color = Color(hex: "#10b981")
    @Published var themeBorderColor: Color = Color(hex: "#1e293b")
    
    @Published var remoteTabs: [[String: Any]] = []

    private let baseURL: String?
    private let deviceIdentifier: String
    private let userDefaultsConfigKey = "ZrokCachedPublishedConfig"
    private let versionDefaultsKey = "ZrokCachedPublishedVersion"
    
    private var pollTimer: AnyCancellable?
    private var cancellables = Set<AnyCancellable>()

    init(baseURL: String? = ZrokEnvironment.baseURL, deviceIdentifier: String = "iOS-Zrok-Client") {
        self.baseURL = baseURL
        #if canImport(UIKit)
        self.deviceIdentifier = UIDevice.current.identifierForVendor?.uuidString ?? "iOS-Zrok-Client"
        #else
        self.deviceIdentifier = deviceIdentifier
        #endif
        
        loadCachedConfig()
        startPeriodicSync()
        setupLifecycleObservers()
    }

    deinit {
        pollTimer?.cancel()
    }

    /// Fetches published configuration with strict response validation.
    /// ONLY updates version, cache, and marks sync status as 'synced' after full successful validation and application.
    func fetchPublishedConfig(manual: Bool = false) {
        guard !isSyncing else { return }
        guard let resolvedBaseURL = baseURL,
              let url = URL(string: "\(resolvedBaseURL)/config/published") else {
            self.lastError = "Production API URL unconfigured. Provide valid ZrokAPIUrl in Info.plist or ZROK_API_URL environment variable."
            return
        }

        isSyncing = true
        lastError = nil

        URLSession.shared.dataTask(with: url) { [weak self] data, response, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.isSyncing = false

                if let error = error {
                    self.lastError = error.localizedDescription
                    // Preserve last valid configuration; report offline status
                    self.reportSyncStatus(syncedVersion: self.publishedVersion, status: "offline")
                    return
                }

                guard let httpResponse = response as? HTTPURLResponse,
                      (200...299).contains(httpResponse.statusCode) else {
                    self.lastError = "HTTP Error: \((response as? HTTPURLResponse)?.statusCode ?? 500)"
                    // Preserve last valid configuration; report error status
                    self.reportSyncStatus(syncedVersion: self.publishedVersion, status: "error")
                    return
                }

                guard let data = data,
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let version = json["version"] as? Int,
                      let configDict = json["config"] as? [String: Any],
                      let tabs = configDict["tabs"] as? [[String: Any]],
                      let theme = configDict["theme"] as? [String: Any] else {
                    self.lastError = "Invalid or incomplete configuration schema received"
                    // Preserve last valid configuration; report error status
                    self.reportSyncStatus(syncedVersion: self.publishedVersion, status: "error")
                    return
                }

                // 1. Successfully validated. Apply to observable properties.
                self.applyConfiguration(version: version, config: configDict, tabs: tabs, theme: theme)

                // 2. Save to cache only after successful validation and application
                UserDefaults.standard.set(version, forKey: self.versionDefaultsKey)
                UserDefaults.standard.set(data, forKey: self.userDefaultsConfigKey)
                self.lastSyncAt = Date()

                // 3. Report verified synchronization status
                self.reportSyncStatus(syncedVersion: version, status: "synced")
            }
        }.resume()
    }

    private func applyConfiguration(version: Int, config: [String: Any], tabs: [[String: Any]], theme: [String: Any]) {
        self.publishedVersion = version
        self.remoteTabs = tabs

        if let hero = config["hero"] as? [String: Any] {
            if let title = hero["title"] as? String {
                self.heroTitle = title
            }
            if let subtitle = hero["subtitle"] as? String {
                self.heroSubtitle = subtitle
            }
        }

        if let bg = theme["background"] as? String { self.themeBackground = Color(hex: bg, fallback: self.themeBackground) }
        if let cardBg = theme["cardBackground"] as? String { self.themeCardBackground = Color(hex: cardBg, fallback: self.themeCardBackground) }
        if let textCol = theme["textColor"] as? String { self.themeTextColor = Color(hex: textCol, fallback: self.themeTextColor) }
        if let secText = theme["secondaryText"] as? String { self.themeSecondaryText = Color(hex: secText, fallback: self.themeSecondaryText) }
        if let btnCol = theme["buttonColor"] as? String { self.themeButtonColor = Color(hex: btnCol, fallback: self.themeButtonColor) }
        if let accent = theme["accentColor"] as? String { self.themeAccentColor = Color(hex: accent, fallback: self.themeAccentColor) }
        if let border = theme["borderColor"] as? String { self.themeBorderColor = Color(hex: border, fallback: self.themeBorderColor) }
    }

    private func loadCachedConfig() {
        let cachedVersion = UserDefaults.standard.integer(forKey: versionDefaultsKey)
        if cachedVersion > 0 {
            self.publishedVersion = cachedVersion
        }
        if let data = UserDefaults.standard.data(forKey: userDefaultsConfigKey),
           let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let version = json["version"] as? Int,
           let configDict = json["config"] as? [String: Any],
           let tabs = configDict["tabs"] as? [[String: Any]],
           let theme = configDict["theme"] as? [String: Any] {
            applyConfiguration(version: version, config: configDict, tabs: tabs, theme: theme)
        }
    }

    private func startPeriodicSync() {
        pollTimer = Timer.publish(every: 30.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.fetchPublishedConfig(manual: false)
            }
    }

    private func setupLifecycleObservers() {
        #if canImport(UIKit)
        NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)
            .sink { [weak self] _ in
                self?.fetchPublishedConfig(manual: false)
            }
            .store(in: &cancellables)
        #endif
    }

    private func reportSyncStatus(syncedVersion: Int, status: String) {
        guard let resolvedBaseURL = baseURL,
              let url = URL(string: "\(resolvedBaseURL)/device/sync-status") else { return }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10.0

        let payload: [String: Any] = [
            "deviceIdentifier": deviceIdentifier,
            "platform": "iOS",
            "appVersion": "1.0.1",
            "syncedVersion": syncedVersion,
            "syncStatus": status
        ]

        guard let httpBody = try? JSONSerialization.data(withJSONObject: payload) else { return }
        request.httpBody = httpBody

        URLSession.shared.dataTask(with: request).resume()
    }
}
