import SwiftUI

struct RouteResultView: View {
    let navResult: NavigationResult

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                GradientHeader(title: "路线结果", subtitle: "\(navResult.path?.count ?? 0) 个节点 · \(navResult.vehicle ?? "步行") · \(navResult.strategy ?? "")",
                               icon: "point.topleft.down.curvedto.point.bottomright.up")

                VStack(spacing: 14) {
                    HStack(spacing: 0) {
                        statBox("distance", fmtDist(navResult.totalDistance ?? 0), "总距离")
                        Divider().frame(height: 40)
                        statBox("clock", fmtDuration(navResult.totalTime ?? 0), "总时间")
                        Divider().frame(height: 40)
                        statBox("point.topleft.down.curvedto.point.bottomright.up",
                                "\(navResult.path?.count ?? 0)", "节点数")
                    }
                }
                .padding(20).background(.background, in: RoundedRectangle(cornerRadius: 20))
                .shadow(color: .black.opacity(0.04), radius: 8, y: 4).padding(.horizontal, 16)

                VStack(alignment: .leading, spacing: 10) {
                    SectionTitle(title: "路径节点") {}
                    ForEach(Array(navResult.path?.enumerated() ?? [].enumerated()), id: \.offset) { idx, node in
                        HStack(spacing: 12) {
                            ZStack {
                                Circle().fill(idx == 0 ? .green : idx == (navResult.path?.count ?? 1) - 1 ? .red : Color(hex: "667eea")).frame(width: 10)
                                if idx < (navResult.path?.count ?? 1) - 1 {
                                    Rectangle().fill(Color(.systemGray4)).frame(width: 2, height: 20).offset(y: 15)
                                }
                            }
                            Text(node).font(.system(size: 14))
                            Spacer()
                            Text("节点 \(idx + 1)").font(.system(size: 12)).foregroundStyle(.secondary)
                        }
                        .padding(12).background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))
                    }
                }
                .padding(20).background(.background, in: RoundedRectangle(cornerRadius: 20))
                .shadow(color: .black.opacity(0.04), radius: 8, y: 4).padding(.horizontal, 16)

                if let segments = navResult.segments, !segments.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        SectionTitle(title: "分段详情 (\(segments.count))") {}
                        ForEach(Array(segments.enumerated()), id: \.offset) { idx, seg in
                            VStack(alignment: .leading, spacing: 6) {
                                HStack {
                                    Text("第\(idx + 1)段").font(.system(size: 13, weight: .semibold)).foregroundStyle(Color(hex: "667eea"))
                                    Spacer()
                                    Text(seg.vehicle ?? "").font(.system(size: 11)).foregroundStyle(.secondary)
                                        .padding(.horizontal, 8).padding(.vertical, 3).background(Color(.systemGray5), in: Capsule())
                                }
                                Text("\(seg.from ?? "") → \(seg.to ?? "")").font(.system(size: 14))
                                HStack {
                                    Label(fmtDist(seg.distance ?? 0), systemImage: "ruler")
                                    Spacer()
                                    Label(fmtDuration(seg.time ?? 0), systemImage: "clock")
                                }
                                .font(.system(size: 12)).foregroundStyle(.secondary)
                            }
                            .padding(12).background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))
                        }
                    }
                    .padding(20).background(.background, in: RoundedRectangle(cornerRadius: 20))
                    .shadow(color: .black.opacity(0.04), radius: 8, y: 4).padding(.horizontal, 16)
                }
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationBarTitleDisplayMode(.inline)
    }

    private func statBox(_ icon: String, _ value: String, _ label: String) -> some View {
        VStack(spacing: 4) {
            Image(systemName: icon).font(.system(size: 18)).foregroundStyle(Color(hex: "667eea"))
            Text(value).font(.system(size: 20, weight: .bold))
            Text(label).font(.system(size: 11)).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
    private func fmtDist(_ m: Double) -> String { m < 1000 ? "\(Int(m))m" : String(format: "%.1fkm", m/1000) }
    private func fmtDuration(_ min: Double) -> String { min < 60 ? "\(Int(min))分钟" : "\(Int(min/60))h\(Int(min.truncatingRemainder(dividingBy: 60)))m" }
}
