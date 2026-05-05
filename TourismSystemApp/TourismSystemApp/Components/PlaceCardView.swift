import SwiftUI

struct PlaceCardView: View {
    let place: SpotPlace

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ZStack(alignment: .topTrailing) {
                RoundedRectangle(cornerRadius: 20)
                    .fill(LinearGradient(colors: [.green.opacity(0.9), .teal.opacity(0.7)],
                                         startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(height: 150)
                    .overlay {
                        Image(systemName: "building.2.fill")
                            .font(.system(size: 42)).foregroundStyle(.white.opacity(0.9))
                    }

                Label(String(format: "%.1f", place.ratingValue), systemImage: "star.fill")
                    .font(.caption.bold())
                    .padding(.horizontal, 10).padding(.vertical, 6)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(12)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(place.name ?? "").font(.headline)
                Text("\(place.type ?? "") · \(place.address ?? "")")
                    .font(.subheadline).foregroundStyle(.secondary)
                if let desc = place.description {
                    Text(desc).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
                }
            }

            HStack {
                if let _ = place.lat, let _ = place.lng {
                    Label("已定位", systemImage: "location")
                }
                Spacer()
                Text("查看详情").font(.caption).foregroundStyle(.green)
            }
            .font(.caption).foregroundStyle(.secondary)
        }
        .padding()
        .background(.background, in: RoundedRectangle(cornerRadius: 24))
        .overlay(RoundedRectangle(cornerRadius: 24).stroke(Color.primary.opacity(0.08), lineWidth: 1))
    }
}
