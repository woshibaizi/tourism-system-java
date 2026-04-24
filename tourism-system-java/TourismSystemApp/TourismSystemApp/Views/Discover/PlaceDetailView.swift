import SwiftUI

struct PlaceDetailView: View {
    let placeId: String
    @StateObject private var vm = PlaceDetailViewModel()

    var body: some View {
        ScrollView {
            if vm.isLoading {
                ProgressView().padding(80)
            } else if let detail = vm.detail, let place = detail.place {
                VStack(spacing: 20) {
                    GradientCover(imageName: "building.2.fill", height: 220) {
                        AnyView(
                            VStack {
                                Spacer()
                                HStack {
                                    TagChip(text: place.type ?? "")
                                    Spacer()
                                    Text("\(place.clickCount ?? 0) 浏览").font(.system(size: 11))
                                        .foregroundStyle(.white.opacity(0.8))
                                }.padding(12)
                            }
                        )
                    }
                    .clipShape(RoundedRectangle(cornerRadius: 20)).padding(.horizontal, 16)

                    VStack(alignment: .leading, spacing: 14) {
                        Text(place.name ?? "").font(.system(size: 26, weight: .bold))
                        StarRating(rating: place.ratingValue, count: place.ratingCount ?? 0, size: 15)

                        if let addr = place.address { Label(addr, systemImage: "location").font(.system(size: 13)).foregroundStyle(.secondary) }
                        if let open = place.openTime { Label(open, systemImage: "clock").font(.system(size: 13)).foregroundStyle(.secondary) }

                        let allTags = place.parsedKeywords + place.parsedFeatures
                        if !allTags.isEmpty {
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 6) {
                                    ForEach(Array(Set(allTags)), id: \.self) { TagChip(text: $0) }
                                }
                            }
                        }

                        if let desc = place.description, !desc.isEmpty {
                            Divider()
                            Text(desc).font(.system(size: 15)).lineSpacing(5).foregroundStyle(.primary)
                        }
                    }
                    .padding(20).background(.background, in: RoundedRectangle(cornerRadius: 20))
                    .shadow(color: .black.opacity(0.04), radius: 8, y: 4).padding(.horizontal, 16)

                    if !vm.facilities.isEmpty { facilitySection }
                    if !vm.foods.isEmpty { foodSection }

                    VStack(spacing: 10) {
                        NavigationLink {
                            RoutePlannerView()
                        } label: {
                            actionLabel("规划前往路线", "map.fill", .green)
                        }
                        NavigationLink {
                            FacilityQueryView(placeId: placeId, placeName: place.name ?? "")
                        } label: {
                            actionLabel("查看附近设施", "building.2.fill", .teal)
                        }
                        NavigationLink {
                            FoodSearchView(placeId: placeId, placeName: place.name ?? "")
                        } label: {
                            actionLabel("搜索周边美食", "fork.knife", .orange)
                        }
                    }
                    .padding(.horizontal, 16)
                }
            } else if let err = vm.errorMessage {
                Label(err, systemImage: "exclamationmark.triangle").foregroundStyle(.red).padding()
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await vm.loadDetail(placeId: placeId)
            await vm.loadFacilities(placeId: placeId)
            await vm.loadFoods(placeId: placeId)
            await vm.recordVisit(placeId: placeId)
        }
    }

    private var facilitySection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionTitle(title: "附近设施 (\(vm.facilities.count))") {}
            ForEach(vm.facilities.prefix(5)) { f in
                HStack {
                    Label(f.name ?? "设施", systemImage: f.type == "洗手间" ? "figure.stand" : "storefront").font(.system(size: 14))
                    Spacer()
                    if let d = f.distance { Text(fmtDist(d)).font(.system(size: 12)).foregroundStyle(.secondary) }
                }
                .padding(12).background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding(.horizontal, 16)
    }

    private var foodSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionTitle(title: "周边美食 (\(vm.foods.count))") {}
            ForEach(vm.foods.prefix(5)) { f in
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(f.displayName).font(.system(size: 14, weight: .medium))
                        Text(f.cuisine ?? "").font(.system(size: 12)).foregroundStyle(.secondary)
                    }
                    Spacer()
                    if let price = f.price { Text(price).font(.system(size: 12)).foregroundStyle(.orange) }
                }
                .padding(12).background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding(.horizontal, 16)
    }

    private func actionLabel(_ title: String, _ icon: String, _ color: Color) -> some View {
        HStack {
            Label(title, systemImage: icon).font(.system(size: 15, weight: .semibold))
            Spacer()
            Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold))
        }
        .foregroundStyle(.white).padding(.vertical, 16).padding(.horizontal, 20)
        .background(color, in: RoundedRectangle(cornerRadius: 16))
    }

    private func fmtDist(_ m: Double) -> String { m < 1000 ? "\(Int(m))m" : String(format: "%.1fkm", m/1000) }
}
