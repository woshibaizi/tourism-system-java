import SwiftUI

struct HomeView: View {
    private let featuredPlaces = MockData.featuredPlaces
    private let diary = MockData.diaries.first

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                heroSection

                SectionHeaderView(title: "今日推荐", subtitle: "先把核心旅游体验做成卡片化的移动端首页")

                ForEach(featuredPlaces.prefix(2)) { place in
                    NavigationLink(value: place) {
                        PlaceCardView(place: place)
                    }
                    .buttonStyle(.plain)
                }

                SectionHeaderView(title: "快捷入口", subtitle: "后续可以直接接入现有 API 模块")

                quickActions

                if let diary {
                    SectionHeaderView(title: "热门日记", subtitle: "旅游内容模块适合先做静态 UI 再接接口")

                    NavigationLink(value: diary) {
                        DiaryCardView(diary: diary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(20)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("首页")
        .navigationDestination(for: Place.self) { place in
            PlaceDetailView(place: place)
        }
        .navigationDestination(for: Diary.self) { diary in
            DiaryDetailView(diary: diary)
        }
    }

    private var heroSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("你好，开始规划今天的旅行")
                .font(.largeTitle.bold())
            Text("这里先保留推荐、路线、日记三大主能力，方便你后续一边学 SwiftUI 一边接后端。")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            HStack {
                Label("201 个场所", systemImage: "mappin.and.ellipse")
                Spacer()
                Label("路线规划", systemImage: "point.topleft.down.curvedto.point.bottomright.up")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: [.green.opacity(0.95), .mint.opacity(0.75)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 28)
        )
        .foregroundStyle(.white)
    }

    private var quickActions: some View {
        HStack(spacing: 12) {
            quickActionCard(title: "查找景点", icon: "magnifyingglass", color: .teal)
            quickActionCard(title: "规划路线", icon: "map", color: .green)
            quickActionCard(title: "写日记", icon: "square.and.pencil", color: .orange)
        }
    }

    private func quickActionCard(title: String, icon: String, color: Color) -> some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(color)
            Text(title)
                .font(.caption.bold())
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 18)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 20))
    }
}

#Preview {
    NavigationStack {
        HomeView()
    }
}
