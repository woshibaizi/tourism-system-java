package com.tourism.service;

import com.tourism.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AigcService {

    private static final DateTimeFormatter FILE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    @Value("${app.upload-dir:${user.dir}/uploads}")
    private String uploadDir;

    @Value("${app.aigc.python-command:python3}")
    private String pythonCommand;

    public Map<String, Object> convertImagesToAnimation(List<String> imagePaths,
                                                        String outputFormat,
                                                        Integer fps,
                                                        Integer width,
                                                        Integer height) {
        if (imagePaths == null || imagePaths.isEmpty()) {
            throw new BusinessException(400, "没有提供图片路径");
        }

        int normalizedFps = fps == null || fps <= 0 ? 6 : fps;
        int normalizedWidth = width == null || width <= 0 ? 848 : width;
        int normalizedHeight = height == null || height <= 0 ? 480 : height;

        String suffix = "gif";
        if (outputFormat != null && !outputFormat.isBlank()) {
            String normalizedFormat = outputFormat.trim().toLowerCase();
            if ("gif".equals(normalizedFormat) || "mp4".equals(normalizedFormat)) {
                suffix = "gif";
            }
        }

        Path uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
        Path imageRoot = uploadRoot.resolve("images");
        Path videoRoot = uploadRoot.resolve("videos");

        try {
            Files.createDirectories(imageRoot);
            Files.createDirectories(videoRoot);
        } catch (IOException e) {
            throw new BusinessException("创建上传目录失败: " + e.getMessage());
        }

        List<String> absoluteImagePaths = new ArrayList<>();
        for (String imagePath : imagePaths) {
            if (imagePath == null || imagePath.isBlank()) {
                continue;
            }
            Path resolved = uploadRoot.resolve(imagePath).normalize();
            if (!resolved.startsWith(uploadRoot)) {
                throw new BusinessException(400, "非法图片路径: " + imagePath);
            }
            if (!Files.exists(resolved)) {
                throw new BusinessException(400, "图片不存在: " + imagePath);
            }
            absoluteImagePaths.add(resolved.toString());
        }

        if (absoluteImagePaths.isEmpty()) {
            throw new BusinessException(400, "没有可用的图片文件");
        }

        String filename = "aigc_animation_" + FILE_TIME_FORMATTER.format(LocalDateTime.now()) + "." + suffix;
        Path outputPath = videoRoot.resolve(filename);
        Path scriptPath = Paths.get("scripts", "generate_aigc_gif.py").toAbsolutePath().normalize();

        List<String> command = new ArrayList<>();
        command.add(pythonCommand);
        command.add(scriptPath.toString());
        command.add(outputPath.toString());
        command.add(String.valueOf(normalizedWidth));
        command.add(String.valueOf(normalizedHeight));
        command.add(String.valueOf(normalizedFps));
        command.addAll(absoluteImagePaths);

        ProcessBuilder processBuilder = new ProcessBuilder(command);
        processBuilder.directory(Paths.get("").toAbsolutePath().toFile());
        processBuilder.redirectErrorStream(true);

        String output;
        try {
            Process process = processBuilder.start();
            output = readProcessOutput(process);
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                throw new BusinessException("动画生成失败: " + output);
            }
        } catch (IOException e) {
            throw new BusinessException("调用AIGC脚本失败: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException("动画生成被中断");
        }

        if (!Files.exists(outputPath)) {
            throw new BusinessException("动画文件生成失败");
        }

        try {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("videoPath", "uploads/videos/" + filename);
            result.put("filename", filename);
            result.put("size", Files.size(outputPath));
            result.put("duration", absoluteImagePaths.size());
            result.put("resolution", normalizedWidth + "x" + normalizedHeight);
            result.put("fps", normalizedFps);
            result.put("format", "gif");
            result.put("mediaType", "image/gif");
            result.put("generatorOutput", output);
            return result;
        } catch (IOException e) {
            throw new BusinessException("读取动画文件信息失败: " + e.getMessage());
        }
    }

    private String readProcessOutput(Process process) throws IOException {
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!builder.isEmpty()) {
                    builder.append('\n');
                }
                builder.append(line);
            }
        }
        return builder.toString();
    }
}
