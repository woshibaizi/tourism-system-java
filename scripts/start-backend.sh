#!/bin/bash
cd "$(dirname "$0")/.."
kill $(lsof -ti :8080) 2>/dev/null
echo "Starting Spring Boot backend..."

# Use Maven wrapper (./mvnw) since mvn may not be installed
if [ -f ./mvnw ]; then
  TOURISM_DB_PASSWORD=608052 ./mvnw spring-boot:run -q 2>&1 &
elif command -v mvn &>/dev/null; then
  TOURISM_DB_PASSWORD=608052 mvn spring-boot:run -q 2>&1 &
else
  echo "ERROR: Neither ./mvnw nor mvn found. Install Maven or ensure mvnw exists."
  exit 1
fi

# Wait up to 120 seconds for backend to be ready
MAX_WAIT=120
ELAPSED=0
while ! curl -s -o /dev/null "http://localhost:8080/api/places/hot?limit=1" 2>/dev/null; do
  sleep 2
  ELAPSED=$((ELAPSED + 2))
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "ERROR: Backend failed to start within ${MAX_WAIT}s. Check logs above."
    exit 1
  fi
done
echo "Backend ready at http://localhost:8080"
echo "Swagger: http://localhost:8080/swagger-ui.html"
