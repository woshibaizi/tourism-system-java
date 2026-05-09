@echo off
setlocal

set "BASE_DIR=%~dp0"
set "MVNW_JAR=%BASE_DIR%.mvn\wrapper\maven-wrapper.jar"

if not exist "%MVNW_JAR%" (
    echo ERROR: Maven wrapper jar not found: %MVNW_JAR%
    pause
    exit /b 1
)

java -classpath "%MVNW_JAR%" "-Dmaven.multiModuleProjectDirectory=%BASE_DIR%" org.apache.maven.wrapper.MavenWrapperMain %*
if %ERRORLEVEL% neq 0 (
    pause
    exit /b %ERRORLEVEL%
)
endlocal
