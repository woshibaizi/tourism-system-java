import SwiftUI

struct DiaryCardView: View {
    let diary: Diary

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            RoundedRectangle(cornerRadius: 18)
                .fill(
                    LinearGradient(
                        colors: [.orange.opacity(0.85), .pink.opacity(0.75)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(height: 130)
                .overlay {
                    Image(systemName: diary.imageName)
                        .font(.system(size: 36))
                        .foregroundStyle(.white.opacity(0.9))
                }

            Text(diary.title)
                .font(.headline)

            Text(diary.summary)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(2)

            HStack {
                Text(diary.author)
                Spacer()
                Label("\(diary.likes)", systemImage: "heart.fill")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding()
        .background(.background, in: RoundedRectangle(cornerRadius: 24))
        .overlay(
            RoundedRectangle(cornerRadius: 24)
                .stroke(Color.primary.opacity(0.08), lineWidth: 1)
        )
    }
}

#Preview {
    DiaryCardView(
        diary: Diary(
            id: 1,
            title: "测试游记",
            author: "Alice",
            dateText: "2024-05-20",
            placeName: "杭州西湖",
            summary: "这里是摘要",
            content: "这里是游记正文内容。",
            likes: 12,
            imageName: "photo"
        )
    )
}
