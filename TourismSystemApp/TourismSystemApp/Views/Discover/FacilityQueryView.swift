import SwiftUI

struct FacilityQueryView: View {
    let placeId: String; let placeName: String
    @StateObject private var vm = FacilityViewModel()

    var body: some View {
        VStack(spacing: 0) {
            GradientHeader(title: placeName, subtitle: "附近设施查询 · 按距离排序", icon: "building.2.fill")

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(["全部", "洗手间", "食堂", "咖啡馆", "超市", "图书馆", "公交站"], id: \.self) { t in
                        FilterChip(text: t, isSelected: vm.selectedType == t || (t == "全部" && vm.selectedType == nil)) {
                            vm.selectedType = t == "全部" ? nil : t; Task { await vm.loadByPlace(placeId) }
                        }
                    }
                }.padding(.horizontal, 16)
            }.padding(.vertical, 12)

            if vm.isLoading {
                ProgressView().padding(60)
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(vm.facilities) { f in
                            HStack(spacing: 14) {
                                Image(systemName: f.type == "洗手间" ? "figure.stand" : f.type == "食堂" ? "fork.knife" : "storefront")
                                    .font(.system(size: 18)).foregroundStyle(.white)
                                    .frame(width: 42, height: 42)
                                    .background(Color(hex: "667eea"), in: RoundedRectangle(cornerRadius: 12))

                                VStack(alignment: .leading, spacing: 3) {
                                    Text(f.name ?? "设施").font(.system(size: 15, weight: .semibold))
                                    HStack(spacing: 8) {
                                        Text(f.type ?? "").font(.system(size: 12)).foregroundStyle(.secondary)
                                        if let d = f.travelTime {
                                            Label("步行\(Int(d))分", systemImage: "figure.walk").font(.system(size: 11)).foregroundStyle(.secondary)
                                        }
                                    }
                                }
                                Spacer()
                                if let d = f.distance {
                                    VStack(spacing: 2) {
                                        Text(fmtDist(d)).font(.system(size: 16, weight: .bold)).foregroundStyle(Color(hex: "667eea"))
                                        Text("距离").font(.system(size: 10)).foregroundStyle(.secondary)
                                    }
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
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.loadByPlace(placeId) }
    }

    private func fmtDist(_ m: Double) -> String { m < 1000 ? "\(Int(m))m" : String(format: "%.1fkm", m/1000) }
}
