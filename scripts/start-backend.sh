#!/bin/bash
cd "$(dirname "$0")/.."
kill $(lsof -ti :8080) 2>/dev/null
echo "Starting Spring Boot backend..."
TOURISM_DB_PASSWORD=608052 mvn spring-boot:run -q 2>&1 &
while ! curl -s -o /dev/null "http://localhost:8080/api/places/hot?limit=1" 2>/dev/null; do
  sleep 1
done
echo "Backend ready at http://localhost:8080"
echo "Swagger: http://localhost:8080/swagger-ui.html"
