import SwiftUI

struct FoodSearchView: View {
    let placeId: String; let placeName: String
    @StateObject private var vm = FoodViewModel()

    var body: some View {
        VStack(spacing: 0) {
            GradientHeader(title: placeName, subtitle: "周边美食搜索", icon: "fork.knife")

            VStack(spacing: 12) {
                HStack {
                    Image(systemName: "magnifyingglass").font(.system(size: 13)).foregroundStyle(.secondary)
                    TextField("搜索美食...", text: $vm.searchText)
                        .font(.system(size: 15))
                        .onSubmit { Task { await vm.loadByPlace(placeId) } }
                }
                .padding(12).background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 14))

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        FilterChip(text: "全部", isSelected: vm.selectedCuisine == nil) {
                            vm.selectedCuisine = nil; Task { await vm.loadByPlace(placeId) }
                        }
                        ForEach(vm.cuisines, id: \.self) { c in
                            FilterChip(text: c, isSelected: vm.selectedCuisine == c) {
                                vm.selectedCuisine = c; Task { await vm.loadByPlace(placeId) }
                            }
                        }
                    }
                }

                Picker("排序", selection: $vm.sortBy) {
                    Text("按热度").tag("popularity")
                    Text("按评分").tag("rating")
                    Text("按距离").tag("distance")
                }
                .pickerStyle(.segmented)
                .onChange(of: vm.sortBy) { _, _ in Task { await vm.loadByPlace(placeId) } }
            }
            .padding(16)

            if vm.isLoading {
                ProgressView().padding(60)
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(vm.foods) { f in
                            HStack(spacing: 14) {
                                Text(f.cuisine?.prefix(1).uppercased() ?? "?").font(.system(size: 16, weight: .bold))
                                    .foregroundStyle(.white)
                                    .frame(width: 42, height: 42)
                                    .background(Color.orange, in: RoundedRectangle(cornerRadius: 12))

                                VStack(alignment: .leading, spacing: 3) {
                                    Text(f.displayName).font(.system(size: 15, weight: .semibold))
                                    HStack(spacing: 8) {
                                        Text(f.cuisine ?? "").font(.system(size: 12)).foregroundStyle(.orange)
                                        if let rating = f.rating, rating > 0 {
                                            Label(String(format: "%.1f", rating), systemImage: "star.fill")
                                                .font(.system(size: 11)).foregroundStyle(.yellow)
                                        }
                                    }
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 2) {
                                    if let price = f.price { Text(price).font(.system(size: 15, weight: .bold)).foregroundStyle(.orange) }
                                    if let d = f.distanceMeters, d > 0 { Text(fmtDist(d)).font(.system(size: 11)).foregroundStyle(.secondary) }
                                }
                            }
                            .padding(14)
                            .background(.background, in: RoundedRectangle(cornerRadius: 16))
                            .shadow(color: .black.opacity(0.03), radius: 6, y: 3)
                        }
                    }.padding(.horizontal, 16)
                }
            }
        }
        .background(Color(.systemGroupedBackground))
        .task {
            await vm.loadCuisines(placeId: placeId)
            await vm.loadByPlace(placeId)
        }
    }

    private func fmtDist(_ m: Double) -> String { m < 1000 ? "\(Int(m))m" : String(format: "%.1fkm", m/1000) }
}
