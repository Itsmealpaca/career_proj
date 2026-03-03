# career-db-admin

LinkedIn 후보자 JSON 데이터를 PostgreSQL에 정규화 적재하고, 관리자 로그인 후 웹에서 검색/필터/상세/적재 관리를 할 수 있는 시스템입니다.

## 기술 스택

- Next.js 14 (App Router)
- TypeScript
- Prisma ORM
- PostgreSQL 15
- NextAuth (Credentials Provider, 관리자 1계정 고정)
- TailwindCSS
- Docker + docker-compose

## 폴더 구조

```
career-db-admin/
├── app/
│   ├── login/page.tsx
│   ├── candidates/page.tsx
│   ├── candidates/[id]/page.tsx
│   ├── admin/ingest/page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── app/api/
│   ├── auth/[...nextauth]/route.ts
│   ├── candidates/route.ts
│   ├── candidates/[id]/route.ts
│   ├── upload/route.ts
│   ├── ingest/route.ts
│   ├── ingest/runs/route.ts
│   └── ingest/errors/route.ts
├── lib/
│   ├── prisma.ts
│   ├── auth.ts
│   └── ingest.ts
├── prisma/
│   └── schema.prisma
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── package.json
└── README.md
```

## 환경변수

`.env.example`을 참고하여 `.env` 파일을 생성하세요.

```env
DATABASE_URL="postgresql://postgres:postgres@db:5432/careerdb"
NEXTAUTH_SECRET="supersecret"
NEXTAUTH_URL="http://localhost:3000"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="admin123"
```

## 실행 방법

### Docker로 실행 (권장)

1. `docker-compose up -d db` 로 DB만 먼저 기동
2. `docker-compose run --rm app npx prisma migrate deploy` 로 마이그레이션 실행
3. `docker-compose up -d` 로 전체 서비스 기동
4. 브라우저에서 http://localhost:3000 접속

### 로컬 개발

1. PostgreSQL 15 실행 중이어야 함
2. `.env` 파일 생성 (로컬 DB URL 사용 예: `postgresql://postgres:postgres@localhost:5432/careerdb`)
3. `npm install`
4. `npx prisma migrate deploy` 또는 `npx prisma db push`
5. `npm run dev`
6. http://localhost:3000 접속

## 테스트 방법

### 로그인

- URL: http://localhost:3000/login
- 이메일: `admin@example.com` (ADMIN_EMAIL)
- 비밀번호: `admin123` (ADMIN_PASSWORD)

### 후보자 리스트

- URL: http://localhost:3000/candidates
- 검색: 이름, 헤드라인, 회사명, 직함, 스킬 ILIKE 검색
- 필터: 현재 재직 여부
- 정렬: updatedAt desc 기본
- Row 클릭 시 상세 이동

### 후보자 상세

- URL: http://localhost:3000/candidates/[id]
- 기본 정보 / 경력 / 학력 / 스킬 탭
- rawJson 기본 숨김, 버튼 클릭 시 표시

### 적재 관리

- URL: http://localhost:3000/admin/ingest
- JSON 파일 업로드
- 적재 실행 버튼으로 DB 적재
- 최근 IngestRun 리스트 조회
- 실패 로그 조회

## JSON 적재 형식

- 배열 또는 단일 객체 모두 지원
- `profileUrl` 또는 `sourceProfileId` 기준 upsert
- 주요 필드: fullName, headline, summary, locationText, industry
- positions: companyName, title, employmentType, startDate, endDate, isCurrent, description, locationText
- educations: schoolName, degree, fieldOfStudy, startDate, endDate, description
- skills: skillName 또는 name, 문자열 배열도 가능
