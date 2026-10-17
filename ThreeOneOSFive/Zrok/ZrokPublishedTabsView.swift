import SwiftUI

struct ZrokPublishedTabsView: View {
    @ObservedObject var syncService: RemoteAppConfigSyncService
    @State private var activeTabId: String = ""
    @State private var toggleStates: [String: Bool] = [:]
    @State private var actionStatus: [String: String] = [:]
    @State private var isExecutingAction: [String: Bool] = [:]

    var body: some View {
        VStack(spacing: 0) {
            // Tab Selector Bar
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(syncService.remoteTabs.indices, id: \.self) { idx in
                        let tab = syncService.remoteTabs[idx]
                        if let id = tab["id"] as? String,
                           let name = tab["name"] as? String,
                           let icon = tab["icon"] as? String {
                            Button {
                                activeTabId = id
                            } label: {
                                HStack(spacing: 6) {
                                    Text(icon)
                                    Text(name)
                                        .font(.subheadline.bold())
                                }
                                .padding(.horizontal, 14)
                                .padding(.vertical, 8)
                                .background(activeTabId == id ? syncService.themeButtonColor : syncService.themeCardBackground)
                                .foregroundColor(syncService.themeTextColor)
                                .cornerRadius(8)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(syncService.themeBorderColor, lineWidth: 1)
                                )
                            }
                        }
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 8)
            }
            .background(syncService.themeCardBackground.opacity(0.5))

            // Elements of Active Tab
            ScrollView {
                VStack(spacing: 12) {
                    let currentTab = syncService.remoteTabs.first(where: { ($0["id"] as? String) == activeTabId }) ?? syncService.remoteTabs.first
                    if let currentTab = currentTab,
                       let elements = currentTab["elements"] as? [[String: Any]] {
                        ForEach(elements.indices, id: \.self) { idx in
                            let elem = elements[idx]
                            let elemId = elem["id"] as? String ?? "elem-\(idx)"
                            let name = elem["name"] as? String ?? "Function"
                            let desc = elem["description"] as? String ?? ""
                            let icon = elem["icon"] as? String ?? "⚡"
                            let type = elem["type"] as? String ?? "toggle"
                            let defaultEnabled = elem["enabled"] as? Bool ?? true
                            let resourceId = elem["resourceId"] as? String ?? elemId

                            elementView(
                                id: elemId,
                                resourceId: resourceId,
                                type: type,
                                name: name,
                                description: desc,
                                icon: icon,
                                defaultEnabled: defaultEnabled
                            )
                        }
                    } else {
                        Text("Nenhum elemento publicado nesta aba.")
                            .foregroundColor(syncService.themeSecondaryText)
                            .padding(.top, 40)
                    }
                }
                .padding()
            }
        }
        .background(syncService.themeBackground)
        .onAppear {
            if activeTabId.isEmpty, let first = syncService.remoteTabs.first, let id = first["id"] as? String {
                activeTabId = id
            }
            initializeToggleStates()
        }
        .onChange(of: syncService.remoteTabs) { newTabs in
            if activeTabId.isEmpty, let first = newTabs.first, let id = first["id"] as? String {
                activeTabId = id
            }
            initializeToggleStates()
        }
    }

    private func initializeToggleStates() {
        for tab in syncService.remoteTabs {
            if let elements = tab["elements"] as? [[String: Any]] {
                for elem in elements {
                    if let id = elem["id"] as? String, let enabled = elem["enabled"] as? Bool {
                        if toggleStates[id] == nil {
                            toggleStates[id] = enabled
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func elementView(id: String, resourceId: String, type: String, name: String, description: String, icon: String, defaultEnabled: Bool) -> some View {
        let isEnabledBinding = Binding<Bool>(
            get: { toggleStates[id] ?? defaultEnabled },
            setValue: { newValue in toggleStates[id] = newValue }
        )

        let statusText = actionStatus[id]
        let loading = isExecutingAction[id] ?? false

        switch type {
        case "separator":
            Divider()
                .background(syncService.themeBorderColor)
                .padding(.vertical, 4)

        case "card":
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 8) {
                    Text(icon)
                        .font(.title3)
                    Text(name)
                        .font(.headline)
                        .foregroundColor(syncService.themeTextColor)
                }
                if !description.isEmpty {
                    Text(description)
                        .font(.subheadline)
                        .foregroundColor(syncService.themeSecondaryText)
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(syncService.themeCardBackground)
            .cornerRadius(12)
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(syncService.themeBorderColor, lineWidth: 1)
            )

        case "info":
            HStack(spacing: 12) {
                Text(icon)
                    .font(.title2)
                VStack(alignment: .leading, spacing: 2) {
                    Text(name)
                        .font(.subheadline.bold())
                        .foregroundColor(syncService.themeTextColor)
                    if !description.isEmpty {
                        Text(description)
                            .font(.caption)
                            .foregroundColor(syncService.themeSecondaryText)
                    }
                }
                Spacer()
                Text("INFO")
                    .font(.caption2.bold())
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(syncService.themeAccentColor.opacity(0.2))
                    .foregroundColor(syncService.themeAccentColor)
                    .cornerRadius(6)
            }
            .padding(12)
            .background(syncService.themeCardBackground)
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(syncService.themeBorderColor, lineWidth: 1)
            )

        case "action":
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 12) {
                    Text(icon)
                        .font(.title2)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(name)
                            .font(.subheadline.bold())
                            .foregroundColor(syncService.themeTextColor)
                        if !description.isEmpty {
                            Text(description)
                                .font(.caption)
                                .foregroundColor(syncService.themeSecondaryText)
                        }
                    }
                    Spacer()
                    Button(action: {
                        isExecutingAction[id] = true
                        actionStatus[id] = nil
                        
                        // Execute download and apply via ZrokPatchDownloadManager securely using active session credentials
                        ZrokPatchDownloadManager.shared.downloadAndApplyPatch(
                            resourceID: resourceId
                        ) { result in
                            isExecutingAction[id] = false
                            switch result {
                            case .success(_):
                                actionStatus[id] = "✓ Aplicado com sucesso"
                            case .failure(let error):
                                actionStatus[id] = "⚠️ Erro: \(error.localizedDescription)"
                            }
                        }
                    }) {
                        if loading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                .frame(width: 40, height: 24)
                        } else {
                            Text("Executar")
                                .font(.caption.bold())
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(syncService.themeButtonColor)
                                .foregroundColor(.white)
                                .cornerRadius(6)
                        }
                    }
                    .disabled(loading)
                }

                if let status = statusText {
                    Text(status)
                        .font(.caption2)
                        .foregroundColor(status.contains("✓") ? syncService.themeAccentColor : .red)
                        .padding(.top, 2)
                }
            }
            .padding(12)
            .background(syncService.themeCardBackground)
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(syncService.themeBorderColor, lineWidth: 1)
            )

        default: // "toggle"
            HStack(spacing: 12) {
                Text(icon)
                    .font(.title2)
                VStack(alignment: .leading, spacing: 2) {
                    Text(name)
                        .font(.subheadline.bold())
                        .foregroundColor(syncService.themeTextColor)
                    if !description.isEmpty {
                        Text(description)
                            .font(.caption)
                            .foregroundColor(syncService.themeSecondaryText)
                    }
                }
                Spacer()
                Toggle("", isOn: isEnabledBinding)
                    .labelsHidden()
                    .tint(syncService.themeButtonColor)
            }
            .padding(12)
            .background(syncService.themeCardBackground)
            .cornerRadius(10)
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(syncService.themeBorderColor, lineWidth: 1)
            )
        }
    }
}
