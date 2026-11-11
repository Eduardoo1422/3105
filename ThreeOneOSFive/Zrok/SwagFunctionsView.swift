import SwiftUI

struct SwagFunctionsView: View {
    @EnvironmentObject var featureManager: ZrokFeatureManager
    @State private var toggleStates: [String: Bool] = [
        "hs_alto": false,
        "hs_pescoco": false,
        "hs_peito": false,
        "hs_barriga": false,
        "hs_pescoco_antena": false,
        "hs_saci": false
    ]
    @State private var patchReceipts: [String: PatchTransactionReceipt] = [:]
    @State private var alertMessage: String? = nil
    @State private var showAlert = false

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    // Header Brand
                    HStack {
                        Spacer()
                        Text("ZROK")
                            .font(.system(size: 15, weight: .bold))
                            .tracking(2)
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

                    // Section: Selecione o Jogo (Free Fire with original free-fire-foto.jpeg)
                    VStack(alignment: .leading, spacing: 10) {
                        Text("SELECIONE O JOGO")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.gray)
                            .padding(.horizontal)

                        VStack(spacing: 12) {
                            ZStack {
                                Image("free-fire")
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 64, height: 64)
                                    .clipShape(RoundedRectangle(cornerRadius: 16))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 16)
                                            .stroke(Color.orange, lineWidth: 2)
                                    )
                            }
                            .shadow(color: Color.orange.opacity(0.3), radius: 6)

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

                    // Section: Funções de Patches (6 items)
                    VStack(alignment: .leading, spacing: 10) {
                        Text("FUNÇÕES DE PATCHES")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.gray)
                            .padding(.horizontal)

                        VStack(spacing: 0) {
                            functionRow(
                                icon: "scope",
                                title: "HS ALTO",
                                subtitle: "HS Acima da Cabeça do Inimigo.",
                                key: "hs_alto",
                                resourceName: "HS ALTO"
                            )
                            Divider().background(Color.white.opacity(0.1))
                            functionRow(
                                icon: "scope",
                                title: "HS PESCOÇO",
                                subtitle: "HS Apenas no Pescoço do Inimigo.",
                                key: "hs_pescoco",
                                resourceName: "HS PESCOÇO"
                            )
                            Divider().background(Color.white.opacity(0.1))
                            functionRow(
                                icon: "scope",
                                title: "HS PEITO",
                                subtitle: "HS no Peito do Inimigo.",
                                key: "hs_peito",
                                resourceName: "HS PEITO"
                            )
                            Divider().background(Color.white.opacity(0.1))
                            functionRow(
                                icon: "scope",
                                title: "HS BARRIGA",
                                subtitle: "HS na Barriga do Inimigo.",
                                key: "hs_barriga",
                                resourceName: "HS BARRIGA"
                            )
                            Divider().background(Color.white.opacity(0.1))
                            functionRow(
                                icon: "scope",
                                title: "HS PESCOÇO + ANTENA",
                                subtitle: "HS no Pescoço com Antena Ativa.",
                                key: "hs_pescoco_antena",
                                resourceName: "HS PESCOÇO-ANTENA"
                            )
                            Divider().background(Color.white.opacity(0.1))
                            functionRow(
                                icon: "scope",
                                title: "HS SACI",
                                subtitle: "HS Movimento Saci do Inimigo.",
                                key: "hs_saci",
                                resourceName: "HS SACI"
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
        .alert(isPresented: $showAlert) {
            Alert(title: Text("ZROK Patch"), message: Text(alertMessage ?? "Operação concluída"), dismissButton: .default(Text("OK")))
        }
    }

    private func functionRow(icon: String, title: String, subtitle: String, key: String, resourceName: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundColor(.orange)
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
                    if newValue {
                        activatePatch(key: key, resourceName: resourceName, title: title)
                    } else {
                        restorePatch(key: key, title: title)
                    }
                }
            ))
            .labelsHidden()
            .toggleStyle(SwitchToggleStyle(tint: .orange))
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }

    private func activatePatch(key: String, resourceName: String, title: String) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                // Load embedded .3105 file from bundle Resources
                guard let url = Bundle.main.url(forResource: resourceName, withExtension: "3105") else {
                    throw NSError(domain: "ZrokPatch", code: -1, userInfo: [NSLocalizedDescriptionKey: "Arquivo .3105 não encontrado para \(title)"])
                }

                let data = try Data(contentsOf: url)
                let magic = Data("3105PATCH\0".utf8)
                guard data.count >= magic.count, data.prefix(magic.count) == magic else {
                    throw NSError(domain: "ZrokPatch", code: -10, userInfo: [NSLocalizedDescriptionKey: "Assinatura do arquivo .3105 inválida"])
                }

                let decoded = try PatchPackageCodec.decode(data, password: nil)
                let receipt = try DevicePatchService.apply(project: decoded.project)

                DispatchQueue.main.async {
                    patchReceipts[key] = receipt
                    alertMessage = "✓ \(title) ativado com sucesso!"
                    showAlert = true
                }
            } catch {
                DispatchQueue.main.async {
                    toggleStates[key] = false
                    alertMessage = "Erro ao ativar \(title): \(error.localizedDescription)"
                    showAlert = true
                }
            }
        }
    }

    private func restorePatch(key: String, title: String) {
        guard let receipt = patchReceipts[key] else {
            // If no receipt recorded yet, perform clean local state toggle off
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try DevicePatchService.restore(receipt: receipt)
                DispatchQueue.main.async {
                    patchReceipts.removeValue(forKey: key)
                    alertMessage = "✓ \(title) restaurado com sucesso!"
                    showAlert = true
                }
            } catch {
                DispatchQueue.main.async {
                    toggleStates[key] = true
                    alertMessage = "Erro ao restaurar \(title): \(error.localizedDescription)"
                    showAlert = true
                }
            }
        }
    }
}
