import SwiftUI

/// Visual tokens scoped to the Zrok screens so the dark/minimalist language
/// stays consistent and does not depend on the 3105 orange accent.
enum ZrokTheme {
    static let background = Color(white: 0.0)
    static let cardBackground = Color(red: 0.07, green: 0.07, blue: 0.08)
    static let cardBorder = Color(white: 0.19)
    static let primaryText = Color(white: 0.93)
    static let secondaryText = Color(white: 0.60)
    static let toggleThumb = Color(white: 0.95)
    static let toggleTrackOff = Color(white: 0.20)
    static let green = Color(red: 0.20, green: 0.76, blue: 0.42)
    static let yellow = Color(red: 0.94, green: 0.83, blue: 0.33)
    static let red = Color(red: 0.90, green: 0.40, blue: 0.36)
    static let cornerRadius: CGFloat = 18
    static let cardCornerRadius: CGFloat = 20
    static let outerPadding: CGFloat = 20
}

/// A reusable dark card surface that is shared by every Zrok screen so the
/// look stays identical between the Activation and Info tabs.
struct ZrokCard<Content: View>: View {
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        content
            .padding()
            .background(ZrokTheme.cardBackground)
            .overlay(
                RoundedRectangle(cornerRadius: ZrokTheme.cardCornerRadius, style: .continuous)
                    .stroke(ZrokTheme.cardBorder, lineWidth: 0.5)
            )
            .cornerRadius(ZrokTheme.cardCornerRadius, style: .continuous)
    }
}

/// Subtle colored dot used by status/compat rows.
struct StatusDot: View {
    let color: Color
    var body: some View {
        Circle().fill(color).frame(width: 9, height: 9)
    }
}

