import SwiftUI

struct DiaryListView: View {
    @StateObject private var vm = DiaryViewModel()
    @State private var showCreate = false

    var body: some View {
        VStack(spacing: 0) {
            GradientHeader(title: "旅游日记", subtitle: "记录旅程 · 分享精彩 · 发现推荐",
                           icon: "book.pages.fill") {
                Button { showCreate = true } label: {
                    Label("写日记", systemImage: "square.and.pencil")
                        .font(.system(size: 14, weight: .semibold))
                        .padding(.horizontal, 20).padding(.vertical, 10)
                        .background(.white.opacity(0.2), in: Capsule())
                        .foregroundStyle(.white)
                }
            }

            VStack(spacing: 12) {
                HStack(spacing: 8) {
                    HStack {
                        Image(systemName: "magnifyingglass").font(.system(size: 13))
                            .foregroundStyle(.secondary)
                        TextField("搜索日记...", text: $vm.searchText)
                            .font(.system(size: 15))
                            .onSubmit { Task { await vm.search() } }
                    }
                    .padding(12).background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 14))

                    Picker("", selection: $vm.searchType) {
                        Text("全文").tag("fulltext")
                        Text("标题").tag("title")
                        Text("目的地").tag("destination")
                    }
                    .pickerStyle(.menu).tint(Color(hex: "667eea"))
                }

                HStack(spacing: 8) {
                    Button { Task { await vm.search() } } label: {
                        Label("搜索", systemImage: "sparkles")
                            .font(.system(size: 13, weight: .medium))
                            .padding(.horizontal, 16).padding(.vertical, 8)
                            .background(LinearGradient(colors: [Color(hex: "667eea"), Color(hex: "764ba2")],
                                                       startPoint: .leading, endPoint: .trailing),
                                        in: RoundedRectangle(cornerRadius: 12))
                            .foregroundStyle(.white)
                    }
                    Button {
                        vm.searchText = ""; Task { await vm.loadDiaries() }
                    } label: {
                        Label("清空", systemImage: "arrow.counterclockwise")
                            .font(.system(size: 13, weight: .medium))
                            .padding(.horizontal, 16).padding(.vertical, 8)
                            .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))
                    }
                    .foregroundStyle(.secondary)
                    Spacer()
                }
            }
            .padding(16)

            ScrollView {
                if vm.isLoading {
                    ProgressView().padding(60)
                } else if vm.diaries.isEmpty {
                    VStack(spacing: 16) {
                        Image(systemName: "book.pages").font(.system(size: 48)).foregroundStyle(.tertiary)
                        Text("暂无日记").font(.system(size: 16, weight: .medium)).foregroundStyle(.secondary)
                        Text("分享你的第一篇旅行日记吧").font(.system(size: 14)).foregroundStyle(.tertiary)
                    }.padding(.top, 80)
                } else {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        ForEach(vm.diaries) { diary in
                            NavigationLink(value: diary) {
                                DiaryGridCard(diary: diary)
                            }
                            .buttonStyle(.plain)
                            .contextMenu {
                                if let uid = AuthManager.shared.currentUserId, diary.authorId == uid {
                                    Button(role: .destructive) {
                                        Task { await vm.deleteDiary(id: diary.id) }
                                    } label: { Label("删除", systemImage: "trash") }
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 16)
                }
            }
        }
        .background(Color(.systemGroupedBackground))
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("日记").font(.system(size: 17, weight: .semibold)).foregroundStyle(Color(hex: "667eea"))
            }
        }
        .navigationDestination(for: TravelDiary.self) { diary in
            DiaryDetailView(diaryId: diary.id)
        }
        .sheet(isPresented: $showCreate) {
            NavigationStack {
                CreateDiaryView { success in
                    if success { showCreate = false; Task { await vm.loadDiaries() } }
                }
            }
        }
        .task { if vm.diaries.isEmpty { await vm.loadDiaries() } }
    }
}

#Preview { NavigationStack { DiaryListView() } }
