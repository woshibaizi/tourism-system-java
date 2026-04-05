import SwiftUI

struct ProfileView: View {
    private let profile = MockData.profile

    var body: some View {
        List {
            Section {
                HStack(spacing: 16) {
                    Circle()
                        .fill(
                            LinearGradient(
                                colors: [.green.opacity(0.9), .teal.opacity(0.7)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 68, height: 68)
                        .overlay {
                            Text(String(profile.name.prefix(1)))
                                .font(.title.bold())
                                .foregroundStyle(.white)
                        }

                    VStack(alignment: .leading, spacing: 6) {
                        Text(profile.name)
                            .font(.title3.bold())
                        Text(profile.subtitle)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 8)
            }

            Section("我的数据") {
                statRow("收藏景点", value: "\(profile.favoriteCount)")
                statRow("发布日记", value: "\(profile.diaryCount)")
                statRow("历史路线", value: "\(profile.routeCount)")
            }

            Section("功能入口") {
                Label("我的收藏", systemImage: "heart.fill")
                Label("历史路线", systemImage: "clock.arrow.circlepath")
                Label("设置", systemImage: "gearshape.fill")
            }

            Section("开发说明") {
                Text("个人中心先保持轻量，后续再增加登录态、收藏、历史记录和设置。")
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("我的")
    }

    private func statRow(_ title: String, value: String) -> some View {
        HStack {
            Text(title)
            Spacer()
            Text(value)
                .foregroundStyle(.secondary)
        }
    }
}

#Preview {
    NavigationStack {
        ProfileView()
    }
}
