import Foundation

struct Diary: Identifiable, Hashable {
    let id: Int
    let title: String
    let author: String
    let dateText: String
    let placeName: String
    let summary: String
    let content: String
    let likes: Int
    let imageName: String
}
