import SwiftUI

struct PlacesHomeView: View {
    @StateObject private var vm = HomeViewModel()
    @StateObject private var dvm = DiscoverViewModel()
    @State private var showSearch = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                heroSection

                statSection

                if !vm.hotPlaces.isEmpty { hotSection }

                filterSection

                placeGrid

                if !vm.hotDiaries.isEmpty { diarySection }

                Spacer().frame(height: 16)
            }
            .padding(.bottom, 40)
        }
        .background(Color(.systemGroupedBackground))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Image(systemName: "mappin.and.ellipse").font(.system(size: 18, weight: .semibold))
                    .foregroundStyle(Color(hex: "667eea"))
            }
        }
        .refreshable { await loadAll() }
        .task { if vm.hotPlaces.isEmpty { await loadAll() } }
        .navigationDestination(for: SpotPlace.self) { place in
            PlaceDetailView(placeId: place.id)
        }
        .navigationDestination(for: TravelDiary.self) { diary in
            DiaryDetailView(diaryId: diary.id)
        }
    }

    private func loadAll() async {
        await vm.loadAll()
        await dvm.loadPlaces()
    }

    // MARK: Hero
    private var heroSection: some View {
        VStack(spacing: 16) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text("发现你的旅程").font(.system(size: 34, weight: .heavy))
                    Spacer()
                }

                Text("智能推荐 · 个性化路线 · 美好回忆")
                    .font(.system(size: 16)).foregroundStyle(.secondary)

                HStack(spacing: 10) {
                    Button {
                        dvm.selectedType = nil; Task { await dvm.loadPlaces() }
                    } label: {
                        Label("浏览场所", systemImage: "sparkles")
                            .font(.system(size: 15, weight: .medium))
                            .padding(.horizontal, 22).padding(.vertical, 12)
                            .background(Color(hex: "667eea"), in: RoundedRectangle(cornerRadius: 14))
                            .foregroundStyle(.white)
                    }
                    Button {
                        showSearch = true
                    } label: {
                        Label("搜索", systemImage: "magnifyingglass")
                            .font(.system(size: 15, weight: .medium))
                            .padding(.horizontal, 22).padding(.vertical, 12)
                            .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 14))
                    }
                    .foregroundStyle(.primary)
                }
                .padding(.top, 4)
            }
        }
        .padding(24)
        .padding(.top, 8)
    }

    // MARK: Stats
    @ViewBuilder
    private var statSection: some View {
        if let stats = vm.stats {
            HStack(spacing: 12) {
                statItem(icon: "mappin.and.ellipse", value: "\(stats.places ?? 0)", label: "场所")
                statItem(icon: "book.pages", value: "\(stats.diaries ?? 0)", label: "日记")
                statItem(icon: "person.2", value: "\(stats.users ?? 0)", label: "用户")
                statItem(icon: "point.topleft.down.curvedto.point.bottomright.up", value: "\(stats.roads ?? 0)", label: "路径")
            }
            .padding(.horizontal, 16)
        }
    }

    private func statItem(icon: String, value: String, label: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: icon).font(.system(size: 20)).foregroundStyle(Color(hex: "667eea"))
            Text(value).font(.system(size: 28, weight: .bold))
            Text(label).font(.system(size: 12)).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity).padding(.vertical, 20)
        .background(.background, in: RoundedRectangle(cornerRadius: 18))
        .shadow(color: .black.opacity(0.04), radius: 8, y: 4)
    }

    // MARK: Hot Places
    private var hotSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(title: "热门排行") {
                dvm.selectedType = nil; Task { await dvm.loadPlaces() }
            }
            .padding(.horizontal, 16)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(Array(vm.hotPlaces.enumerated()), id: \.element.id) { idx, place in
                        NavigationLink(value: place) {
                            HotPlaceCard(place: place, rank: idx + 1)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }

    // MARK: Filter
    private var filterSection: some View {
        VStack(spacing: 12) {
            HStack {
                SectionTitle(title: "全部场所") {}
                Spacer()
                HStack(spacing: 8) {
                    Button { Task { await dvm.sortByPopularity() } } label: {
                        Label("热度", systemImage: "flame").font(.system(size: 12, weight: .medium))
                            .padding(.horizontal, 12).padding(.vertical, 6)
                            .background(Color(.systemGray6), in: Capsule())
                    }
                    .tint(.primary)
                    Button { Task { await dvm.sortByRating() } } label: {
                        Label("评分", systemImage: "star").font(.system(size: 12, weight: .medium))
                            .padding(.horizontal, 12).padding(.vertical, 6)
                            .background(Color(.systemGray6), in: Capsule())
                    }
                    .tint(.primary)
                }
            }
            .padding(.horizontal, 16)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    FilterChip(text: "全部", isSelected: dvm.selectedType == nil) {
                        dvm.selectedType = nil; Task { await dvm.loadPlaces() }
                    }
                    ForEach(["校园", "景区", "公园", "历史遗址", "皇家园林"], id: \.self) { t in
                        FilterChip(text: t, isSelected: dvm.selectedType == t) {
                            dvm.selectedType = t; Task { await dvm.loadPlaces() }
                        }
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }

    // MARK: Place Grid
    private var placeGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
            if dvm.isLoading {
                ProgressView().frame(maxWidth: .infinity).padding(40).gridCellUnsizedAxes(.horizontal)
            } else {
                ForEach(dvm.filteredPlaces.prefix(20)) { place in
                    NavigationLink(value: place) {
                        PlaceGridCard(place: place)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(.horizontal, 16)
    }

    // MARK: Diaries
    private var diarySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            SectionTitle(title: "精选游记") {}
                .padding(.horizontal, 16)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(Array(vm.hotDiaries.prefix(6))) { diary in
                        NavigationLink(value: diary) {
                            DiaryGridCard(diary: diary)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16)
            }
        }
    }
}

// MARK: - Hot Place Card
struct HotPlaceCard: View {
    let place: SpotPlace; let rank: Int
    var body: some View {
        VStack(spacing: 0) {
            ZStack(alignment: .topLeading) {
                RoundedRectangle(cornerRadius: 16).fill(LinearGradient(
                    colors: rank <= 3 ? [Color(hex: "667eea"), Color(hex: "764ba2")] : [.gray.opacity(0.4), .gray.opacity(0.3)],
                    startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 150, height: 90)
                Image(systemName: "building.2.fill").font(.system(size: 30)).foregroundStyle(.white.opacity(0.6)).padding(12)

                Text("\(rank)").font(.system(size: 20, weight: .heavy))
                    .foregroundStyle(.white).padding(12)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(place.name ?? "").font(.system(size: 14, weight: .semibold)).lineLimit(1)
                StarRating(rating: place.ratingValue, size: 10)
            }
            .padding(12).frame(width: 150, alignment: .leading)
            .background(.background, in: UnevenRoundedRectangle(bottomLeadingRadius: 16, bottomTrailingRadius: 16))
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.06), radius: 8, y: 4)
    }
}

// MARK: - Place Grid Card
struct PlaceGridCard: View {
    let place: SpotPlace
    var body: some View {
        VStack(spacing: 0) {
            ZStack(alignment: .topTrailing) {
                LinearGradient(colors: [Color(hex: "667eea"), Color(hex: "764ba2")],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                    .frame(height: 120)
                Image(systemName: "building.2.fill").font(.system(size: 36)).foregroundStyle(.white.opacity(0.5))
                    .frame(maxWidth: .infinity, maxHeight: 120)

                HStack(spacing: 4) {
                    Image(systemName: "star.fill").font(.system(size: 9))
                    Text(String(format: "%.1f", place.ratingValue)).font(.system(size: 11, weight: .bold))
                }
                .foregroundStyle(.white).padding(.horizontal, 8).padding(.vertical, 4)
                .background(.ultraThinMaterial, in: Capsule()).padding(8)
            }
            VStack(alignment: .leading, spacing: 5) {
                Text(place.name ?? "").font(.system(size: 14, weight: .semibold)).lineLimit(1)
                Text(place.type ?? "").font(.system(size: 12)).foregroundStyle(.secondary)
                HStack(spacing: 4) {
                    StatChip(icon: "eye", value: "\(place.clickCount ?? 0)", color: .orange)
                    StatChip(icon: "star", value: "\(place.ratingCount ?? 0)", color: .yellow)
                }
            }
            .padding(12).frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(.background, in: RoundedRectangle(cornerRadius: 18))
        .shadow(color: .black.opacity(0.05), radius: 8, y: 4)
    }
}

// MARK: - Diary Grid Card
struct DiaryGridCard: View {
    let diary: TravelDiary
    var body: some View {
        VStack(spacing: 0) {
            ZStack(alignment: .topTrailing) {
                LinearGradient(colors: [Color(hex: "764ba2"), Color(hex: "667eea")],
                               startPoint: .topLeading, endPoint: .bottomTrailing)
                    .frame(width: 140, height: 90)
                Image(systemName: "book.pages.fill").font(.system(size: 28)).foregroundStyle(.white.opacity(0.5))

                let tags = diary.parsedTags
                if !tags.isEmpty {
                    Text(tags[0]).font(.system(size: 9, weight: .bold)).foregroundStyle(.white)
                        .padding(.horizontal, 6).padding(.vertical, 3)
                        .background(.ultraThinMaterial, in: Capsule()).padding(6)
                }
            }
            VStack(alignment: .leading, spacing: 4) {
                Text(diary.title ?? "").font(.system(size: 13, weight: .semibold)).lineLimit(2)
                StarRating(rating: diary.rating ?? 0, size: 9)
            }
            .padding(10).frame(width: 140, alignment: .leading)
            .background(.background, in: UnevenRoundedRectangle(bottomLeadingRadius: 14, bottomTrailingRadius: 14))
        }
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.05), radius: 6, y: 3)
    }
}

#Preview {
    NavigationStack { PlacesHomeView() }
}
