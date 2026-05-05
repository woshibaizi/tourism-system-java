import SwiftUI

struct DiscoverView: View {
    @StateObject private var vm = DiscoverViewModel()

    private let types = ["全部", "校园", "景区", "公园", "历史遗址", "皇家园林"]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("发现适合你的景点")
                    .font(.largeTitle.bold())

                TextField("搜索景点、分类或标签", text: $vm.searchText)
                    .padding()
                    .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
                    .onSubmit { Task { await vm.search() } }

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(types, id: \.self) { type in
                            Button {
                                vm.selectedType = type == "全部" ? nil : type
                                Task { await vm.loadPlaces() }
                            } label: {
                                Text(type)
                                    .font(.subheadline)
                                    .padding(.horizontal, 14).padding(.vertical, 8)
                                    .background(
                                        vm.selectedType == type || (type == "全部" && vm.selectedType == nil)
                                            ? Color.green.opacity(0.2)
                                            : Color(.secondarySystemBackground),
                                        in: Capsule()
                                    )
                            }
                            .tint(.primary)
                        }
                    }
                }

                HStack(spacing: 12) {
                    Button { Task { await vm.sortByPopularity() } } label: {
                        Label("按热度", systemImage: "flame.fill")
                            .font(.subheadline)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(Color(.secondarySystemBackground), in: Capsule())
                    }
                    .tint(.primary)

                    Button { Task { await vm.sortByRating() } } label: {
                        Label("按评分", systemImage: "star.fill")
                            .font(.subheadline)
                            .padding(.horizontal, 14).padding(.vertical, 8)
                            .background(Color(.secondarySystemBackground), in: Capsule())
                    }
                    .tint(.primary)

                    Spacer()
                }

                if vm.isLoading {
                    ProgressView().frame(maxWidth: .infinity).padding()
                } else {
                    ForEach(vm.filteredPlaces) { place in
                        NavigationLink(value: place) { PlaceCardView(place: place) }
                            .buttonStyle(.plain)
                    }

                    if vm.filteredPlaces.isEmpty {
                        Text("暂未发现景点，请检查后端服务是否启动")
                            .foregroundStyle(.secondary).padding()
                    }
                }
            }
            .padding(20)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("发现")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: SpotPlace.self) { place in
            PlaceDetailView(placeId: place.id)
        }
        .task { if vm.places.isEmpty { await vm.loadPlaces() } }
    }
}

#Preview {
    NavigationStack { DiscoverView() }
}
