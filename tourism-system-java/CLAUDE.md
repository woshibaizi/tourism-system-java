# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

个性化旅游系统 — a full-stack tourism platform with Spring Boot backend, React frontend, and iOS SwiftUI client. Backend handles A* path planning, indoor navigation, Huffman compression, AC-automaton text filtering, recommendation/sorting algorithms, and full CRUD for places, diaries, foods, and facilities.

## Quick-start shortcuts

When the user says **"启动后端"** or **"启动前端"**, run the script directly — no exploration needed:

```bash
# Start backend (port 8080)
bash scripts/start-backend.sh

# Start frontend (port 5173)
bash scripts/start-frontend.sh

# Stop both
bash scripts/stop-all.sh
```

## Manual build & run

```bash
# Backend
cd tourism-system-java && mvn spring-boot:run

# Tests
mvn test

# Frontend
cd frontend
npm run dev        # dev server
npm run build      # production build
npm run lint       # eslint

# iOS app
cd TourismSystemApp
xcodebuild -project TourismSystemApp.xcodeproj -scheme TourismSystemApp \
  -destination 'platform=iOS Simulator,name=iPhone 17' build
```

## Tech stack

| Layer | Tech |
|---|---|
| Backend | Spring Boot 3.3.5, MyBatis-Plus 3.5.8, MySQL 8, Redis (Lettuce), JGraphT 1.5.2 |
| Auth | Spring Security + JWT (jjwt 0.12.6) |
| API docs | Springdoc OpenAPI 2.6.0 (Swagger UI at `/swagger-ui.html`) |
| Frontend | Vite + React + Ant Design + Axios |
| iOS | SwiftUI, MapKit |
| Algorithms | A*, Dijkstra, TSP (NN/DP/SA/GA), Huffman, AC automaton, TF-IDF, Top-K sorting |
| Test | H2 in-memory DB, MockMvc |

## API response format

All endpoints return `Result<T>`: `{"code": 200, "message": "success", "data": ...}`. Code `500` on error. The frontend `api.js` normalizes via `normalizeEnvelope()` and includes legacy fallback logic for missing endpoints.

## API layering

- **Canonical API**: `/api/navigation/*`, `/api/places/*`, `/api/diaries/*`, `/api/foods`, `/api/facilities/*`, `/api/auth/*`
- **Legacy/compat**: `/api/routes/*` (→ use `/api/navigation/*`), `/api/indoor/*` (→ use `/api/navigation/indoor*`)
- **Algorithm/demo**: `/api/algorithm/*` — only for debug/auxiliary, not for business pages

Full mapping in `DEV-PLAN/REQUIREMENTS_API_TEST_MATRIX.md`.

## Backend architecture

```
com/tourism/
├── algorithm/     ← A*, Dijkstra, TSP, Huffman, AC automaton, TF-IDF, recommendation, Top-K
├── config/        ← Security, Redis, Swagger, MyBatis-Plus, WebMVC
├── controller/    ← REST endpoints
├── security/      ← JWT filter + UserDetailsService
├── service/       ← Business logic interfaces
├── service/impl/  ← Business logic implementations
├── mapper/        ← MyBatis-Plus mappers (DB layer)
├── model/
│   ├── entity/    ← 8 DB tables: SpotPlace, SpotBuilding, SpotFacility, SpotRoadEdge, SpotFood, TravelDiary, SysUser, UserBehavior
│   ├── dto/       ← Request bodies (LoginDTO, RegisterDTO)
│   └── vo/        ← Response views (LoginVO, PlaceDetailVO, UserProfileVO)
├── exception/     ← GlobalExceptionHandler
└── utils/         ← Result, GeoUtils, JWT utils, JsonUtils
```

Entity IDs are String-based (`"place_001"`, `"diary_001"`). JSON-array fields (keywords, features, images, tags, interests) are stored as TEXT and parsed/deserialized at boundaries.

## Controllers

| Controller | Base path | Key endpoints |
|---|---|---|
| AuthController | `/api/auth` | login, register, me |
| PlaceController | `/api/places` | list, detail, search, hot, top-rated, recommend, sort, rate |
| DiaryController | `/api/diaries` | list, detail, CRUD, search, recommend, rate |
| NavigationController | `/api/navigation` | shortest-path, mixed-vehicle-path, multi-destination, indoor*, reload-graph |
| FacilityController | `/api/facilities` | list, detail, byPlace, search, nearby (LBS), nearest (path-distance) |
| FoodController | `/api/foods` | search, byPlace, byCuisine, popular, cuisines, detail |
| MediaController | `/api/upload`, `/api/aigc` | image/video upload, convert-to-video |
| UserController | `/api/users` | list, detail, update, behavior, views, ratings |
| AlgorithmController | `/api/algorithm` | search, recommend, compress, decompress, filter-text, sort |
| StatsController | `/api/stats` | system statistics |
| BuildingController | `/api/buildings` | building list/search/detail |
| LegacyNavigationController | `/api/routes`, `/api/indoor` | Legacy compat only |

## Frontend architecture

`frontend/src/services/api.js` is the single source of truth for all API calls. It handles:
- JWT token injection via Axios interceptor
- Response normalization (`normalizeEnvelope`, `unwrapPageRecords`)
- Legacy fallback logic for 404/405/501 endpoints (to be removed per release criteria)

Key pages: `HomePage`, `PlacesPage`, `PlaceDetailPage`, `DiariesPage`, `DiaryDetailPage`, `RoutePage`, `FacilityQueryPage`, `FoodSearchPage`, `IndoorNavigationPage`, `AIGCPage`, `StatsPage`, `LoginPage`.

## iOS app

SwiftUI app at `TourismSystemApp/` with 4 tabs: 景点, 路线, 日记, 我的.
API services in `Services/` mirror the frontend's `api.js` structure. ViewModels in `ViewModels/` handle async data loading via `@MainActor`. All Codable models in `Models/` match the Java entities.

## Test baseline

Tests use `src/test/resources/schema.sql` + `data.sql` for H2 in-memory setup. Key integration test files:
- `NavigationFacilityIntegrationTests` — path planning + facility queries
- `DiaryAlgorithmIntegrationTests` — diary search, rate, compression
- `IndoorNavigationIntegrationTests` — indoor nav

## DEV-PLAN directory

Sequential development logs (`DEV_LOG01` through `DEV_LOG07`) document the full build-up of the system. `REQUIREMENTS_API_TEST_MATRIX.md` is the architecture acceptance matrix mapping requirements → pages → canonical APIs → test evidence.
