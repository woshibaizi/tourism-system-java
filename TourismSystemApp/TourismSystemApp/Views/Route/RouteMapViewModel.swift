import Combine
import CoreLocation
import Foundation
import MapKit

@MainActor
final class RouteMapViewModel: ObservableObject {
    @Published var route: MKRoute?
    @Published var routePlan: RoutePlan?
    @Published var isLoading = false
    @Published var errorMessage: String?

    func clearRoute() {
        route = nil
        routePlan = nil
        errorMessage = nil
    }

    func calculateRoute(from startLocation: CLLocation, to destination: Place) async {
        isLoading = true
        errorMessage = nil

        let request = MKDirections.Request()
        request.source = MKMapItem(
            location: startLocation,
            address: MKAddress(fullAddress: "当前位置", shortAddress: nil)
        )
        request.destination = MKMapItem(
            location: CLLocation(latitude: destination.latitude, longitude: destination.longitude),
            address: MKAddress(
                fullAddress: "\(destination.name) \(destination.location)",
                shortAddress: destination.name
            )
        )
        request.transportType = .walking
        request.requestsAlternateRoutes = false

        do {
            let response = try await MKDirections(request: request).calculate()

            guard let resolvedRoute = response.routes.first else {
                errorMessage = "没有找到可用步行路线。"
                route = nil
                routePlan = nil
                isLoading = false
                return
            }

            route = resolvedRoute
            routePlan = RoutePlan(
                id: destination.id,
                title: "前往\(destination.name)",
                start: "当前位置",
                end: destination.name,
                stops: resolvedRoute.steps
                    .map(\.instructions)
                    .filter { !$0.isEmpty },
                distanceText: Measurement(value: resolvedRoute.distance, unit: UnitLength.meters).formatted(
                    .measurement(width: .abbreviated, usage: .road, numberFormatStyle: .number.precision(.fractionLength(0)))
                ),
                durationText: DateComponentsFormatter.routeFormatter.string(from: resolvedRoute.expectedTravelTime) ?? "未知",
                summary: "基于 MapKit 步行导航生成，已在地图中高亮路线。",
                startLatitude: startLocation.coordinate.latitude,
                startLongitude: startLocation.coordinate.longitude,
                endLatitude: destination.latitude,
                endLongitude: destination.longitude
            )
        } catch {
            route = nil
            routePlan = nil
            errorMessage = "路线规划失败：\(error.localizedDescription)"
        }

        isLoading = false
    }
}

private extension DateComponentsFormatter {
    static let routeFormatter: DateComponentsFormatter = {
        let formatter = DateComponentsFormatter()
        formatter.allowedUnits = [.hour, .minute]
        formatter.unitsStyle = .full
        return formatter
    }()
}
