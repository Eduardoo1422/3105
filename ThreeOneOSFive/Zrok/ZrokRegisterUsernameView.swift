import SwiftUI

struct ZrokRegisterUsernameView: View {
    let licenseId: String
    @Binding var isAuthenticated: Bool
    @State private var username: String = ""
    @State private var isLoading: Bool = false
    @State private var errorMessage: String? = nil

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            VStack(spacing: 28) {
                Spacer().frame(height: 40)

                VStack(spacing: 12) {
                    Text("CRIAR PERFIL")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(.white)
                    
                    Text("Escolha seu nome de usuário para concluir o cadastro.")
                        .font(.system(size: 14))
                        .foregroundColor(.gray)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 20)
                }

                VStack(alignment: .leading, spacing: 14) {
                    Text("Nome de usuário")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.orange)

                    TextField("", text: $username, prompt: Text("Mínimo 3 caracteres").foregroundColor(.gray))
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

                    Button(action: registerUsername) {
                        HStack {
                            Spacer()
                            if isLoading {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("Confirmar")
                                    .font(.system(size: 16, weight: .bold))
                                    .foregroundColor(.white)
                            }
                            Spacer()
                        }
                        .padding(.vertical, 14)
                        .background(Color.orange)
                        .cornerRadius(12)
                    }
                    .disabled(isLoading || username.count < 3)
                    .opacity((isLoading || username.count < 3) ? 0.6 : 1.0)
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
        .onTapGesture {
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
        }
    }

    private func registerUsername() {
        let trimmed = username.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 3 else { return }

        isLoading = true
        errorMessage = nil

        Task {
            guard let baseURL = ZrokEnvironment.baseURL,
                  let url = URL(string: "\(baseURL)/license/register-username") else {
                await MainActor.run {
                    isLoading = false
                    errorMessage = "URL do backend ZROK não configurada."
                }
                return
            }

            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")

            let deviceIdentifier = UIDevice.current.identifierForVendor?.uuidString ?? "ios-client-device"
            let usernameToken = UserDefaults.standard.string(forKey: "ZrokUsernameToken") ?? ""

            let payload: [String: Any] = [
                "licenseId": licenseId,
                "username": trimmed,
                "deviceIdentifier": deviceIdentifier,
                "usernameToken": usernameToken
            ]

            guard let body = try? JSONSerialization.data(withJSONObject: payload) else {
                await MainActor.run {
                    isLoading = false
                    errorMessage = "Erro ao serializar cadastro."
                }
                return
            }
            request.httpBody = body

            do {
                let (data, response) = try await URLSession.shared.data(for: request)
                guard let httpResponse = response as? HTTPURLResponse else {
                    await MainActor.run {
                        isLoading = false
                        errorMessage = "Resposta inválida."
                    }
                    return
                }

                if (200...299).contains(httpResponse.statusCode) {
                    UserDefaults.standard.removeObject(forKey: "ZrokUsernameToken")
                    UserDefaults.standard.removeObject(forKey: "ZrokLicenseId")
                    await MainActor.run {
                        isLoading = false
                        isAuthenticated = true
                    }
                } else {
                    var serverErrorMsg = "Erro ao cadastrar usuário."
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
                    errorMessage = "Erro de conexão: \(error.localizedDescription)"
                }
            }
        }
    }
}
