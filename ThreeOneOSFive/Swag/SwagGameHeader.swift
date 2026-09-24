import SwiftUI

struct SwagGameHeader: View {
    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: "shield.fill") // Placeholder for app icon
                .resizable()
                .scaledToFit()
                .frame(width: 60, height: 60)
                .foregroundColor(.white)
            
            Text("SWAG-EXTERNAL")
                .font(.title2.bold())
                .foregroundColor(.white)
            
            Text("Pronto para injetar")
                .font(.subheadline)
                .foregroundColor(.gray)
            
            HStack {
                Image(systemName: "gamecontroller.fill")
                    .foregroundColor(.yellow)
                Text("Free Fire")
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
