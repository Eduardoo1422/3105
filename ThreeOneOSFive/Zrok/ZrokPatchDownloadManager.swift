import Foundation
import Combine
#if canImport(UIKit)
import UIKit
#endif

enum PatchDownloadError: LocalizedError {
    case unactivated
    case invalidURL
    case networkError(Error)
    case unauthorized(String)
    case serverError(Int)
    case decodingError(Error)
    case applicationError(Error)

    var errorDescription: String? {
        switch self {
        case .unactivated:
            return "Aplicativo não ativado. Insira uma licença válida na aba de Ativação."
        case .invalidURL:
            return "URL de download inválida ou não configurada."
        case .networkError(let err):
            return "Erro de rede: \(err.localizedDescription)"
        case .unauthorized(let msg):
            return "Não autorizado: \(msg)"
        case .serverError(let code):
            return "Erro no servidor (código \(code))."
        case .decodingError(let err):
            return "Erro ao decodificar pacote .3105: \(err.localizedDescription)"
        case .applicationError(let err):
            return "Erro ao aplicar patch no dispositivo: \(err.localizedDescription)"
        }
    }
}

/// Bridges remote ZROK published resource download with the original 3105 PatchPackageCodec and DevicePatchService.
class ZrokPatchDownloadManager {
    static let shared = ZrokPatchDownloadManager()

    private init() {}

    /// Helper to store active activation session credentials securely (identifier in UserDefaults, secret in Keychain). Returns true only if Keychain save succeeds.
    @discardableResult
    static func saveActivationSession(keyIdentifier: String, rawSecret: String) -> Bool {
        UserDefaults.standard.set(keyIdentifier, forKey: "ZrokKeyIdentifier")
        return ZrokKeychainStore.saveSecret(rawSecret)
    }

    /// Requests download of a published .3105 package, validates magic bytes ("3105PATCH\0"), decodes via PatchPackageCodec,
    /// and applies via DevicePatchService asynchronously off the main queue.
    func downloadAndApplyPatch(
        resourceID: String,
        baseURL: String? = ZrokEnvironment.baseURL,
        completion: @escaping (Result<PatchTransactionReceipt, PatchDownloadError>) -> Void
    ) {
        // Require real activation credentials from UserDefaults (keyIdentifier) and Keychain (rawSecret)
        guard let keyIdentifier = UserDefaults.standard.string(forKey: "ZrokKeyIdentifier"), !keyIdentifier.isEmpty,
              let rawSecret = ZrokKeychainStore.loadSecret(), !rawSecret.isEmpty else {
            DispatchQueue.main.async { completion(.failure(.unactivated)) }
            return
        }

        #if canImport(UIKit)
        let deviceIdentifier = UIDevice.current.identifierForVendor?.uuidString ?? {
            if let stored = UserDefaults.standard.string(forKey: "ZrokDeviceUUID") {
                return stored
            }
            let newID = UUID().uuidString
            UserDefaults.standard.set(newID, forKey: "ZrokDeviceUUID")
            return newID
        }()
        #else
        let deviceIdentifier = "simulator-device"
        #endif

        guard let resolvedBaseURL = baseURL, !resolvedBaseURL.isEmpty,
              let url = URL(string: "\(resolvedBaseURL)/client/resource/\(resourceID)/download") else {
            DispatchQueue.main.async { completion(.failure(.invalidURL)) }
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30.0

        let payload: [String: Any] = [
            "keyIdentifier": keyIdentifier,
            "rawSecret": rawSecret,
            "deviceIdentifier": deviceIdentifier
        ]

        guard let body = try? JSONSerialization.data(withJSONObject: payload) else {
            DispatchQueue.main.async { completion(.failure(.unauthorized("Falha ao serializar credenciais de autenticação"))) }
            return
        }
        request.httpBody = body

        // Perform async network transfer, magic bytes validation, decoding, and patch application off the main thread
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                DispatchQueue.main.async { completion(.failure(.networkError(error))) }
                return
            }

            guard let httpResponse = response as? HTTPURLResponse, let data = data else {
                DispatchQueue.main.async { completion(.failure(.serverError(500))) }
                return
            }

            if !(200...299).contains(httpResponse.statusCode) {
                let errorStatus: PatchDownloadError
                if httpResponse.statusCode == 401 || httpResponse.statusCode == 403 {
                    errorStatus = .unauthorized("Licença inválida, expirada ou dispositivo não autorizado")
                } else {
                    errorStatus = .serverError(httpResponse.statusCode)
                }
                DispatchQueue.main.async { completion(.failure(errorStatus)) }
                return
            }

            // Perform CPU-intensive decoding and application on background queue
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    // Validate .3105 package magic bytes: exact 10 bytes "3105PATCH\0"
                    let magic = Data("3105PATCH\0".utf8)
                    guard data.count >= magic.count, data.prefix(magic.count) == magic else {
                        throw NSError(domain: "ZrokPatch", code: -10, userInfo: [NSLocalizedDescriptionKey: "Invalid .3105 package: header magic bytes verification failed"])
                    }

                    // 1. Verify and decode using original 3105 PatchPackageCodec
                    let decodedPackage = try PatchPackageCodec.decode(data, password: nil)
                    
                    // 2. Apply patch using original 3105 DevicePatchService
                    let receipt = try DevicePatchService.apply(project: decodedPackage.project)
                    
                    DispatchQueue.main.async {
                        completion(.success(receipt))
                    }
                } catch let decodeErr as PatchPackageError {
                    DispatchQueue.main.async {
                        completion(.failure(.decodingError(decodeErr)))
                    }
                } catch let appErr {
                    DispatchQueue.main.async {
                        completion(.failure(.applicationError(appErr)))
                    }
                }
            }
        }.resume()
    }

    /// Restores a previously applied patch using the original 3105 DevicePatchService.
    func restorePatch(receipt: PatchTransactionReceipt) -> Result<Void, PatchDownloadError> {
        do {
            try DevicePatchService.restore(receipt: receipt)
            return .success(())
        } catch {
            return .failure(.applicationError(error))
        }
    }
}
