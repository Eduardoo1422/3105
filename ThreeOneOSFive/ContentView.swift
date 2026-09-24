import SwiftUI
import UIKit

struct ContentView: View {
    @Environment(\.appLanguage) private var language
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var selectedTab: Int = 0

    var body: some View {
        Group {
            if horizontalSizeClass == .regular {
                regularLayout
            } else {
                compactLayout
            }
        }
        .preferredColorScheme(.dark)
        .tint(.white)
    }

    private var compactLayout: some View {
        TabView(selection: $selectedTab) {
            SwagHomeView()
                .tabItem {
                    Label("Activation", systemImage: "bolt.fill")
                }
                .tag(0)
            
            InfoView()
                .tabItem {
                    Label("Info", systemImage: "info.circle.fill")
                }
                .tag(1)
        }
    }

    private var regularLayout: some View {
        NavigationSplitView {
            List {
                Button { selectedTab = 0 } label: {
                    Label("Activation", systemImage: "bolt.fill")
                        .fontWeight(selectedTab == 0 ? .semibold : .regular)
                }
                .buttonStyle(.plain)
                
                Button { selectedTab = 1 } label: {
                    Label("Info", systemImage: "info.circle.fill")
                        .fontWeight(selectedTab == 1 ? .semibold : .regular)
                }
                .buttonStyle(.plain)
            }
            .navigationTitle("SWAG-EXTERNAL")
        } detail: {
            if selectedTab == 0 {
                SwagHomeView()
            } else {
                InfoView()
            }
        }
    }
}
