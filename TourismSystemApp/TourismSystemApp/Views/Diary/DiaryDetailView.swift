import SwiftUI

struct DiaryDetailView: View {
    let diaryId: String
    @StateObject private var vm = DiaryViewModel()
    @State private var showRate = false
    @State private var ratingValue = 4.0

    var body: some View {
        ScrollView {
            if vm.isLoading {
                ProgressView().padding(80)
            } else if let diary = vm.selectedDiary {
                VStack(spacing: 20) {
                    GradientCover(imageName: "book.pages.fill", height: 220) {
                        AnyView(
                            VStack {
                                Spacer()
                                HStack {
                                    let tags = diary.parsedTags
                                    ForEach(tags.prefix(3), id: \.self) { tag in
                                        Text(tag).font(.system(size: 10, weight: .bold))
                                            .foregroundStyle(.white).padding(.horizontal, 8).padding(.vertical, 4)
                                            .background(.ultraThinMaterial, in: Capsule())
                                    }
                                    Spacer()
                                    Text("\(diary.ratingCount ?? 0) 人已评")
                                        .font(.system(size: 11)).foregroundStyle(.white.opacity(0.8))
                                }
                                .padding(12)
                            }
                        )
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 20)).padding(.horizontal, 16)

                    VStack(alignment: .leading, spacing: 14) {
                        Text(diary.title ?? "").font(.system(size: 26, weight: .bold))
                        HStack {
                            StarRating(rating: diary.rating ?? 0, count: diary.ratingCount ?? 0, size: 15)
                            Spacer()
                            Button { showRate = true } label: {
                                Label("评分", systemImage: "star").font(.system(size: 13, weight: .medium))
                                    .padding(.horizontal, 14).padding(.vertical, 7)
                                    .background(Color(hex: "667eea").opacity(0.1), in: Capsule())
                                    .foregroundStyle(Color(hex: "667eea"))
                            }
                        }

                        HStack(spacing: 16) {
                            StatChip(icon: "person", value: "作者 \(diary.authorId ?? 0)", color: .purple)
                            StatChip(icon: "eye", value: "\(diary.clickCount ?? 0)", color: .orange)
                            if let date = diary.createdAt {
                                StatChip(icon: "calendar", value: String(date.prefix(10)), color: .blue)
                            }
                        }

                        if let placeId = diary.placeId, !placeId.isEmpty {
                            Label(placeId, systemImage: "mappin.and.ellipse")
                                .font(.system(size: 13)).foregroundStyle(.secondary)
                                .padding(8).background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 8))
                        }

                        Divider()

                        Text(diary.content ?? "").font(.system(size: 16)).lineSpacing(6).foregroundStyle(.primary)

                        let imgUrls = diary.parsedImages
                        if !imgUrls.isEmpty {
                            SectionTitle(title: "图片 (\(imgUrls.count))") {}
                            ScrollView(.horizontal) {
                                HStack(spacing: 8) {
                                    ForEach(imgUrls, id: \.self) { url in
                                        RoundedRectangle(cornerRadius: 12).fill(Color(.systemGray5))
                                            .frame(width: 120, height: 120)
                                            .overlay { Image(systemName: "photo").font(.title).foregroundStyle(.tertiary) }
                                    }
                                }
                            }
                        }
                    }
                    .padding(20)
                    .background(.background, in: RoundedRectangle(cornerRadius: 20))
                    .shadow(color: .black.opacity(0.04), radius: 8, y: 4)
                    .padding(.horizontal, 16)
                }
            } else if let err = vm.errorMessage {
                Label(err, systemImage: "exclamationmark.triangle").foregroundStyle(.red).padding()
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.loadDiaryDetail(id: diaryId) }
        .sheet(isPresented: $showRate) {
            VStack(spacing: 20) {
                Text("为游记评分").font(.system(size: 20, weight: .bold))
                HStack(spacing: 8) {
                    ForEach(1...5, id: \.self) { i in
                        Image(systemName: i <= Int(ratingValue) ? "star.fill" : "star")
                            .font(.system(size: 36)).foregroundStyle(.yellow)
                            .onTapGesture { ratingValue = Double(i) }
                    }
                }
                Button {
                    Task { await vm.rateDiary(id: diaryId, rating: ratingValue); showRate = false }
                } label: {
                    Text("提交").font(.system(size: 16, weight: .bold))
                        .frame(maxWidth: .infinity).padding(.vertical, 14)
                        .background(Color(hex: "667eea"), in: RoundedRectangle(cornerRadius: 14))
                        .foregroundStyle(.white)
                }
            }
            .padding()
            .presentationDetents([.medium])
        }
    }
}
