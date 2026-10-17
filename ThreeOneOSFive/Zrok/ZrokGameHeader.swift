import SwiftUI

struct ZrokGameHeader: View {
    @ObservedObject var syncService: RemoteAppConfigSyncService

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "shield.fill")
                .resizable()
                .scaledToFit()
                .frame(width: 60, height: 60)
                .foregroundColor(.white)
            
            Text(syncService.heroTitle)
                .font(.title2.bold())
                .foregroundColor(.white)
            
            Text(syncService.heroSubtitle)
                .font(.subheadline)
                .foregroundColor(.gray)
            
            HStack {
                Image(systemName: "gamecontroller.fill")
                    .foregroundColor(.yellow)
                Text("Free Fire (v\(syncService.publishedVersion))")
                    .foregroundColor(.white)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color.white.opacity(0.1))
            .cornerRadius(8)
            .padding(.top, 10)
        }
        .padding(.vertical, 20)
    }
}
