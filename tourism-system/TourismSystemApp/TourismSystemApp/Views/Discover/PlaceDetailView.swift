import SwiftUI

struct PlaceDetailView: View {
    let place: Place

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                RoundedRectangle(cornerRadius: 28)
                    .fill(
                        LinearGradient(
                            colors: [.green.opacity(0.9), .blue.opacity(0.6)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(height: 240)
                    .overlay {
                        Image(systemName: place.imageName)
                            .font(.system(size: 56))
                            .foregroundStyle(.white.opacity(0.92))
                    }

                VStack(alignment: .leading, spacing: 12) {
                    Text(place.name)
                        .font(.largeTitle.bold())
                    Text("\(place.category) · \(place.location)")
                        .foregroundStyle(.secondary)

                    HStack {
                        Label(String(format: "%.1f 分", place.rating), systemImage: "star.fill")
                        Label(place.distanceText, systemImage: "location")
                        Label(place.suggestedDuration, systemImage: "clock")
                    }
                    .font(.caption)
                    .foregroundStyle(.secondary)
                }

                VStack(alignment: .leading, spacing: 10) {
                    SectionHeaderView(title: "景点简介", subtitle: "这里后续直接对应景点详情接口")
                    Text(place.summary)
                        .font(.body)
                        .foregroundStyle(.secondary)
                }

                VStack(alignment: .leading, spacing: 10) {
                    SectionHeaderView(title: "推荐标签", subtitle: "第一版先静态展示，后续接推荐系统")
                    HStack {
                        ForEach(place.tags, id: \.self) { tag in
                            Text(tag)
                                .font(.caption.bold())
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(Color.green.opacity(0.12), in: Capsule())
                        }
                    }
                }

                VStack(spacing: 12) {
                    NavigationLink {
                        RoutePlannerView(selectedPlace: place)
                    } label: {
                        actionButton(title: "规划前往路线", icon: "map.fill", color: .green)
                    }

                    NavigationLink {
                        FacilityQueryView(place: place)
                    } label: {
                        actionButton(title: "查看附近设施", icon: "building.2.fill", color: .teal)
                    }

                    NavigationLink {
                        FoodSearchView(place: place)
                    } label: {
                        actionButton(title: "搜索周边美食", icon: "fork.knife", color: .orange)
                    }
                }
            }
            .padding(20)
        }
        .background(Color(.systemGroupedBackground))
        .navigationBarTitleDisplayMode(.inline)
    }

    private func actionButton(title: String, icon: String, color: Color) -> some View {
        HStack {
            Label(title, systemImage: icon)
                .font(.headline)
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.bold())
        }
        .foregroundStyle(.white)
        .padding()
        .background(color, in: RoundedRectangle(cornerRadius: 18))
    }
}

#Preview {
    NavigationStack {
        PlaceDetailView(place: MockData.featuredPlaces[0])
    }
}
