import SwiftUI

struct DiaryDetailView: View {
    let diary: Diary

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                RoundedRectangle(cornerRadius: 26)
                    .fill(
                        LinearGradient(
                            colors: [.orange.opacity(0.9), .pink.opacity(0.75)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(height: 220)
                    .overlay {
                        Image(systemName: diary.imageName)
                            .font(.system(size: 54))
                            .foregroundStyle(.white.opacity(0.9))
                    }

                Text(diary.title)
                    .font(.largeTitle.bold())

                HStack {
                    Text(diary.author)
                    Spacer()
                    Text(diary.dateText)
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)

                Label(diary.placeName, systemImage: "mappin.and.ellipse")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                Text(diary.content)
                    .font(.body)
                    .lineSpacing(5)

                HStack {
                    Label("\(diary.likes)", systemImage: "heart.fill")
                    Spacer()
                    Label("收藏", systemImage: "bookmark")
                    Spacer()
                    Label("分享", systemImage: "square.and.arrow.up")
                }
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .padding()
                .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 18))
            }
            .padding(20)
        }
        .background(Color(.systemGroupedBackground))
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationStack {
        DiaryDetailView(diary: MockData.diaries[0])
    }
}
