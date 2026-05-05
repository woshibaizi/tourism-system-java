import Foundation
import CoreLocation

struct Place: Identifiable, Hashable {
    let id: Int
    let name: String
    let category: String
    let location: String
    let rating: Double
    let tags: [String]
    let summary: String
    let suggestedDuration: String
    let distanceText: String
    let imageName: String
    let latitude: Double
    let longitude: Double

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}
