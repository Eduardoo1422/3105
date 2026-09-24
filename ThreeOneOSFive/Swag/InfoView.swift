import SwiftUI

struct InfoView: View {
    var body: some View {
        ZStack {
            Color.black.edgesIgnoringSafeArea(.all)
            
            ScrollView {
                VStack(spacing: 20) {
                    // Compatibility Card
                    InfoCard(title: "Compatibility") {
                        HStack {
                            Text("Compatibility")
                            Spacer()
                            Text("Supported")
                                .foregroundColor(.green)
                        }
                        .padding()
                        // Mock list of supported iOS versions
                        VStack(alignment: .leading, spacing: 5) {
                            Text("iOS 17.0–17.7.x")
                            Text("iOS 18.0–18.7.1")
                            Text("iOS 26.0–26.6.1")
                            Text("iOS 27.0 Developer Beta 1–4")
                            Text("iOS 27.0 Public Beta 1–2")
                        }
                        .font(.caption)
                        .padding(.horizontal)
                    }
                    
                    // Status Card
                    InfoCard(title: "Status") {
                        HStack {
                            Text("Application Status")
                            Spacer()
                            Text("Online")
                                .foregroundColor(.green)
                        }
                        .padding()
                    }
                    
                    // License Card
                    InfoCard(title: "License") {
                        VStack(alignment: .leading, spacing: 5) {
                            Text("License")
                            Text("Active")
                                .foregroundColor(.green)
                            Text("29 days remaining")
                                .font(.caption)
                        }
                        .padding()
                    }
                    
                    // About Section
                    InfoCard(title: "About") {
                        Text("This application was developed based on the 3105 project architecture.")
                            .font(.caption)
                            .padding()
                    }
                }
                .padding()
            }
        }
        .preferredColorScheme(.dark)
    }
}

struct InfoCard<Content: View>: View {
    let title: String
    let content: Content
    
    init(title: String, @ViewBuilder content: () -> Content) {
        self.title = title
        self.content = content()
    }
    
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title)
                .font(.headline)
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(.darkGray).opacity(0.3))
            
            content
        }
        .background(Color(.darkGray).opacity(0.1))
        .cornerRadius(10)
    }
}
