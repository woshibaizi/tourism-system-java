package com.tourism.controller;

import com.tourism.service.AigcService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api")
public class MediaController {

    private static final long MAX_IMAGE_SIZE = 5L * 1024 * 1024;
    private static final long MAX_VIDEO_SIZE = 50L * 1024 * 1024;
    private static final Set<String> IMAGE_EXTENSIONS = Set.of("jpg", "jpeg", "png", "gif", "webp");
    private static final Set<String> VIDEO_EXTENSIONS = Set.of("mp4", "mov", "avi", "webm", "mkv");
    private static final DateTimeFormatter FILE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss_");

    private final AigcService aigcService;

    @Value("${app.upload-dir:${user.dir}/uploads}")
    private String uploadDir;

    public MediaController(AigcService aigcService) {
        this.aigcService = aigcService;
    }

    @PostMapping(value = "/upload/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> uploadImage(@RequestPart("file") MultipartFile file) {
        return storeFile(file, "images", IMAGE_EXTENSIONS, MAX_IMAGE_SIZE, "图片");
    }

    @PostMapping(value = "/upload/video", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String, Object> uploadVideo(@RequestPart("file") MultipartFile file) {
        return storeFile(file, "videos", VIDEO_EXTENSIONS, MAX_VIDEO_SIZE, "视频");
    }

    @PostMapping("/aigc/convert-to-video")
    public Map<String, Object> convertImagesToAnimation(@RequestBody Map<String, Object> request) {
        @SuppressWarnings("unchecked")
        List<String> imagePaths = (List<String>) request.get("imagePaths");
        String outputFormat = request.get("outputFormat") == null ? "gif" : String.valueOf(request.get("outputFormat"));
        Integer fps = request.get("fps") instanceof Number number ? number.intValue() : 6;
        Integer width = request.get("width") instanceof Number number ? number.intValue() : 848;
        Integer height = request.get("height") instanceof Number number ? number.intValue() : 480;

        Map<String, Object> result = aigcService.convertImagesToAnimation(imagePaths, outputFormat, fps, width, height);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "动画生成成功");
        response.put("data", result);
        return response;
    }

    private Map<String, Object> storeFile(MultipartFile file,
                                          String folder,
                                          Set<String> allowedExtensions,
                                          long maxSize,
                                          String fileTypeLabel) {
        if (file == null || file.isEmpty()) {
            return fail(fileTypeLabel + "文件不能为空");
        }

        String originalFilename = file.getOriginalFilename();
        String extension = getExtension(originalFilename);
        if (!allowedExtensions.contains(extension)) {
            return fail("不支持的" + fileTypeLabel + "格式");
        }

        if (file.getSize() > maxSize) {
            return fail(fileTypeLabel + "文件过大");
        }

        String safeFilename = FILE_TIME_FORMATTER.format(LocalDateTime.now())
                + Paths.get(originalFilename == null ? "file" : originalFilename).getFileName();

        Path uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path targetDir = uploadRoot.resolve(folder);
        Path targetFile = targetDir.resolve(safeFilename).normalize();

        try {
            Files.createDirectories(targetDir);
            file.transferTo(targetFile);
        } catch (IOException e) {
            return fail("保存" + fileTypeLabel + "失败: " + e.getMessage());
        }

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("filename", safeFilename);
        data.put("path", "uploads/" + folder + "/" + safeFilename);
        data.put("size", file.getSize());
        data.put("contentType", file.getContentType());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", fileTypeLabel + "上传成功");
        response.put("data", data);
        return response;
    }

    private Map<String, Object> fail(String message) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", false);
        response.put("message", message);
        response.put("data", null);
        return response;
    }

    private String getExtension(String filename) {
        if (!StringUtils.hasText(filename) || !filename.contains(".")) {
            return "";
        }
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }
}
