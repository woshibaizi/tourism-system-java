import MapKit
import SwiftUI

struct RouteResultView: View {
    let route: RoutePlan

    var body: some View {
        List {
            Section("地图预览") {
                RouteMapView(
                    currentLocation: CLLocation(
                        latitude: route.startLatitude,
                        longitude: route.startLongitude
                    ),
                    destination: Place(
                        id: route.id,
                        name: route.end,
                        category: "路线终点",
                        location: route.end,
                        rating: 0,
                        tags: [],
                        summary: route.summary,
                        suggestedDuration: route.durationText,
                        distanceText: route.distanceText,
                        imageName: "flag.fill",
                        latitude: route.endLatitude,
                        longitude: route.endLongitude
                    ),
                    route: nil
                )
                .frame(height: 240)
                .listRowInsets(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
            }

            Section("路线概览") {
                Text(route.title)
                    .font(.headline)
                Label(route.distanceText, systemImage: "ruler")
                Label(route.durationText, systemImage: "clock")
                Text(route.summary)
                    .foregroundStyle(.secondary)
            }

            Section("起终点") {
                Label("起点：\(route.start)", systemImage: "location.fill")
                Label("终点：\(route.end)", systemImage: "flag.fill")
            }

            Section("途经点") {
                ForEach(route.stops, id: \.self) { stop in
                    Label(stop, systemImage: "circle.fill")
                }
            }
        }
        .navigationTitle("路线结果")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationStack {
        RouteResultView(route: MockData.sampleRoute)
    }
}
