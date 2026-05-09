#!/bin/sh
# Maven Wrapper startup script

BASEDIR=$(dirname "$0")
MAVEN_WRAPPER_JAR="$BASEDIR/.mvn/wrapper/maven-wrapper.jar"
MAVEN_USER_HOME="${MAVEN_USER_HOME:-$HOME/.m2}"
MAVEN_HOME="${MAVEN_HOME:-$HOME/.m2/wrapper/dists/apache-maven-3.9.9}"

if [ ! -f "$MAVEN_WRAPPER_JAR" ]; then
  echo "Maven wrapper jar not found at $MAVEN_WRAPPER_JAR"
  exit 1
fi

JAVA_EXE="${JAVA_HOME:-$(which java)}/bin/java"
if [ ! -f "$JAVA_EXE" ]; then
  JAVA_EXE=$(which java)
fi

if [ -z "$JAVA_EXE" ]; then
  echo "Java not found. Please install JDK 17+."
  exit 1
fi

"$JAVA_EXE" \
  -classpath "$MAVEN_WRAPPER_JAR" \
  org.apache.maven.wrapper.MavenWrapperMain \
  "$@"
