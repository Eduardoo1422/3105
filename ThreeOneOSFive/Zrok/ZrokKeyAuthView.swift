import SwiftUI
import UIKit

struct ZrokKeyAuthView: View {
    @Binding var isAuthenticated: Bool
    @State private var keyInput: String = ""
    @State private var isLoading: Bool = false
    @State private var errorMessage: String? = nil

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            ScrollView {
                VStack(spacing: 28) {
                    Spacer().frame(height: 50)

                    // App Logo / Brand Icon
                    ZStack {
                        RoundedRectangle(cornerRadius: 24)
                            .fill(Color.orange.opacity(0.15))
                            .frame(width: 84, height: 84)
                            .overlay(
                                RoundedRectangle(cornerRadius: 24)
                                    .stroke(Color.orange.opacity(0.6), lineWidth: 1.5)
                            )
                        Image(systemName: "key.fill")
                            .font(.system(size: 38))
                            .foregroundColor(.orange)
                    }

                    VStack(spacing: 8) {
                        Text("ZROK")
                            .font(.system(size: 28, weight: .bold))
                            .foregroundColor(.white)
                        Text("Authentication Required")
                            .font(.system(size: 14))
                            .foregroundColor(.gray)
                    }

                    // Key Input Card
                    VStack(alignment: .leading, spacing: 14) {
                        Text("Enter your key")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(.orange)

                        TextField("", text: $keyInput, prompt: Text("Enter your key").foregroundColor(.gray))
                            .textFieldStyle(.plain)
                            .padding(14)
                            .background(Color.white.opacity(0.06))
                            .cornerRadius(12)
                            .foregroundColor(.white)
                            .font(.system(size: 15))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(errorMessage != nil ? Color.red.opacity(0.8) : Color.orange.opacity(0.4), lineWidth: 1)
                            )
                            .autocapitalization(.none)
                            .disableAutocorrection(true)

                        if let errorMessage = errorMessage {
                            Text(errorMessage)
                                .font(.system(size: 13))
                                .foregroundColor(.red)
                                .padding(.horizontal, 4)
                        }

                        Button(action: validateKey) {
                            HStack {
                                Spacer()
                                if isLoading {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Text("Confirm")
                                        .font(.system(size: 16, weight: .bold))
                                        .foregroundColor(.white)
                                }
                                Spacer()
                            }
                            .padding(.vertical, 14)
                            .background(
                                LinearGradient(colors: [Color.orange, Color.red], startPoint: .leading, endPoint: .trailing)
                            )
                            .cornerRadius(12)
                            .shadow(color: Color.orange.opacity(0.3), radius: 6, y: 3)
                        }
                        .disabled(isLoading || keyInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                        .opacity((isLoading || keyInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty) ? 0.6 : 1.0)
                    }
                    .padding(24)
                    .background(Color.white.opacity(0.03))
                    .cornerRadius(20)
                    .overlay(
                        RoundedRectangle(cornerRadius: 20)
                            .stroke(Color.white.opacity(0.1), lineWidth: 1)
                    )
                    .padding(.horizontal, 20)

                    Spacer()
                }
                .frame(maxWidth: 420)
                .frame(maxWidth: .infinity)
            }
            .scrollDismissesKeyboard(.interactively)
        }
    }

    private func validateKey() {
        let trimmed = keyInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }

        isLoading = true
        errorMessage = nil

        // Parse key input: expects "keyIdentifier secret" or "keyIdentifier:secret"
        var keyIdentifier = trimmed
        var rawSecret = ""

        if trimmed.contains(" ") {
            let parts = trimmed.split(separator: " ", maxSplits: 1)
            if parts.count == 2 {
                keyIdentifier = String(parts[0])
                rawSecret = String(parts[1])
            }
        } else if trimmed.contains(":") {
            let parts = trimmed.split(separator: ":", maxSplits: 1)
            if parts.count == 2 {
                keyIdentifier = String(parts[0])
                rawSecret = String(parts[1])
            }
        }

        guard !rawSecret.isEmpty else {
            isLoading = false
            errorMessage = "Formato inválido. Insira ID e Secret (ex: ZROK-XXX ZROK-YYY)."
            return
        }

        Task {
            guard let baseURL = ZrokEnvironment.baseURL,
                  let url = URL(string: "\(baseURL)/license/validate") else {
                await MainActor.run {
                    isLoading = false
                    errorMessage = "URL do backend ZROK não configurada."
                }
                return
            }

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.timeoutInterval = 15.0

            let deviceIdentifier = UIDevice.current.identifierForVendor?.uuidString ?? "ios-client-device"

            let payload: [String: Any] = [
                "keyIdentifier": keyIdentifier,
                "rawSecret": rawSecret,
                "deviceIdentifier": deviceIdentifier
            ]

            guard let body = try? JSONSerialization.data(withJSONObject: payload) else {
                await MainActor.run {
                    isLoading = false
                    errorMessage = "Erro ao serializar solicitação de chave."
                }
                return
            }
            request.httpBody = body

            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let httpResponse = response as? HTTPURLResponse else {
                    await MainActor.run {
                        isLoading = false
                        errorMessage = "Resposta inválida do servidor."
                    }
                    return
                }

                if (200...299).contains(httpResponse.statusCode) {
                    // Parse JSON response to verify success structure (strictly require ACTIVE status)
                    if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                       json["status"] as? String == "ACTIVE" {
                        // Persist session ONLY after confirmed valid response
                        let saved = ZrokPatchDownloadManager.saveActivationSession(keyIdentifier: keyIdentifier, rawSecret: rawSecret)
                        await MainActor.run {
                            isLoading = false
                            if saved {
                                isAuthenticated = true
                            } else {
                                errorMessage = "Falha ao salvar credenciais no Keychain seguro."
                            }
                        }
                    } else {
                        await MainActor.run {
                            isLoading = false
                            errorMessage = "Resposta de licença inválida do servidor."
                        }
                    }
                } else {
                    // Extract error message from backend if available
                    var serverErrorMsg = "Key inválida, expirada ou limite excedido (HTTP \(httpResponse.statusCode))"
                    if let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                       let errStr = json["error"] as? String {
                        serverErrorMsg = errStr
                    }
                    await MainActor.run {
                        isLoading = false
                        errorMessage = serverErrorMsg
                    }
                }
            } catch {
                await MainActor.run {
                    isLoading = false
                    errorMessage = "Erro de conexão com o servidor: \(error.localizedDescription)"
                }
            }
        }
    }
}
