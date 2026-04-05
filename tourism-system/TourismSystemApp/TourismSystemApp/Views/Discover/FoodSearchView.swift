import SwiftUI

struct FoodSearchView: View {
    let place: Place

    var body: some View {
        List {
            Section("推荐说明") {
                Text("基于当前景点推荐附近美食，后续可接 `/api/foods` 或新的美食搜索接口。")
                    .foregroundStyle(.secondary)
            }

            Section("示例餐厅") {
                foodRow(name: "湖畔简餐", type: "轻食 · 4.6 分", distance: "350m")
                foodRow(name: "老街面馆", type: "面食 · 4.5 分", distance: "480m")
                foodRow(name: "校园咖啡", type: "咖啡 · 4.7 分", distance: "520m")
            }
        }
        .navigationTitle("\(place.name)美食")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func foodRow(name: String, type: String, distance: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(name)
                .font(.headline)
            Text("\(type) · \(distance)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
}

#Preview {
    NavigationStack {
        FoodSearchView(place: MockData.featuredPlaces[0])
    }
}
