import Foundation

enum MockData {
    static let featuredPlaces: [Place] = [
        Place(
            id: 1,
            name: "未名湖",
            category: "校园景点",
            location: "北京大学",
            rating: 4.9,
            tags: ["湖景", "散步", "拍照"],
            summary: "适合慢游和拍照的经典校园景点，春秋两季体验最好。",
            suggestedDuration: "45 分钟",
            distanceText: "1.2 km",
            imageName: "sun.max.fill",
            latitude: 39.9994,
            longitude: 116.3158
        ),
        Place(
            id: 2,
            name: "颐和园",
            category: "皇家园林",
            location: "海淀区",
            rating: 4.8,
            tags: ["历史", "园林", "湖景"],
            summary: "大型园林景区，适合半日游到一日游，步行路线规划价值很高。",
            suggestedDuration: "3 小时",
            distanceText: "8.5 km",
            imageName: "leaf.fill",
            latitude: 39.9997,
            longitude: 116.2755
        ),
        Place(
            id: 3,
            name: "圆明园",
            category: "历史遗址",
            location: "海淀区",
            rating: 4.7,
            tags: ["遗址", "历史", "人文"],
            summary: "适合结合讲解和路线规划进行深度浏览。",
            suggestedDuration: "2 小时",
            distanceText: "6.8 km",
            imageName: "building.columns.fill",
            latitude: 40.0074,
            longitude: 116.3040
        )
    ]

    static let diaries: [Diary] = [
        Diary(
            id: 1,
            title: "在未名湖边度过的一个下午",
            author: "小王",
            dateText: "2026-03-15",
            placeName: "未名湖",
            summary: "天气很好，沿着湖边慢慢走，适合拍照和放松。",
            content: "今天下午从图书馆出来后沿着未名湖散步，湖面很安静，周围树影很好看。一路拍了很多照片，也顺手记录了几处适合打卡的机位。",
            likes: 28,
            imageName: "photo.fill"
        ),
        Diary(
            id: 2,
            title: "颐和园半日路线体验",
            author: "旅行者阿宁",
            dateText: "2026-03-12",
            placeName: "颐和园",
            summary: "按推荐路线走，时间安排比较合理，体力消耗也能接受。",
            content: "这次主要走的是东宫门进、长廊、佛香阁、昆明湖一线。路线比较顺，不会走很多回头路，适合第一次去的游客。",
            likes: 43,
            imageName: "camera.fill"
        )
    ]

    static let sampleRoute = RoutePlan(
        id: 1,
        title: "经典半日游路线",
        start: "东门入口",
        end: "湖心观景台",
        stops: ["游客中心", "主景点", "休息区"],
        distanceText: "3.6 km",
        durationText: "2 小时 10 分",
        summary: "适合第一次到访，覆盖核心景点，步行强度适中。",
        startLatitude: 39.9986,
        startLongitude: 116.3061,
        endLatitude: 39.9994,
        endLongitude: 116.3158
    )

    static let profile = UserProfile(
        name: "王博生",
        subtitle: "个性化旅游系统开发者",
        favoriteCount: 12,
        diaryCount: 4,
        routeCount: 7
    )
}
