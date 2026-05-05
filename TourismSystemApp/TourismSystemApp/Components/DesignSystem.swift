import SwiftUI

// MARK: - Gradient header (matching frontend #667eea → #764ba2)
struct GradientHeader<Content: View>: View {
    let title: String
    let subtitle: String
    let icon: String
    @ViewBuilder let actions: () -> Content

    init(title: String, subtitle: String, icon: String, @ViewBuilder actions: @escaping () -> Content = { EmptyView() }) {
        self.title = title; self.subtitle = subtitle; self.icon = icon; self.actions = actions
    }

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 16) {
                HStack(spacing: 16) {
                    Image(systemName: icon)
                        .font(.system(size: 36, weight: .semibold))
                        .foregroundStyle(.white.opacity(0.9))
                    VStack(alignment: .leading, spacing: 4) {
                        Text(title).font(.system(size: 28, weight: .bold)).foregroundStyle(.white)
                        Text(subtitle).font(.system(size: 15)).foregroundStyle(.white.opacity(0.85))
                    }
                    Spacer()
                }
                HStack { actions() }
            }
            .padding(28)
            .background(
                LinearGradient(colors: [Color(hex: "667eea"), Color(hex: "764ba2")],
                               startPoint: .topLeading, endPoint: .bottomTrailing),
                in: RoundedRectangle(cornerRadius: 24)
            )
            .shadow(color: Color(hex: "667eea").opacity(0.35), radius: 16, y: 8)
        }
        .padding(.horizontal, 16).padding(.top, 8)
    }
}

// MARK: - Gradient card cover (for diary/place images)
struct GradientCover: View {
    let imageName: String
    let height: CGFloat
    let overlay: () -> AnyView

    init(imageName: String = "", height: CGFloat = 200, overlay: @escaping () -> AnyView = { AnyView(EmptyView()) }) {
        self.imageName = imageName; self.height = height; self.overlay = overlay
    }

    var body: some View {
        ZStack {
            LinearGradient(colors: [Color(hex: "667eea"), Color(hex: "764ba2")],
                           startPoint: .topLeading, endPoint: .bottomTrailing)
            Image(systemName: imageName).font(.system(size: 44)).foregroundStyle(.white.opacity(0.7))
            overlay()
        }
        .frame(height: height).clipped()
    }
}

// MARK: - Card wrapper
struct DesignCard<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        content()
            .background(.background, in: RoundedRectangle(cornerRadius: 18))
            .shadow(color: .black.opacity(0.06), radius: 12, y: 4)
    }
}

// MARK: - Rating stars
struct StarRating: View {
    let rating: Double
    let count: Int
    let size: CGFloat

    init(rating: Double, count: Int = 0, size: CGFloat = 13) {
        self.rating = rating; self.count = count; self.size = size
    }

    var body: some View {
        HStack(spacing: 3) {
            ForEach(1...5, id: \.self) { i in
                Image(systemName: starType(for: i))
                    .font(.system(size: size))
                    .foregroundStyle(Color(hex: "f59e0b"))
            }
            Text(String(format: "%.1f", rating))
                .font(.system(size: size, weight: .semibold)).foregroundStyle(.secondary)
            if count > 0 {
                Text("(\(count))").font(.system(size: size - 1)).foregroundStyle(.tertiary)
            }
        }
    }

    private func starType(for i: Int) -> String {
        let d = rating - Double(i - 1)
        return d >= 1 ? "star.fill" : d >= 0.5 ? "star.leadinghalf.filled" : "star"
    }
}

// MARK: - Stat chip
struct StatChip: View {
    let icon: String; let value: String; let color: Color
    var body: some View {
        HStack(spacing: 5) {
            Image(systemName: icon).font(.system(size: 11, weight: .bold))
            Text(value).font(.system(size: 12, weight: .semibold))
        }
        .foregroundStyle(color).padding(.horizontal, 9).padding(.vertical, 5)
        .background(color.opacity(0.1), in: Capsule())
    }
}

// MARK: - Tag chip
struct TagChip: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .medium))
            .padding(.horizontal, 10).padding(.vertical, 5)
            .background(LinearGradient(colors: [Color(hex: "a8edea").opacity(0.3), Color(hex: "fed6e3").opacity(0.3)],
                                       startPoint: .leading, endPoint: .trailing),
                        in: Capsule())
    }
}

// MARK: - Filter chip
struct FilterChip: View {
    let text: String; let isSelected: Bool; let action: () -> Void
    var body: some View {
        Button(action: action) {
            Text(text).font(.system(size: 14, weight: .medium))
                .padding(.horizontal, 16).padding(.vertical, 9)
                .background(isSelected
                    ? Color(hex: "667eea")
                    : Color(.systemGray6),
                    in: Capsule())
                .foregroundStyle(isSelected ? .white : .primary)
        }
    }
}

// MARK: - Section title
struct SectionTitle: View {
    let title: String; let action: (() -> Void)?
    var body: some View {
        HStack {
            Text(title).font(.system(size: 20, weight: .bold))
            Spacer()
            if let action {
                Button(action: action) {
                    HStack(spacing: 2) {
                        Text("更多").font(.system(size: 14))
                        Image(systemName: "chevron.right").font(.system(size: 12, weight: .bold))
                    }
                    .foregroundStyle(Color(hex: "667eea"))
                }
            }
        }
    }
}

// MARK: - Color hex helper
extension Color {
    init(hex: String) {
        let r, g, b: Double
        let h = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        if h.count == 6 {
            let ri = h.index(h.startIndex, offsetBy: 2)
            let gi = h.index(h.startIndex, offsetBy: 4)
            r = Double(Int(h[..<ri], radix: 16)!) / 255
            g = Double(Int(h[ri..<gi], radix: 16)!) / 255
            b = Double(Int(h[gi...], radix: 16)!) / 255
        } else { (r, g, b) = (0, 0, 0) }
        self.init(red: r, green: g, blue: b)
    }
}
