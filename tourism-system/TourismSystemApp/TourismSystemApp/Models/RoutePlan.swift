import Foundation
import CoreLocation

struct RoutePlan: Identifiable, Hashable {
    let id: Int
    let title: String
    let start: String
    let end: String
    let stops: [String]
    let distanceText: String
    let durationText: String
    let summary: String
    let startLatitude: Double
    let startLongitude: Double
    let endLatitude: Double
    let endLongitude: Double

    var startCoordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: startLatitude, longitude: startLongitude)
    }

    var endCoordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: endLatitude, longitude: endLongitude)
    }
}
