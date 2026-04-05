import SwiftUI

struct CreateDiaryView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @State private var place = ""
    @State private var content = ""

    var body: some View {
        Form {
            Section("基本信息") {
                TextField("标题", text: $title)
                TextField("关联景点", text: $place)
            }

            Section("正文内容") {
                TextEditor(text: $content)
                    .frame(minHeight: 180)
            }

            Section("开发说明") {
                Text("后续这里可以接入图片选择、上传接口，以及 AIGC 日记辅助生成。")
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("写日记")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("关闭") {
                    dismiss()
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button("提交") {
                    dismiss()
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        CreateDiaryView()
    }
}
