import SwiftUI

struct DiaryListView: View {
    @State private var showCreateDiary = false
    private let diaries = MockData.diaries

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                SectionHeaderView(title: "旅行日记", subtitle: "这里适合先做内容流，再补上传和发布")

                ForEach(diaries) { diary in
                    NavigationLink(value: diary) {
                        DiaryCardView(diary: diary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(20)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("日记")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showCreateDiary = true
                } label: {
                    Image(systemName: "square.and.pencil")
                }
            }
        }
        .navigationDestination(for: Diary.self) { diary in
            DiaryDetailView(diary: diary)
        }
        .sheet(isPresented: $showCreateDiary) {
            NavigationStack {
                CreateDiaryView()
            }
        }
    }
}

#Preview {
    NavigationStack {
        DiaryListView()
    }
}
