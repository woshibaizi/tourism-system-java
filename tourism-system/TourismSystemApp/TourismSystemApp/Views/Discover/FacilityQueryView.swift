import SwiftUI

struct FacilityQueryView: View {
    let place: Place

    var body: some View {
        List {
            Section("当前景点") {
                Text(place.name)
                Text("后续可接 `/api/facilities/search` 或 Spring Boot 对应设施查询接口。")
                    .foregroundStyle(.secondary)
            }

            Section("示例设施") {
                Label("游客中心 · 120m", systemImage: "info.circle.fill")
                Label("洗手间 · 180m", systemImage: "figure.stand")
                Label("便利店 · 260m", systemImage: "cart.fill")
                Label("咖啡馆 · 320m", systemImage: "cup.and.saucer.fill")
            }
        }
        .navigationTitle("附近设施")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationStack {
        FacilityQueryView(place: MockData.featuredPlaces[0])
    }
}
