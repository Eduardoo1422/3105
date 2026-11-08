import SwiftUI

struct SwagFunctionsView: View {
    @EnvironmentObject var featureManager: ZrokFeatureManager
    @State private var toggleStates: [String: Bool] = [
        "hs_alto": false,
        "hs_pescoco": false,
        "hs_peito": false,
        "holograma_armas": false
    ]

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Header Brand
                    HStack {
                        Spacer()
                        Text("SWAG-EXTERNAL")
                            .font(.system(size: 13, weight: .bold))
                            .italic()
                            .foregroundColor(.white)
                        Spacer()
                    }
                    .overlay(alignment: .trailing) {
                        Button(action: {}) {
                            Image(systemName: "waveform.path.ecg")
                                .font(.system(size: 15, weight: .medium))
                                .foregroundColor(.orange)
                                .frame(width: 36, height: 36)
                                .background(Color.white.opacity(0.06))
                                .clipShape(Circle())
                                .overlay(
                                    Circle().stroke(Color.orange.opacity(0.4), lineWidth: 1)
                                )
                        }
                    }
                    .padding(.horizontal)
                    .padding(.top, 8)

                    // Title & Status
                    VStack(alignment: .leading, spacing: 6) {
                        Text("FUNÇÕES")
                            .font(.system(size: 34, weight: .bold))
                            .foregroundColor(.white)

                        HStack(spacing: 6) {
                            Circle()
                                .fill(Color.green)
                                .frame(width: 8, height: 8)
                            Text("Pronto para injetar")
                                .font(.system(size: 14))
                                .foregroundColor(.gray)
                        }
                    }
                    .padding(.horizontal)

                    // Section: Selecione o Jogo
                    VStack(alignment: .leading, spacing: 10) {
                        Text("SELECIONE O JOGO")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.gray)
                            .padding(.horizontal)

                        VStack(spacing: 10) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(LinearGradient(colors: [Color.orange, Color.red], startPoint: .topLeading, endPoint: .bottomTrailing))
                                    .frame(width: 56, height: 56)
                                Image(systemName: "gamecontroller.fill")
                                    .font(.system(size: 26))
                                    .foregroundColor(.white)
                            }
                            .shadow(radius: 4)

                            Text("FREE FIRE")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.white)

                            Text("Selecionado")
                                .font(.system(size: 13))
                                .foregroundColor(.gray)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 22)
                        .background(Color.white.opacity(0.03))
                        .cornerRadius(16)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                        )
                        .padding(.horizontal)
                    }

                    // Section: Funções de Aimbot
                    VStack(alignment: .leading, spacing: 10) {
                        Text("FUNÇÕES DE AIMBOT")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.gray)
                            .padding(.horizontal)

                        VStack(spacing: 0) {
                            functionRow(
                                icon: "scope",
                                title: "HS ALTO",
                                subtitle: "HS Acima da Cabeça do Inimigo.",
                                key: "hs_alto"
                            )
                            Divider().background(Color.white.opacity(0.1))
                            functionRow(
                                icon: "scope",
                                title: "HS PESCOÇO",
                                subtitle: "HS Apenas no Pescoço do Inimigo.",
                                key: "hs_pescoco"
                            )
                            Divider().background(Color.white.opacity(0.1))
                            functionRow(
                                icon: "scope",
                                title: "HS PEITO",
                                subtitle: "HS no Peito do Inimigo.",
                                key: "hs_peito"
                            )
                        }
                        .background(Color.white.opacity(0.03))
                        .cornerRadius(16)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                        )
                        .padding(.horizontal)
                    }

                    // Section: Funções de Holograma
                    VStack(alignment: .leading, spacing: 10) {
                        Text("FUNÇÕES DE HOLOGRAMA")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.gray)
                            .padding(.horizontal)

                        VStack(spacing: 0) {
                            functionRow(
                                icon: "sparkles",
                                title: "HOLOGRAMA ARMAS",
                                subtitle: "Usar Gráfico no Padrão Para Funcionar.",
                                key: "holograma_armas"
                            )
                        }
                        .background(Color.white.opacity(0.03))
                        .cornerRadius(16)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16)
                                .stroke(Color.gray.opacity(0.2), lineWidth: 1)
                        )
                        .padding(.horizontal)
                    }

                    Spacer().frame(height: 100)
                }
            }
        }
    }

    private func functionRow(icon: String, title: String, subtitle: String, key: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(.white)
                .frame(width: 32)

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(.white)
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundColor(.gray)
            }

            Spacer()

            Toggle("", isOn: Binding(
                get: { toggleStates[key] ?? false },
                set: { newValue in
                    toggleStates[key] = newValue
                    // Trigger dynamic feature toggle / patch management if matching feature exists
                    if let feature = featureManager.features.first(where: { $0.name.lowercased().contains(title.lowercased()) || $0.featureId.contains(key) }) {
                        featureManager.toggleFeature(feature)
                    }
                }
            ))
            .labelsHidden()
            .toggleStyle(SwitchToggleStyle(tint: .orange))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }
}
