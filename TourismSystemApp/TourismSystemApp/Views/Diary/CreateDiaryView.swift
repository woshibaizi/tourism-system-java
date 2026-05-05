import SwiftUI

struct CreateDiaryView: View {
    let onComplete: (Bool) -> Void
    @StateObject private var vm = DiaryViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                GradientHeader(title: "写日记", subtitle: "记录旅行中的美好瞬间", icon: "square.and.pencil")

                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("标题").font(.system(size: 14, weight: .semibold)).foregroundStyle(.secondary)
                        TextField("给日记起个名字...", text: $vm.createTitle)
                            .font(.system(size: 17)).padding(14)
                            .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 14))
                    }

                    VStack(alignment: .leading, spacing: 6) {
                        Text("正文").font(.system(size: 14, weight: .semibold)).foregroundStyle(.secondary)
                        TextEditor(text: $vm.createContent)
                            .font(.system(size: 16)).frame(minHeight: 180).padding(10)
                            .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 14))
                    }

                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("关联景点ID").font(.system(size: 14, weight: .semibold)).foregroundStyle(.secondary)
                            TextField("可选", text: $vm.createPlaceId)
                                .font(.system(size: 15)).padding(14)
                                .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 14))
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            Text("标签").font(.system(size: 14, weight: .semibold)).foregroundStyle(.secondary)
                            TextField("逗号分隔", text: $vm.createTags)
                                .font(.system(size: 15)).padding(14)
                                .background(Color(.systemGray6), in: RoundedRectangle(cornerRadius: 14))
                        }
                    }

                    if let err = vm.errorMessage {
                        Label(err, systemImage: "exclamationmark.triangle").font(.system(size: 13)).foregroundStyle(.red)
                    }

                    Button {
                        Task { _ = await vm.createDiary(); onComplete(true) }
                    } label: {
                        if vm.isLoading {
                            ProgressView().tint(.white).frame(maxWidth: .infinity).padding(.vertical, 16)
                        } else {
                            Text("发布日记").font(.system(size: 16, weight: .bold))
                                .frame(maxWidth: .infinity).padding(.vertical, 16)
                        }
                    }
                    .background(LinearGradient(colors: [Color(hex: "667eea"), Color(hex: "764ba2")],
                                              startPoint: .leading, endPoint: .trailing),
                                in: RoundedRectangle(cornerRadius: 16))
                    .foregroundStyle(.white).padding(.top, 8)
                }
                .padding(20).background(.background, in: RoundedRectangle(cornerRadius: 20))
                .shadow(color: .black.opacity(0.04), radius: 8, y: 4).padding(.horizontal, 16)
            }
        }
        .background(Color(.systemGroupedBackground))
        .toolbar { ToolbarItem(placement: .topBarLeading) { Button("取消") { onComplete(false) } } }
        .navigationBarTitleDisplayMode(.inline)
    }
}
