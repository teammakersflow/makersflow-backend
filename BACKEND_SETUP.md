# MakersFlow Backend Setup Guide

## Overview

MakersFlow Backend is built using **NestJS**, **Prisma ORM**, and **PostgreSQL**. It provides secure REST APIs for authentication, user management, LMS, eCommerce, and administrative operations.

---

# Tech Stack

- NestJS
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT Authentication
- Google OAuth
- Swagger
- Helmet
- CORS
- Throttler (Rate Limiting)

---

# Prerequisites

Install the following before running the project:

- Node.js (v20 or later)
- npm
- PostgreSQL Database
- Git

---

# Clone Repository

```bash
git clone <repository-url>
cd makersflow-backend
```

---

# Install Dependencies

```bash
npm install
```

---

# Environment Variables

Create a `.env` file in the project root.

Example:

```env
PORT=3000
NODE_ENV=development

DATABASE_URL=postgresql://<username>:<password>@<host>:<port>/<database>?schema=public

JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=15m

JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d

GOOGLE_CLIENT_ID=your_google_client_id
```

---

# Prisma Commands

Generate Prisma Client

```bash
npx prisma generate
```

Pull latest database schema

```bash
npx prisma db pull
```

Format Prisma schema

```bash
npx prisma format
```

Open Prisma Studio

```bash
npx prisma studio
```

---

# Running the Application

Development Mode

```bash
npm run start:dev
```

Production Build

```bash
npm run build
npm run start:prod
```

---

# API Documentation

Swagger Documentation

```
http://localhost:3000/api
```

Swagger is enabled only in development mode.

---

# Authentication Flow

## Google Login

```
POST /auth/google
```

Input

```json
{
  "idToken": "<google-id-token>"
}
```

Returns

- User Information
- Access Token
- Refresh Token

---

## Development Login

**Development Only**

```
POST /auth/dev-login
```

Returns

- Access Token
- Refresh Token

This endpoint must be removed before production deployment.

---

## Refresh Token

```
POST /auth/refresh
```

Input

```json
{
  "refreshToken": "<refresh-token>"
}
```

Returns a new Access Token.

---

## Current User

```
GET /auth/me
```

Requires Bearer Token.

---

## Logout

```
POST /auth/logout
```

Invalidates the stored refresh token.

---

# Security Features

Implemented

- JWT Authentication
- Refresh Token Hashing (bcrypt)
- Helmet Security Headers
- CORS Configuration
- Rate Limiting
- Validation Pipes
- Exception Filter
- Role-Based Authorization
- Password/Token Protection

---

# User Management

Implemented APIs

- Get Current User
- Get User By ID
- Update Profile
- Update User Role
- Ban User
- Unban User
- User Search
- Pagination
- Filtering

---

# Project Structure

```
src/

├── auth/
├── users/
├── prisma/
├── common/
├── whatsapp-otp/
├── app.module.ts
└── main.ts
```

---

# Important Commands

Install Packages

```bash
npm install
```

Generate Prisma Client

```bash
npx prisma generate
```

Pull Database Schema

```bash
npx prisma db pull
```

Run Development Server

```bash
npm run start:dev
```

Run Production

```bash
npm run start:prod
```

---

# Production Checklist

Before deploying:

- Remove `/auth/dev-login`
- Replace development JWT secrets
- Configure production database
- Configure production CORS origins
- Disable Swagger in production
- Enable HTTPS
- Verify environment variables
- Backup PostgreSQL database
- Remove debugging code
- Review API permissions

---

# Contributors

Backend Foundation

- Authentication
- User Management
- Security
- Prisma Configuration
- PostgreSQL Integration

Business Modules

- LMS
- Products
- Orders
- Coupons
- Analytics

---

# Notes

- Never commit the `.env` file.
- Commit only `.env.example`.
- Store production secrets securely.
- Run `npx prisma generate` after every schema update.