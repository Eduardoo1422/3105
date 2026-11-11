import SwiftUI

struct ZrokHomeView: View {
    @EnvironmentObject var featureManager: ZrokFeatureManager
    @EnvironmentObject var fileOpCoordinator: FileOperationCoordinator
    @EnvironmentObject var patchStore: PatchProjectStore
    @EnvironmentObject var repositoryStore: PackageRepositoryStore
    @State private var selectedTab = 0

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.black.ignoresSafeArea()

            // Main Tab Content (Only 2 tabs: Home and Patches)
            Group {
                switch selectedTab {
                case 0:
                    ZrokHomeDashboardView()
                case 1:
                    SwagFunctionsView()
                default:
                    ZrokHomeDashboardView()
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            // Bottom Navigation Capsule Bar
            SwagBottomNavView(selectedTab: $selectedTab)
        }
        .preferredColorScheme(.dark)
        .onAppear {
            featureManager.setCoordinator(fileOpCoordinator)
            featureManager.syncService.fetchPublishedConfig(manual: false)
        }
    }
}

struct ZrokHomeDashboardView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                Spacer().frame(height: 10)

                // Logo Icon
                ZStack {
                    RoundedRectangle(cornerRadius: 24)
                        .fill(Color.white)
                        .frame(width: 80, height: 80)
                    // Custom 3105 Ghost / Zrok Logo shape
                    VStack(spacing: 4) {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(Color.black)
                            .frame(width: 32, height: 40)
                            .overlay(
                                HStack(spacing: 4) {
                                    Circle().fill(Color.white).frame(width: 6, height: 6)
                                    Circle().fill(Color.white).frame(width: 6, height: 6)
                                }
                                .offset(y: -4),
                                alignment: .top
                            )
                    }
                }
                .shadow(color: Color.white.opacity(0.1), radius: 8)

                // Title & Author
                VStack(spacing: 6) {
                    Text("ZROK")
                        .font(.system(size: 26, weight: .bold))
                        .foregroundColor(.white)

                    Text("Desenvolvido por eduardo")
                        .font(.system(size: 14))
                        .foregroundColor(.gray)
                }

                // Official Identity Badge
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.orange)
                        .font(.system(size: 14))
                    Text("Identidade Oficial 3105")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.orange)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color.orange.opacity(0.12))
                .cornerRadius(20)
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(Color.orange.opacity(0.4), lineWidth: 1)
                )

                // Supported iOS Versions Section
                VStack(alignment: .leading, spacing: 14) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Versões de iOS Suportadas")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundColor(.white)

                        Text("3105 is verified on the ranges below. Unsupported builds are blocked.")
                            .font(.system(size: 12))
                            .foregroundColor(.gray)
                    }
                    .padding(.horizontal, 4)

                    VStack(spacing: 12) {
                        versionRow(version: "iOS 17", range: "17.0–17.7.x")
                        versionRow(version: "iOS 18", range: "18.0–18.7.1")
                        versionRow(version: "iOS 26", range: "26.0–26.6.1")
                        betaVersionRow()
                    }
                }
                .padding(.horizontal, 16)

                // Device Footer
                Text("This device: iOS 26.6.1 (23083)")
                    .font(.system(size: 12))
                    .foregroundColor(.gray)
                    .padding(.top, 4)

                Spacer().frame(height: 100)
            }
            .padding(.horizontal, 16)
        }
    }

    private func versionRow(version: String, range: String) -> some View {
        HStack {
            HStack(spacing: 10) {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
                    .font(.system(size: 16))
                Text(version)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundColor(.white)
            }
            Spacer()
            Text(range)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.gray)
        }
        .padding(16)
        .background(Color.white.opacity(0.04))
        .cornerRadius(14)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
    }

    private func betaVersionRow() -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                HStack(spacing: 10) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.green)
                        .font(.system(size: 16))
                    Text("iOS 27.0")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(.white)
                }
                Spacer()
                Text("Beta")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.orange)
            }

            Divider().background(Color.white.opacity(0.1))

            VStack(alignment: .leading, spacing: 6) {
                betaSubRow(name: "Developer Beta 1", build: "2AA3355q")
                betaSubRow(name: "Developer Beta 2", build: "2AA2276h")
                betaSubRow(name: "Developer Beta 3 - Public Beta 1", build: "2AA5306h", highlight: true)
                betaSubRow(name: "Developer Beta 4 - Public Beta 2", build: "2AA5290f")
            }
        }
        .padding(16)
        .background(Color.white.opacity(0.04))
        .cornerRadius(14)
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .stroke(Color.orange.opacity(0.5), lineWidth: 1)
        )
    }

    private func betaSubRow(name: String, build: String, highlight: Bool = false) -> some View {
        HStack {
            Text(name)
                .font(.system(size: 13))
                .foregroundColor(highlight ? .orange : .gray)
            Spacer()
            Text(build)
                .font(.system(size: 13, design: .monospaced))
                .foregroundColor(highlight ? .orange : .gray)
        }
    }
}
