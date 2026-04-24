import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var auth: AuthManager
    @StateObject private var vm = ProfileViewModel()

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 0) {
                VStack(spacing: 12) {
                    Circle()
                        .fill(LinearGradient(colors: [Color(hex: "667eea"), Color(hex: "764ba2")],
                                             startPoint: .topLeading, endPoint: .bottomTrailing))
                        .frame(width: 72, height: 72)
                        .overlay {
                            Text(String((vm.userProfile?.username ?? auth.currentUsername ?? "?").prefix(1)))
                                .font(.system(size: 28, weight: .bold)).foregroundStyle(.white)
                        }
                    Text(vm.userProfile?.username ?? auth.currentUsername ?? "未登录")
                        .font(.system(size: 22, weight: .bold))
                    Text("个性化旅游系统").font(.system(size: 14)).foregroundStyle(.secondary)
                }
                .padding(.top, 60).padding(.bottom, 24)
                .frame(maxWidth: .infinity)
                .background(
                    LinearGradient(colors: [Color(hex: "667eea"), Color(hex: "764ba2")],
                                   startPoint: .topLeading, endPoint: .bottomTrailing)
                    .clipShape(UnevenRoundedRectangle(bottomLeadingRadius: 32, bottomTrailingRadius: 32))
                )
            }

            List {
                Section {
                    HStack {
                        statRow("浏览历史", "\(vm.viewHistory.count)")
                        Divider()
                        statRow("我的日记", "\(vm.myDiaries.count)")
                        Divider()
                        statRow("评分记录", "\(vm.ratingHistory.count)")
                    }
                }

                Section {
                    NavigationLink {
                        MyDiariesView(diaries: vm.myDiaries)
                    } label: {
                        Label("我的日记", systemImage: "book.pages").foregroundStyle(Color(hex: "667eea"))
                    }
                    Label("我的收藏", systemImage: "heart").foregroundStyle(.pink)
                    Label("历史路线", systemImage: "clock.arrow.circlepath").foregroundStyle(.blue)
                    if let interests = vm.userProfile?.parsedInterests, !interests.isEmpty {
                        HStack {
                            Label("兴趣标签", systemImage: "tag").foregroundStyle(.orange)
                            Spacer()
                            ForEach(interests.prefix(3), id: \.self) { TagChip(text: $0) }
                        }
                    }
                }

                Section {
                    Button(role: .destructive) {
                        auth.logout()
                    } label: {
                        HStack {
                            Spacer()
                            Label("退出登录", systemImage: "rectangle.portrait.and.arrow.right")
                            Spacer()
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
        }
        .background(Color(.systemGroupedBackground))
        .task {
            if auth.isLoggedIn {
                await vm.loadProfile()
                await vm.loadHistory()
                await vm.loadMyDiaries()
            }
        }
    }

    private func statRow(_ title: String, _ value: String) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.system(size: 22, weight: .bold)).foregroundStyle(Color(hex: "667eea"))
            Text(title).font(.system(size: 11)).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

struct MyDiariesView: View {
    let diaries: [TravelDiary]
    var body: some View {
        List(diaries) { diary in
            NavigationLink(value: diary) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(diary.title ?? "").font(.system(size: 15, weight: .semibold))
                    Text(diary.content ?? "").font(.system(size: 13)).foregroundStyle(.secondary).lineLimit(1)
                }
            }
        }
        .navigationTitle("我的日记")
        .navigationDestination(for: TravelDiary.self) { DiaryDetailView(diaryId: $0.id) }
    }
}

#Preview { NavigationStack { ProfileView().environmentObject(AuthManager.shared) } }
