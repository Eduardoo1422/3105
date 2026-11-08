import SwiftUI

struct SwagBottomNavView: View {
    @Binding var selectedTab: Int

    let tabs = [
        ("Home", "house.fill"),
        ("Files", "folder.fill"),
        ("Patches", "cube.box.fill"),
        ("Cleaner", "sparkles"),
        ("Wallpapers", "photo.fill")
    ]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(tabs.indices, id: \.self) { index in
                let tab = tabs[index]
                let isSelected = selectedTab == index

                Button(action: {
                    selectedTab = index
                }) {
                    VStack(spacing: 4) {
                        Image(systemName: tab.1)
                            .font(.system(size: 20))
                        Text(tab.0)
                            .font(.system(size: 11, weight: isSelected ? .semibold : .regular))
                    }
                    .foregroundColor(isSelected ? .orange : .gray)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(
                        isSelected ?
                        Capsule()
                            .fill(Color.orange.opacity(0.18))
                            .overlay(Capsule().stroke(Color.orange.opacity(0.6), lineWidth: 1))
                        : nil
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background(
            Capsule()
                .fill(Color(uiColor: .systemDarkGray).opacity(0.9))
                .background(.ultraThinMaterial)
                .clipShape(Capsule())
                .overlay(
                    Capsule().stroke(Color.white.opacity(0.15), lineWidth: 1)
                )
        )
        .padding(.horizontal, 20)
        .padding(.bottom, 8)
    }
}
