import SwiftUI

struct HomeView: View {
    @StateObject private var vm = HomeViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                heroSection

                if !vm.hotPlaces.isEmpty {
                    SectionHeaderView(title: "热门景点", subtitle: "实时数据来自后端 API")
                    ForEach(vm.hotPlaces.prefix(4)) { place in
                        NavigationLink(value: place) { PlaceCardView(place: place) }
                            .buttonStyle(.plain)
                    }
                }

                SectionHeaderView(title: "快捷入口", subtitle: "直接使用后端 API 模块")
                quickActions

                if !vm.hotDiaries.isEmpty {
                    SectionHeaderView(title: "热门日记", subtitle: "来自旅游日记模块")
                    ForEach(vm.hotDiaries.prefix(3)) { diary in
                        NavigationLink(value: diary) { DiaryCardView(diary: diary) }
                            .buttonStyle(.plain)
                    }
                }
            }
            .padding(20)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("首页")
        .navigationDestination(for: SpotPlace.self) { place in
            PlaceDetailView(placeId: place.id)
        }
        .navigationDestination(for: TravelDiary.self) { diary in
            DiaryDetailView(diaryId: diary.id)
        }
        .refreshable { await vm.loadAll() }
        .task { if vm.hotPlaces.isEmpty { await vm.loadAll() } }
    }

    private var heroSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("你好，开始规划今天的旅行")
                .font(.largeTitle.bold())
            Text("已接入后端所有核心 API，包括景点、路线、日记、美食、设施和导航。")
                .font(.subheadline).foregroundStyle(.secondary)

            if let stats = vm.stats {
                HStack {
                    Label("\(stats.places ?? 0) 个场所", systemImage: "mappin.and.ellipse")
                    Spacer()
                    Label("\(stats.diaries ?? 0) 篇日记", systemImage: "book")
                    Spacer()
                    Label("路线规划", systemImage: "point.topleft.down.curvedto.point.bottomright.up")
                }
                .font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(colors: [.green.opacity(0.95), .mint.opacity(0.75)],
                           startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 28)
        )
        .foregroundStyle(.white)
    }

    private var quickActions: some View {
        HStack(spacing: 12) {
            NavigationLink { DiscoverView() } label: {
                quickActionCard(title: "查找景点", icon: "magnifyingglass", color: .teal)
            }
            NavigationLink { RoutePlannerView() } label: {
                quickActionCard(title: "规划路线", icon: "map", color: .green)
            }
            NavigationLink { DiaryListView() } label: {
                quickActionCard(title: "写日记", icon: "square.and.pencil", color: .orange)
            }
        }
    }

    private func quickActionCard(title: String, icon: String, color: Color) -> some View {
        VStack(spacing: 10) {
            Image(systemName: icon).font(.title2).foregroundStyle(color)
            Text(title).font(.caption.bold())
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 18)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 20))
    }
}

#Preview {
    NavigationStack { HomeView() }
}
