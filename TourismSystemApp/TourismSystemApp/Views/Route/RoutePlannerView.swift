import SwiftUI

struct RoutePlannerView: View {
    @StateObject private var vm = RouteViewModel()
    @State private var showResult = false

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                GradientHeader(title: "智能路径规划", subtitle: "A* 算法 · 混合交通工具 · 多目标优化", icon: "point.topleft.down.curvedto.point.bottomright.up")

                VStack(spacing: 16) {
                    routeTypePicker

                    VStack(spacing: 12) {
                        labeledSection("起点", "location.fill") {
                            Picker("选择起点", selection: $vm.selectedStart) {
                                Text("请选择起点").tag(nil as String?)
                                ForEach(vm.places) { p in Text(p.name ?? p.id).tag(p.id as String?) }
                            }
                            .pickerStyle(.menu).tint(Color(hex: "667eea"))
                        }

                        labeledSection("终点", "flag.fill") {
                            Picker("选择终点", selection: $vm.selectedEnd) {
                                Text("请选择终点").tag(nil as String?)
                                ForEach(vm.places) { p in Text(p.name ?? p.id).tag(p.id as String?) }
                            }
                            .pickerStyle(.menu).tint(Color(hex: "667eea"))
                        }
                    }

                    VStack(spacing: 12) {
                        Text("偏好设置").font(.system(size: 14, weight: .semibold)).foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                        Picker("交通方式", selection: $vm.vehicle) {
                            ForEach(vm.availableVehicles, id: \.self) { v in Text(v).tag(v) }
                        }
                        .pickerStyle(.segmented)
                        Picker("策略", selection: $vm.strategy) {
                            Text("最短时间").tag("time")
                            Text("最短距离").tag("distance")
                        }
                        .pickerStyle(.segmented)
                    }
                    .padding(16)
                    .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 16))

                    Button {
                        Task { await vm.calculateShortestPath(); showResult = true }
                    } label: {
                        HStack {
                            if vm.isLoading {
                                ProgressView().tint(.white)
                            } else {
                                Image(systemName: "sparkles").font(.system(size: 14, weight: .bold))
                                Text("开始规划").font(.system(size: 16, weight: .bold))
                            }
                        }
                        .frame(maxWidth: .infinity).padding(.vertical, 16)
                        .background(
                            vm.selectedStart != nil && vm.selectedEnd != nil && !vm.isLoading
                                ? LinearGradient(colors: [Color(hex: "667eea"), Color(hex: "764ba2")],
                                                 startPoint: .leading, endPoint: .trailing)
                                : LinearGradient(colors: [.gray.opacity(0.4)], startPoint: .leading, endPoint: .trailing),
                            in: RoundedRectangle(cornerRadius: 16)
                        )
                        .foregroundStyle(.white)
                    }
                    .disabled(vm.selectedStart == nil || vm.selectedEnd == nil || vm.isLoading)
                }
                .padding(16)
                .background(.background, in: RoundedRectangle(cornerRadius: 20))
                .shadow(color: .black.opacity(0.05), radius: 10, y: 4)
                .padding(.horizontal, 16)

                if let result = vm.navResult {
                    routeResultCard(result)
                }

                if let error = vm.errorMessage {
                    Label(error, systemImage: "exclamationmark.triangle.fill")
                        .font(.system(size: 14)).foregroundStyle(.orange)
                        .padding().frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 14))
                        .padding(.horizontal, 16)
                }
            }
        }
        .background(Color(.systemGroupedBackground))
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text("路线").font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(Color(hex: "667eea"))
            }
        }
        .task { await vm.loadPlaces() }
        .navigationDestination(isPresented: $showResult) {
            if let result = vm.navResult {
                RouteResultView(navResult: result)
            }
        }
    }

    private var routeTypePicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("规划类型").font(.system(size: 14, weight: .semibold)).foregroundStyle(.secondary)
            HStack {
                ForEach(["单目标", "多目标"], id: \.self) { t in
                    Text(t).font(.system(size: 14, weight: .medium))
                        .padding(.horizontal, 20).padding(.vertical, 10)
                        .background(t == "单目标" ? Color(hex: "667eea") : Color(.systemGray6), in: RoundedRectangle(cornerRadius: 12))
                        .foregroundStyle(t == "单目标" ? .white : .primary)
                }
            }
        }
    }

    private func labeledSection(_ label: String, _ icon: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(spacing: 8) {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 13)).foregroundStyle(Color(hex: "667eea"))
                Text(label).font(.system(size: 14, weight: .semibold)).foregroundStyle(.secondary)
                Spacer()
            }
            content()
                .padding(14).background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 14))
        }
    }

    @ViewBuilder
    private func routeResultCard(_ result: NavigationResult) -> some View {
        VStack(spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("规划完成").font(.system(size: 18, weight: .bold))
                    Text("\(result.path?.count ?? 0) 个节点 · \(result.vehicle ?? "步行")")
                        .font(.system(size: 13)).foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "checkmark.circle.fill").font(.system(size: 28)).foregroundStyle(.green)
            }

            HStack(spacing: 0) {
                VStack {
                    Text(fmtDist(result.totalDistance ?? 0)).font(.system(size: 22, weight: .bold))
                    Text("距离").font(.system(size: 12)).foregroundStyle(.secondary)
                }.frame(maxWidth: .infinity)
                Divider().frame(height: 36)
                VStack {
                    Text(fmtDuration(result.totalTime ?? 0)).font(.system(size: 22, weight: .bold))
                    Text("时间").font(.system(size: 12)).foregroundStyle(.secondary)
                }.frame(maxWidth: .infinity)
            }
            .padding().background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 14))

            Button { showResult = true } label: {
                Text("查看详细路线").font(.system(size: 15, weight: .medium))
                    .frame(maxWidth: .infinity).padding(.vertical, 12)
                    .background(Color(hex: "667eea").opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
                    .foregroundStyle(Color(hex: "667eea"))
            }
        }
        .padding(20)
        .background(.background, in: RoundedRectangle(cornerRadius: 20))
        .shadow(color: .black.opacity(0.05), radius: 10, y: 4)
        .padding(.horizontal, 16)
    }

    private func fmtDist(_ m: Double) -> String { m < 1000 ? "\(Int(m))m" : String(format: "%.1fkm", m/1000) }
    private func fmtDuration(_ min: Double) -> String { min < 60 ? "\(Int(min))分钟" : "\(Int(min/60))h\(Int(min.truncatingRemainder(dividingBy: 60)))m" }
}

#Preview { NavigationStack { RoutePlannerView() } }
