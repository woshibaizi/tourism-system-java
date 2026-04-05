import SwiftUI

struct DiscoverView: View {
    @State private var searchText = ""
    private let allPlaces = MockData.featuredPlaces

    private var filteredPlaces: [Place] {
        if searchText.isEmpty {
            return allPlaces
        }

        return allPlaces.filter {
            $0.name.localizedCaseInsensitiveContains(searchText) ||
            $0.category.localizedCaseInsensitiveContains(searchText) ||
            $0.tags.joined(separator: " ").localizedCaseInsensitiveContains(searchText)
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("发现适合你的景点")
                    .font(.largeTitle.bold())

                TextField("搜索景点、分类或标签", text: $searchText)
                    .padding()
                    .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        filterChip("热门")
                        filterChip("校园")
                        filterChip("园林")
                        filterChip("历史")
                    }
                }

                ForEach(filteredPlaces) { place in
                    NavigationLink(value: place) {
                        PlaceCardView(place: place)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(20)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("发现")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: Place.self) { place in
            PlaceDetailView(place: place)
        }
    }

    private func filterChip(_ title: String) -> some View {
        Text(title)
            .font(.subheadline)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Color(.secondarySystemBackground), in: Capsule())
    }
}

#Preview {
    NavigationStack {
        DiscoverView()
    }
}
