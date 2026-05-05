import SwiftUI

struct DiaryCardView: View {
    let diary: TravelDiary

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            RoundedRectangle(cornerRadius: 18)
                .fill(LinearGradient(colors: [.orange.opacity(0.85), .pink.opacity(0.75)],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(height: 130)
                .overlay {
                    Image(systemName: "book.pages.fill")
                        .font(.system(size: 36)).foregroundStyle(.white.opacity(0.9))
                }

            Text(diary.title ?? "").font(.headline)

            if let content = diary.content {
                Text(content).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
            }

            HStack {
                Text("作者ID: \(diary.authorId ?? 0)")
                Spacer()
                Label("\(diary.ratingCount ?? 0) 评分", systemImage: "star")
            }
            .font(.caption).foregroundStyle(.secondary)
        }
        .padding()
        .background(.background, in: RoundedRectangle(cornerRadius: 24))
        .overlay(RoundedRectangle(cornerRadius: 24).stroke(Color.primary.opacity(0.08), lineWidth: 1))
    }
}
